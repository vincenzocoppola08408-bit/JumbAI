# -*- coding: utf-8 -*-
"""Patch pages/index.tsx for Wan Genera Gratis + Immagine + img render."""
from pathlib import Path

path = Path(r"C:\Users\vince\OneDrive\Desktop\JumbAI_Site\pages\index.tsx")
text = path.read_text(encoding="utf-8")
orig = text

# --- helper: pollWanStatus function insert before eseguiFree ---
POLL_FN = r'''
  async function pollWanUntilDone(taskId: string, videoId: string | null, userId: string) {
    const maxAttempts = 36; // ~6 min at 10s
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 10000));
      try {
        const resp = await fetch('/api/wan-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId, videoId, userId }),
        });
        const data = await resp.json();
        if (!resp.ok) {
          console.warn('wan-status error', data);
          continue;
        }
        const st = data.status;
        if (st === 'SUCCEEDED') {
          await caricaVideo();
          await caricaProfilo(userId, { skipClaim: true });
          setMessaggio('Generazione Wan completata — vedi Progetti.');
          return true;
        }
        if (st === 'FAILED' || st === 'CANCELED' || st === 'UNKNOWN') {
          await caricaVideo();
          setMessaggio('Generazione Wan fallita (nessuno storno crediti).');
          return false;
        }
        setMessaggio(`Wan in corso (${st || 'PENDING'})… tentativo ${i + 1}/${maxAttempts}`);
        await caricaVideo();
      } catch (e) {
        console.warn('wan poll', e);
      }
    }
    setMessaggio('Timeout polling Wan (~6 min). Controlla Progetti piu tardi.');
    await caricaVideo();
    return false;
  }

  function isImageMediaUrl(url: string | null | undefined): boolean {
    if (!url) return false;
    const u = String(url).toLowerCase().split('?')[0];
    return /\.(png|jpe?g|webp|gif)$/.test(u) || u.includes('/image') || u.includes('.png');
  }

'''

if "pollWanUntilDone" not in text:
    marker = "  async function eseguiFree() {"
    if marker not in text:
        raise SystemExit("eseguiFree marker not found")
    text = text.replace(marker, POLL_FN + marker, 1)

# --- replace eseguiFree body (from function start through closing brace before eseguiPremium) ---
OLD_FREE_START = "  async function eseguiFree() {"
OLD_PREMIUM = "  async function eseguiPremium() {"
i0 = text.find(OLD_FREE_START)
i1 = text.find(OLD_PREMIUM)
if i0 < 0 or i1 < 0:
    raise SystemExit(f"markers free/premium not found {i0} {i1}")

NEW_FREE = r'''  async function eseguiFree() {
    if (!session?.user?.id) return setShowLogin(true);
    if (!prompt.trim()) return alert('Scrivi un prompt.');

    const costo = durata <= 6 ? 1 : 2;

    setInviando(true);
    setMessaggio('Preparazione generazione gratuita (Wan / DashScope)...');

    try {
      await claimFreeCredits(session.user.id);
      await caricaProfilo(session.user.id, { skipClaim: true });

      const { data: profiloFresh } = await supabase
        .from('profili')
        .select('crediti')
        .eq('id', session.user.id)
        .single();
      const crediti = profiloFresh?.crediti ?? 0;

      if (crediti < costo) {
        const msg =
          'Hai esaurito le generazioni gratuite incluse. Ricarica con un piano Premium (Starter o Pro) per continuare - senza chiavi Google.';
        setMessaggio(msg);
        alert(msg);
        try {
          const vuole = window.confirm('Vuoi aprire il checkout Premium Starter ora?');
          if (vuole) await avviaCheckout('starter');
        } catch { /* ignore */ }
        return;
      }

      trackGenera('free');
      setMessaggio('Invio richiesta gratuita Wan (crediti JumbAI)...');

      const body: any = {
        userId: session.user.id,
        prompt: prompt.trim(),
        durata_secondi: durata,
        risoluzione,
        aspect_ratio: aspectRatio,
        ottimizza_prompt: ottimizzaPrompt,
        prompt_negativo: promptNegativo.trim(),
        tipo_input: tabInput,
      };
      if (seed) body.seed = parseInt(seed);
      if (tabInput !== 'testo' && fileImmagine) {
        // Wan I2V needs a public URL; base64 alone falls back to T2V server-side
        body.immagine_base64 = await file2base64(fileImmagine);
      }

      const resp = await fetch('/api/genera-free', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (resp.ok) {
        setMessaggio(' ' + (data.message || 'Richiesta Wan presa in carico!'));
        setPrompt('');
        setPromptNegativo('');
        setSeed('');
        setFileImmagine(null);
        setImmaginePreview(null);
        setGeneraAudio(false);
        await caricaProfilo(session.user.id, { skipClaim: true });
        await caricaVideo();
        setSezione('progetti');
        setFiltroGalleria('tutti');
        if (data.task_id) {
          void pollWanUntilDone(data.task_id, data.video_id || null, session.user.id);
        } else {
          setTimeout(() => { void caricaVideo(); }, 2500);
          setTimeout(() => { void caricaVideo(); }, 8000);
        }
      } else {
        const detail = data.providerMessage || data.providerCode || data.error || 'Errore';
        alert(' ' + detail);
      }
    } catch (e: any) {
      alert(' Errore: ' + (e?.message || 'sconosciuto'));
    } finally {
      setInviando(false);
      setTimeout(() => setMessaggio(''), 8000);
    }
  }

  async function eseguiImmagineFree() {
    if (!session?.user?.id) return setShowLogin(true);
    if (!prompt.trim()) return alert('Scrivi un prompt per l\'immagine.');

    setInviando(true);
    setMessaggio('Preparazione immagine gratuita (Wan T2I)...');
    try {
      await claimFreeCredits(session.user.id);
      await caricaProfilo(session.user.id, { skipClaim: true });

      const { data: profiloFresh } = await supabase
        .from('profili')
        .select('crediti')
        .eq('id', session.user.id)
        .single();
      const crediti = profiloFresh?.crediti ?? 0;
      if (crediti < 1) {
        const msg = 'Serve almeno 1 credito per Genera Immagine Gratis.';
        setMessaggio(msg);
        alert(msg);
        return;
      }

      trackGenera('free');
      const resp = await fetch('/api/genera-immagine-free', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          prompt: prompt.trim(),
          prompt_negativo: promptNegativo.trim(),
          seed: seed ? parseInt(seed) : null,
          ottimizza_prompt: ottimizzaPrompt,
        }),
      });
      const data = await resp.json();
      if (resp.ok) {
        setMessaggio(data.message || 'Immagine Wan in coda.');
        setPrompt('');
        setPromptNegativo('');
        setSeed('');
        await caricaProfilo(session.user.id, { skipClaim: true });
        await caricaVideo();
        setSezione('progetti');
        setFiltroGalleria('tutti');
        if (data.task_id) {
          void pollWanUntilDone(data.task_id, data.video_id || null, session.user.id);
        }
      } else {
        alert(data.providerMessage || data.error || 'Errore immagine');
      }
    } catch (e: any) {
      alert('Errore: ' + (e?.message || 'sconosciuto'));
    } finally {
      setInviando(false);
      setTimeout(() => setMessaggio(''), 8000);
    }
  }

'''

