# -*- coding: utf-8 -*-
"""Implement free generations via Fal credits (claim-free-credits + rewrite eseguiFree)."""
from pathlib import Path
import re
import sys

ROOT = Path(r"C:\Users\vince\OneDrive\Desktop\JumbAI_Site")
INDEX = ROOT / "pages" / "index.tsx"
API_CLAIM = ROOT / "pages" / "api" / "claim-free-credits.js"

CLAIM_API = r'''// ============================================================
// /api/claim-free-credits — One-time free credit pool (~3)
// Grants crediti=3 to eligible new users (no videos, crediti===0).
// Never exposes secrets. Idempotent no-op otherwise.
// ============================================================
import { supabaseAdmin } from '../../lib/supabase-admin';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  const { userId } = req.body || {};
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'Parametro userId mancante.' });
  }

  try {
    const { data: profilo, error: profiloErr } = await supabaseAdmin
      .from('profili')
      .select('id, crediti')
      .eq('id', userId)
      .single();

    if (profiloErr || !profilo) {
      return res.status(404).json({ error: 'Profilo non trovato.', claimed: false, crediti: 0 });
    }

    const creditiAttuali = typeof profilo.crediti === 'number' ? profilo.crediti : 0;

    // Already has credits → no-op success
    if (creditiAttuali > 0) {
      return res.status(200).json({
        claimed: false,
        reason: 'already_has_credits',
        crediti: creditiAttuali,
      });
    }

    // Any prior video row → no-op (already used free pool / not a brand-new account)
    const { count, error: countErr } = await supabaseAdmin
      .from('video_generati')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countErr) {
      console.error('claim-free-credits count error:', countErr);
      return res.status(500).json({ error: 'Errore verifica generazioni.' });
    }

    if ((count || 0) > 0) {
      return res.status(200).json({
        claimed: false,
        reason: 'already_has_videos',
        crediti: creditiAttuali,
      });
    }

    const FREE_POOL = 3;
    const { error: updateErr } = await supabaseAdmin
      .from('profili')
      .update({ crediti: FREE_POOL })
      .eq('id', userId)
      .eq('crediti', 0);

    if (updateErr) {
      console.error('claim-free-credits update error:', updateErr);
      return res.status(500).json({ error: 'Errore assegnazione crediti gratis.' });
    }

    return res.status(200).json({
      claimed: true,
      reason: 'granted',
      crediti: FREE_POOL,
    });
  } catch (e) {
    console.error('claim-free-credits error:', e);
    return res.status(500).json({ error: 'Errore interno.' });
  }
}
'''

