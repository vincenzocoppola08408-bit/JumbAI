// ============================================================
// pages/api/webhooks/civitai/route.ts
// Webhook receiver per risultati generazione Civitai
// - Validazione idempotenza (preveiene duplicati)
// - Firma HMAC (se env CIVITAI_WEBHOOK_SECRET impostata)
// - Gestione stato: workflow:succeeded / workflow:failed
// ============================================================
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Abilita body raw solo se la firma HMAC è configurata
export const config = {
  api: { bodyParser: process.env.CIVITAI_WEBHOOK_SECRET ? false : true }
};

export async function POST(request: Request) {
  let payload: any = {};

  // 1️⃣ Firma HMAC-SHA256 (se configurata)
  const webhookSecret = process.env.CIVITAI_WEBHOOK_SECRET;
  if (webhookSecret) {
    const signature = request.headers.get('X-Civitai-Signature');
    if (!signature) {
      console.warn('Webhook Civitai: X-Civitai-Signature mancante');
      return NextResponse.json({ error: 'Firma mancante' }, { status: 401 });
    }

    const rawBody = await request.text();
    const computedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (computedSignature !== signature) {
      console.warn('Webhook Civitai: firma non valida');
      return NextResponse.json({ error: 'Firma non valida' }, { status: 401 });
    }

    payload = JSON.parse(rawBody);
  } else {
    // Fallback: nessuna firma configurata (solo dev)
    payload = await request.json();
  }

  try {
    const { type, workflowId, ...rest } = payload;

    // 2️⃣ Estrai workflow_id
    const workflowIdValue = workflowId || payload?.workflow_id || payload?.id;

    if (!workflowIdValue) {
      console.warn('Webhook: workflowId mancante nel payload');
      return NextResponse.json({ error: 'workflowId mancante' }, { status: 400 });
    }

    // 3️⃣ FILTRO DI IDEMPOTENZA: verifica stato attuale
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('immagini_generate')
      .select('id, user_id, stato, request_id, prompt')
      .eq('request_id', workflowIdValue)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Webhook: errore ricerca immagine:', fetchError);
      // Continua comunque, gestiamo l'assenza
    }

    // 4️⃣ FILTRO DI IDEMPOTENZA: ignora se già processata
    if (existing && ['completata', 'fallita'].includes(existing.stato)) {
      console.log(`Webhook: ignorato workflow ${workflowIdValue}, stato già ${existing.stato}`);
      return NextResponse.json({ ok: true, duplicate: true });
    }

    const imageId = existing?.id || null;
    const userId = existing?.user_id || null;

    // 4️⃣ Gestione degli eventi
    let newStatus = 'completata';
    let imageUrl = null;
    let failReason = null;
    let buzzCost = 0;

    switch (type) {
      case 'workflow:succeeded':
      case 'workflow.completed':
        const outputs = rest?.output?.images || rest?.images || [];
        if (outputs.length > 0) {
          imageUrl = outputs[0]?.url || outputs[0]?.temporary_url || outputs[0]?.image_url;
        }
        buzzCost = rest?.buzz_cost || rest?.output?.buzz_cost || 0;
        newStatus = 'completata';
        break;

      case 'workflow:failed':
      case 'workflow.failed':
        newStatus = 'fallita';
        failReason = rest?.reason || rest?.output?.error || rest?.error || 'Workflow fallito';
        break;

      default:
        console.warn(`Webhook: evento non gestito "${type}"`);
        return NextResponse.json({ ok: true, note: ` EventType ${type} non gestito` });
    }

    // 5️⃣ Aggiorna record (idempotente se stato già COMPLETATA/FALLITA)
    if (imageId) {
      const updateData: any = {
        stato: newStatus,
        ...(newStatus === 'completata' && {
          url_immagine: imageUrl,
          completato_il: new Date().toISOString(),
          civitai_buzz_cost: buzzCost
        }),
        ...(newStatus === 'fallita' && {
          errore: String(failReason).slice(0, 500),
          completato_il: new Date().toISOString()
        })
      };

      const { error: updateError } = await supabaseAdmin
        .from('immagini_generate')
        .update(updateData)
        .eq('id', imageId)
        .eq('stato', 'generazione');

      if (updateError) {
        console.warn('Webhook: update fallito o duplicato (potrebbe essere stato processato):', updateError);

        // Verifica: se è un duplicato, rispondi OK
        const { data: current } = await supabaseAdmin
          .from('immagini_generate')
          .select('stato')
          .eq('id', imageId)
          .single();
        if (current && ['completata', 'fallita'].includes(current.stato)) {
          return NextResponse.json({ ok: true, duplicate: true });
        }
      }

      // 6️⃣ Rollback crediti se fallimento (solo se stato == 'PENDING' quando aggiornato)
      if (newStatus === 'fallita') {
        // Riaddebita +1 credito all'utente (update diretto)
        const { data: profilo } = await supabaseAdmin
          .from('profili')
          .select('crediti')
          .eq('id', userId)
          .single();

        if (profilo) {
          await supabaseAdmin
            .from('profili')
            .update({ crediti: profilo.crediti + 1 })
            .eq('id', userId);
        }
      }
    } else if (userId && payload.output?.image_url) {
      // Fallback: crea record se non esiste (caso edge)
      try {
        await supabaseAdmin.from('immagini_generate').insert({
          user_id: userId,
          prompt: rest?.metadata?.prompt || 'Generato da Civitai',
          stato: 'completata',
          url_immagine: imageUrl,
          provider: 'civitai',
          request_id: workflowIdValue,
          civitai_buzz_cost: buzzCost,
          completato_il: new Date().toISOString()
        });
      } catch (e) {
        // Ignione errori di inserimento (es. duplicato, vincoli, etc.)
      }
    }

    return NextResponse.json({
      ok: true,
      workflowId: workflowIdValue,
      status: newStatus,
      ...(imageUrl && { imageUrl }),
    });

  } catch (error: any) {
    console.error('Webhook Civitai: errore elaborazione:', error);
    return NextResponse.json(
      { error: 'Errore elaborazione webhook', detail: String(error?.message || '').slice(0, 200) },
      { status: 200 } // Rispondi sempre 200 a Civitai
    );
  }
}