text = text[:i0] + NEW_FREE + text[i1:]

# --- UI: add Immagine Gratis button + update help text ---
OLD_ACTIONS = '''          {/* Actions */}
          <div className="grid grid-cols-2 gap-3 mt-6">
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

NEW_ACTIONS = '''          {/* Actions */}
          <div className="grid grid-cols-2 gap-3 mt-6">
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
          <div className="mt-2">
            <button
              type="button"
              onClick={eseguiImmagineFree}
              disabled={inviando}
              className="w-full rounded-xl bg-surface2/80 border border-white/[0.08] text-textMain text-sm font-medium py-2.5 hover:bg-surface3 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {inviando ? '...' : ''} Genera Immagine Gratis
              {session ? <span className="text-xs text-coolGray ml-2">1 cr</span> : null}
            </button>
          </div>
          <p className="mt-2 text-xs text-coolGray text-center">
            Genera Gratis = Wan (DashScope Singapore, crediti JumbAI). Premium = Fal. BYOK: Sviluppatori.
          </p>'''

if OLD_ACTIONS not in text:
    raise SystemExit("OLD_ACTIONS block not found — check encoding")
text = text.replace(OLD_ACTIONS, NEW_ACTIONS, 1)

# --- Progetti: render img for image URLs ---
OLD_VIDEO = '''                  ) : video.stato === 'completato' && video.url_video ? (
                    <>
                      <video
                        src={video.url_video}
                        className="w-full h-full object-cover"
                        controls
                        preload="metadata"
                      />'''

NEW_VIDEO = '''                  ) : video.stato === 'completato' && video.url_video ? (
                    <>
                      {isImageMediaUrl(video.url_video) ? (
                        <img
                          src={video.url_video}
                          alt={video.prompt || 'Immagine generata'}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                      <video
                        src={video.url_video}
                        className="w-full h-full object-cover"
                        controls
                        preload="metadata"
                      />
                      )}'''

if OLD_VIDEO not in text:
    raise SystemExit("OLD_VIDEO block not found")
text = text.replace(OLD_VIDEO, NEW_VIDEO, 1)

# Soft text updates for Fal references in free path help (minimal)
text = text.replace(
    "Genera Gratis usa i crediti JumbAI su Fal (Hunyuan). Modello avanzato BYOK: sezione Sviluppatori.",
    "Genera Gratis usa Wan/DashScope + crediti JumbAI. Modello avanzato BYOK: sezione Sviluppatori.",
)
text = text.replace(
    "Usa il prompt della sezione Casa. Genera Gratis resta su Fal + crediti JumbAI.",
    "Usa il prompt della sezione Casa. Genera Gratis = Wan (DashScope) + crediti JumbAI.",
)

if text == orig:
    raise SystemExit("No changes applied")

path.write_text(text, encoding="utf-8")
print("Patched index.tsx OK, len", len(text))