NEW_ESEGUI_FREE = r'''
  async function claimFreeCredits(userId: string): Promise<number | null> {
    try {
      const resp = await fetch('/api/claim-free-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        console.warn('claim-free-credits failed:', data?.error || resp.status);
        return null;
      }
      return typeof data.crediti === 'number' ? data.crediti : null;
    } catch (e) {
      console.warn('claim-free-credits network error:', e);
      return null;
    }
  }

  async function eseguiFree() {
    if (!session?.user?.id) return setShowLogin(true);
    if (!prompt.trim()) return alert('Scrivi un prompt.');

    const FAL_MODELS = ['hunyuan-video', 'hunyuan-video-pro', 'minimax-video', 'cogvideo'];
    const costo = durata <= 6 ? 1 : 2;
    const modelloFal = FAL_MODELS.includes(modello) ? modello : 'hunyuan-video';

    setInviando(true);
    setMessaggio('Preparazione generazione gratuita...');

    try {
      // Assegna pool gratis (~3) se eleggibile, poi rileggi profilo
      await claimFreeCredits(session.user.id);
      await caricaProfilo(session.user.id, { skipClaim: true });

      const { data: profiloFresh } = await supabase
        .from('profili')
        .select('crediti, credits')
        .eq('id', session.user.id)
        .single();
      const crediti = profiloFresh?.crediti ?? profiloFresh?.credits ?? 0;

      if (crediti < costo) {
        const msg =
          'Hai esaurito le generazioni gratuite incluse. Ricarica con un piano Premium (Starter o Pro) per continuare — senza chiavi Google.';
        setMessaggio(msg);
        alert(msg);
        // Offri checkout Premium (non Google billing)
        try {
          const vuole = window.confirm('Vuoi aprire il checkout Premium Starter ora?');
          if (vuole) await avviaCheckout('starter');
        } catch { /* ignore */ }
        return;
      }

      if (!FAL_MODELS.includes(modello)) {
        setMessaggio('Genera Gratis usa i crediti JumbAI su Fal (Hunyuan). Modello avanzato BYOK: sezione Sviluppatori.');
        setModello(modelloFal);
      }

      trackGenera('free');
      setMessaggio('Invio richiesta gratuita (crediti JumbAI)...');

      const body: any = {
        userId: session.user.id,
        prompt: prompt.trim(),
        modello: modelloFal,
        durata_secondi: durata,
        risoluzione,
        aspect_ratio: aspectRatio,
        genera_audio: generaAudio,
        ottimizza_prompt: ottimizzaPrompt,
        prompt_negativo: promptNegativo.trim(),
        tipo_input: tabInput,
      };
      if (seed) body.seed = parseInt(seed);
      if (tabInput !== 'testo' && fileImmagine) {
        body.immagine_base64 = await file2base64(fileImmagine);
      }

      const resp = await fetch('/api/genera-premium', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (resp.ok) {
        setMessaggio(' ' + (data.message || 'Richiesta gratuita presa in carico!'));
        setPrompt('');
        setPromptNegativo('');
        setSeed('');
        setFileImmagine(null);
        setImmaginePreview(null);
        setGeneraAudio(false);
        await caricaProfilo(session.user.id, { skipClaim: true });
      } else {
        alert(' ' + (data.error || 'Errore'));
      }
    } catch (e: any) {
      alert(' Errore: ' + (e?.message || 'sconosciuto'));
    } finally {
      setInviando(false);
      setTimeout(() => setMessaggio(''), 8000);
    }
  }
'''.lstrip('\n')


def main():
    # 1) Write claim API
    API_CLAIM.write_text(CLAIM_API, encoding='utf-8', newline='\n')
    print('Wrote', API_CLAIM)

    text = INDEX.read_text(encoding='utf-8')

    # 2) Replace eseguiFree block (keep eseguiPremium)
    pattern = re.compile(
        r'  async function eseguiFree\(\) \{.*?\n  \}\n\n  async function eseguiPremium',
        re.DOTALL,
    )
    m = pattern.search(text)
    if not m:
        print('ERROR: could not find eseguiFree block', file=sys.stderr)
        sys.exit(1)

    replacement = NEW_ESEGUI_FREE.rstrip() + '\n\n  async function eseguiPremium'
    text, n = pattern.subn(replacement, text, count=1)
    if n != 1:
        print('ERROR: eseguiFree replace count', n, file=sys.stderr)
        sys.exit(1)
    print('Rewrote eseguiFree + claimFreeCredits helper')

    # 3) Update caricaProfilo to optionally claim free credits once
    old_carica = '''  async function caricaProfilo(userId: string) {
    const { data } = await supabase.from('profili').select('*').eq('id', userId).single();
    setProfilo(data);
  }'''
    new_carica = '''  async function caricaProfilo(userId: string, opts?: { skipClaim?: boolean }) {
    if (!opts?.skipClaim) {
      try {
        await fetch('/api/claim-free-credits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });
      } catch { /* claim best-effort */ }
    }
    const { data } = await supabase.from('profili').select('*').eq('id', userId).single();
    setProfilo(data);
  }'''
    if old_carica not in text:
        print('ERROR: caricaProfilo block not found', file=sys.stderr)
        sys.exit(1)
    text = text.replace(old_carica, new_carica, 1)
    print('Updated caricaProfilo to claim free credits')

    # 4) Default modello: prefer Fal when logged in
    # Change initial state stays; add effect after byok localStorage effect
    marker = '''  useEffect(() => {
    const saved = localStorage.getItem('jumbai_byok_key');
    if (saved) setByokKey(saved);
    fetch('/ispirati/items.json')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => { if (Array.isArray(data)) setIspiratiItems(data); })
      .catch(() => {});
  }, []);'''
    inject = marker + '''

  // Logged-in users: default console model to Fal (free/premium path)
  useEffect(() => {
    if (!session) return;
    const FAL = ['hunyuan-video', 'hunyuan-video-pro', 'minimax-video', 'cogvideo'];
    setModello((prev) => (FAL.includes(prev) ? prev : 'hunyuan-video'));
  }, [session?.user?.id]);'''
    if marker not in text:
        print('WARN: byok useEffect marker not found; skip default model effect')
    else:
        text = text.replace(marker, inject, 1)
        print('Added session→hunyuan default model effect')

    # 5) Button UX: Genera Gratis without BYOK badge + note
    old_btn = '''          <div className="grid grid-cols-2 gap-3 mt-6">
            <button
              onClick={eseguiFree}
              disabled={inviando}
              className="rounded-xl bg-surface2 border border-white/[0.10] text-textMain font-semibold py-3.5 hover:bg-surface3 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {inviando ? '' : '��'} Genera Gratis <span className="text-xs text-coolGray">BYOK</span>
            </button>
            <button
              onClick={eseguiPremium}
              disabled={inviando}
              className="rounded-xl bg-gradient-to-r from-violet to-roseSoft text-white font-bold py-3.5 shadow-lg shadow-violet/30 hover:shadow-violet/50 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {inviando ? '' : ''} Genera Premium <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded-md">{costoCrediti} </span>
            </button>
          </div>'''

    # Use flexible regex because emoji may be mojibake
    btn_pat = re.compile(
        r'          <div className="grid grid-cols-2 gap-3 mt-6">\n'
        r'            <button\n'
        r'              onClick=\{eseguiFree\}.*?Genera Gratis.*?</button>\n'
        r'            <button\n'
        r'              onClick=\{eseguiPremium\}.*?Genera Premium.*?</button>\n'
        r'          </div>',
        re.DOTALL,
    )
    new_btn = '''          <div className="grid grid-cols-2 gap-3 mt-6">
            <button
              onClick={eseguiFree}
              disabled={inviando}
              className="rounded-xl bg-surface2 border border-white/[0.10] text-textMain font-semibold py-3.5 hover:bg-surface3 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {inviando ? '...' : ''} Genera Gratis
              {session ? (
                <span className="text-xs text-coolGray">{costoCrediti} cr</span>
              ) : null}
            </button>
            <button
              onClick={eseguiPremium}
              disabled={inviando}
              className="rounded-xl bg-gradient-to-r from-violet to-roseSoft text-white font-bold py-3.5 shadow-lg shadow-violet/30 hover:shadow-violet/50 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {inviando ? '...' : ''} Genera Premium <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded-md">{costoCrediti} cr</span>
            </button>
          </div>
          <p className="mt-2 text-xs text-coolGray text-center">
            Genera Gratis usa i crediti JumbAI (pool iniziale ~3). BYOK avanzato: sezione Sviluppatori.
          </p>'''
    mbtn = btn_pat.search(text)
    if not mbtn:
        print('ERROR: action buttons block not found', file=sys.stderr)
        sys.exit(1)
    text = btn_pat.sub(new_btn, text, count=1)
    print('Updated Genera Gratis button UX')

    # 6) Model select: Veo for logged-in is advanced note, not "Gratis"
    text2, nsel = re.subn(
        r'<option value="veo-3\.1-generate-preview">Veo 3\.1 \(BYOK[^<]*\)</option>',
        '<option value="veo-3.1-generate-preview">Veo 3.1 (BYOK avanzato — Sviluppatori)</option>',
        text,
        count=1,
    )
    if nsel:
        text = text2
        print('Updated Veo option label')
    else:
        print('WARN: Veo option label not updated')

    # 7) Free plan card copy
    old_free_p = 'BYOK: porta la tua API Key. Zero costi server.'
    new_free_p = 'Include ~3 generazioni gratis con crediti JumbAI. BYOK opzionale in Sviluppatori.'
    if old_free_p in text:
        text = text.replace(old_free_p, new_free_p, 1)
        print('Updated Free plan blurb')
    else:
        print('WARN: Free plan blurb not found')

    old_free_ul = '''              <ul className="text-sm text-coolGray space-y-2 mb-6">
                <li>Chiave solo in localStorage</li>
                <li>Genera Gratis (Gemini testo)</li>
                <li>Non salva in Progetti (solo Premium)</li>
              </ul>'''
    new_free_ul = '''              <ul className="text-sm text-coolGray space-y-2 mb-6">
                <li>~3 video gratis (crediti JumbAI / Fal)</li>
                <li>Nessuna fatturazione Google richiesta</li>
                <li>BYOK opzionale in Sviluppatori</li>
              </ul>'''
    if old_free_ul in text:
        text = text.replace(old_free_ul, new_free_ul, 1)
        print('Updated Free plan bullets')
    else:
        print('WARN: Free plan bullets not found exactly')

    # 8) Sviluppatori help text
    old_svil_intro = '''          <p className="text-sm text-coolGray mt-1">
            Porta la tua chiave (Bring Your Own Key). La chiave resta <strong>solo</strong> nel tuo browser.
          </p>'''
    new_svil_intro = '''          <p className="text-sm text-coolGray mt-1">
            BYOK è <strong>opzionale e avanzato</strong>: le generazioni gratuite usano i crediti JumbAI (Fal).
            Se usi una tua chiave, resta <strong>solo</strong> nel tuo browser — non serve abilitare fatturazione Google per usare Genera Gratis.
          </p>'''
    if old_svil_intro in text:
        text = text.replace(old_svil_intro, new_svil_intro, 1)
        print('Updated Sviluppatori intro')
    else:
        print('WARN: Sviluppatori intro not found')

    old_ol = '''            <ol className="text-sm text-coolGray space-y-2 list-decimal list-inside">
              <li>Vai su <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-violetSoft hover:underline">Google AI Studio</a> e genera una API Key gratuita</li>
              <li>Oppure usa <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noreferrer" className="text-violetSoft hover:underline">HuggingFace Tokens</a></li>
              <li>Incolla la chiave qui sopra e clicca Salva</li>
              <li>Usa il pulsante <strong>&quot;Genera Gratis BYOK&quot;</strong> nella Console</li>
            </ol>'''
    new_ol = '''            <ol className="text-sm text-coolGray space-y-2 list-decimal list-inside">
              <li>Per generare gratis: accedi e usa <strong>&quot;Genera Gratis&quot;</strong> in Casa (crediti JumbAI, nessuna chiave Google)</li>
              <li>BYOK opzionale: genera una API Key su <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-violetSoft hover:underline">Google AI Studio</a> oppure un token <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noreferrer" className="text-violetSoft hover:underline">HuggingFace</a></li>
              <li>Incolla la chiave qui sopra e clicca Salva (resta in localStorage)</li>
              <li>BYOK non richiede di abilitare la fatturazione Google per usare le generazioni gratuite JumbAI</li>
            </ol>'''
    if old_ol in text:
        text = text.replace(old_ol, new_ol, 1)
        print('Updated Sviluppatori how-to list')
    else:
        print('WARN: Sviluppatori ol not found')

    # Privacy note tweak: calls go via our BYOK proxy APIs actually, but leave mostly; add free path note
    old_priv = '''              <li>Costo server per il gestore: <strong>€0</strong></li>'''
    # may be mojibake euro
    priv_pat = re.compile(
        r'<li>Costo server per il gestore: <strong>[^<]*</strong></li>'
    )
    text, np = priv_pat.subn(
        '<li>Le generazioni gratuite JumbAI usano i crediti piattaforma (Fal), non la tua chiave</li>',
        text,
        count=1,
    )
    print('Privacy bullet update count:', np)

    # 9) Onboarding copy
    text = text.replace(
        'premi Genera Gratis (BYOK) oppure Genera Premium.',
        'premi Genera Gratis (crediti JumbAI) oppure Genera Premium.',
        1,
    )
    # Free resta BYOK...
    text, nob = re.subn(
        r'Free resta BYOK[^.<]*\.',
        'i nuovi account ricevono ~3 crediti gratis; BYOK resta opzionale in Sviluppatori.',
        text,
        count=1,
    )
    print('Onboarding credits sentence updates:', nob)

    # Move avviaCheckout before eseguiFree? eseguiFree calls avviaCheckout which is defined later.
    # In JS function declarations inside component are const/async function — async function are NOT hoisted
    # like function declarations in the same scope... Actually `async function foo()` inside another function
    # IS hoisted within that function body in JS. Function declarations are hoisted in their scope.
    # So avviaCheckout defined later as `async function avviaCheckout` should be fine when eseguiFree runs.
    # Good.

    INDEX.write_text(text, encoding='utf-8', newline='\n')
    print('Wrote', INDEX)
    print('DONE')


if __name__ == '__main__':
    main()
