# -*- coding: utf-8 -*-
"""Atomic rewrite of eseguiFree + small model-select tweak for BYOK Veo."""
from pathlib import Path
import re
import sys

ROOT = Path(r"C:\Users\vince\OneDrive\Desktop\JumbAI_Site")
INDEX = ROOT / "pages" / "index.tsx"
API = ROOT / "pages" / "api"

NEW_ESEGUI_FREE = r'''
  async function eseguiFree() {
    if (!byokKey.trim()) return alert('Inserisci la tua API Key BYOK nella sezione Sviluppatori.');
    if (!prompt.trim()) return alert('Scrivi un prompt.');

    const FAL_MODELS = ['hunyuan-video', 'hunyuan-video-pro', 'minimax-video', 'cogvideo'];
    let veoModel = modello;
    if (FAL_MODELS.includes(modello)) {
      alert('Genera Gratis richiede un modello BYOK Veo/Gemini video (es. Veo 3.1). I modelli Fal (Hunyuan/MiniMax/CogVideo) sono solo Premium.');
      return;
    }
    if (modello.startsWith('gemini-')) {
      veoModel = 'veo-3.1-generate-preview';
      setMessaggio('Il modello testo Gemini non genera video: uso Veo 3.1 (BYOK).');
    } else if (modello.startsWith('veo-')) {
      veoModel = modello;
    } else {
      veoModel = 'veo-3.1-generate-preview';
      setMessaggio('Modello non riconosciuto per BYOK: uso Veo 3.1.');
    }

    trackGenera('free');
    setInviando(true);
    const apiKey = byokKey.trim();
    const promptUsato = prompt.trim();

    try {
      setMessaggio('Avvio generazione Veo BYOK...');

      let immagine_base64: string | null = null;
      if (tabInput !== 'testo' && fileImmagine) {
        immagine_base64 = await file2base64(fileImmagine);
      }

      const startResp = await fetch('/api/byok-veo-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          prompt: ottimizzaPrompt
            ? `${promptUsato}. Cinematic, high quality, detailed scene, smooth camera movement, professional lighting.`
            : promptUsato,
          model: veoModel,
          durata_secondi: durata,
          risoluzione,
          aspect_ratio: aspectRatio,
          genera_audio: generaAudio,
          prompt_negativo: promptNegativo.trim() || undefined,
          immagine_base64: immagine_base64 || undefined,
        }),
      });
      const startData = await startResp.json();
      if (!startResp.ok) {
        throw new Error(startData?.error || `Avvio fallito (${startResp.status})`);
      }
      const operationName = startData.operationName as string;
      if (!operationName) throw new Error('operationName mancante dalla risposta start.');

      // Poll until done or timeout (~12 min)
      const pollMs = 6000;
      const maxAttempts = 120;
      let videoUri: string | null = null;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        setMessaggio(`Generazione in corso… (tentativo ${attempt}/${maxAttempts})`);
        await new Promise((r) => setTimeout(r, pollMs));

        const stResp = await fetch('/api/byok-veo-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey, operationName }),
        });
        const stData = await stResp.json();
        if (!stResp.ok) {
          throw new Error(stData?.error || `Status fallito (${stResp.status})`);
        }
        if (stData.error) {
          throw new Error(stData.error);
        }
        if (stData.done) {
          videoUri = stData.videoUri || null;
          if (!videoUri) {
            throw new Error('Generazione completata ma videoUri assente nella risposta Google.');
          }
          break;
        }
      }
      if (!videoUri) {
        throw new Error('Timeout: la generazione Veo non è terminata entro ~12 minuti.');
      }

      setMessaggio('Download video in corso…');
      const dlResp = await fetch('/api/byok-veo-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, videoUri }),
      });
      if (!dlResp.ok) {
        let errMsg = `Download fallito (${dlResp.status})`;
        try {
          const errJson = await dlResp.json();
          errMsg = errJson?.error || errMsg;
        } catch {}
        throw new Error(errMsg);
      }
      const blob = await dlResp.blob();
      const objectUrl = URL.createObjectURL(blob);

      // Prefer clear DOWNLOAD to user device
      try {
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = `jumbai-byok-${Date.now()}.mp4`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch {}

      const localId = `byok-local-${Date.now()}`;
      const nowIso = new Date().toISOString();
      const localVideo: Video = {
        id: localId,
        user_id: session?.user?.id || 'local',
        titolo: promptUsato.substring(0, 60) || 'BYOK Veo',
        prompt: promptUsato,
        prompt_negativo: promptNegativo.trim(),
        seed: seed ? parseInt(seed) : null,
        modello: veoModel,
        tipo_input: tabInput,
        immagine_url: null,
        durata_secondi: durata,
        risoluzione,
        genera_audio: generaAudio,
        ottimizza_prompt: ottimizzaPrompt,
        stato: 'completato',
        url_video: objectUrl,
        url_anteprima: null,
        errore: null,
        creato_il: nowIso,
        completato_il: nowIso,
      };
      setVideos((prev) => [localVideo, ...prev]);

      // Persist metadata if logged in (url may be blob — still useful for Progetti list)
      if (session?.user?.id) {
        try {
          const { data: inserted, error: insertErr } = await supabase
            .from('video_generati')
            .insert({
              user_id: session.user.id,
              prompt: promptUsato,
              prompt_negativo: promptNegativo.trim(),
              seed: seed ? parseInt(seed) : null,
              modello: veoModel,
              tipo_input: tabInput,
              durata_secondi: durata,
              risoluzione,
              genera_audio: generaAudio,
              ottimizza_prompt: ottimizzaPrompt,
              titolo: promptUsato.substring(0, 60),
              stato: 'completato',
              url_video: objectUrl,
              request_id: operationName,
              completato_il: nowIso,
            })
            .select('*')
            .single();
          if (insertErr) {
            console.warn('BYOK insert video_generati:', insertErr);
          } else if (inserted) {
            setVideos((prev) => {
              const withoutLocal = prev.filter((v) => v.id !== localId);
              return [inserted as Video, ...withoutLocal];
            });
          }
        } catch (dbE) {
          console.warn('BYOK DB save skipped:', dbE);
        }
      }

      setMessaggio('Video BYOK pronto — anteprima in galleria e download avviato.');
      setTimeout(() => setMessaggio(''), 8000);
    } catch (e: any) {
      const msg = e?.message || 'richiesta fallita';
      console.error('BYOK Veo error:', e);
      setMessaggio('Errore BYOK: ' + msg);
      alert('Errore BYOK Veo: ' + msg);
      setTimeout(() => setMessaggio(''), 10000);
    } finally {
      setInviando(false);
    }
  }
'''.lstrip('\n')

def main():
    text = INDEX.read_text(encoding='utf-8')
    # Match from "async function eseguiFree()" through the closing brace before eseguiPremium
    pattern = re.compile(
        r'  async function eseguiFree\(\) \{.*?\n  \}\n\n  async function eseguiPremium',
        re.DOTALL,
    )
    m = pattern.search(text)
    if not m:
        print('ERROR: could not find eseguiFree block', file=sys.stderr)
        sys.exit(1)

    replacement = NEW_ESEGUI_FREE.rstrip() + '\n\n  async function eseguiPremium'
    text2, n = pattern.subn(replacement, text, count=1)
    if n != 1:
        print('ERROR: replace count', n, file=sys.stderr)
        sys.exit(1)

    # Ensure logged-in users can also pick Veo for Genera Gratis
    old_select = '''              {session ? (
                <>
                  <option value="hunyuan-video">Hunyuan Video (Standard)</option>
                  <option value="hunyuan-video-pro">Hunyuan Video Pro </option>
                  <option value="minimax-video">MiniMax Video</option>
                  <option value="cogvideo">CogVideoX</option>
                </>
              ) : (
                <>
                  <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash (BYOK)</option>
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro (BYOK)</option>
                  <option value="veo-3.1-generate-preview">Veo 3.1 (BYOK)</option>
                </>
              )}'''

    new_select = '''              {session ? (
                <>
                  <option value="hunyuan-video">Hunyuan Video (Standard)</option>
                  <option value="hunyuan-video-pro">Hunyuan Video Pro </option>
                  <option value="minimax-video">MiniMax Video</option>
                  <option value="cogvideo">CogVideoX</option>
                  <option value="veo-3.1-generate-preview">Veo 3.1 (BYOK Gratis)</option>
                </>
              ) : (
                <>
                  <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash (BYOK → Veo)</option>
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro (BYOK → Veo)</option>
                  <option value="veo-3.1-generate-preview">Veo 3.1 (BYOK)</option>
                </>
              )}'''

    if old_select in text2:
        text2 = text2.replace(old_select, new_select, 1)
        print('Updated model select for logged-in Veo option')
    else:
        print('WARN: model select block not found exactly; skipping select tweak')

    INDEX.write_text(text2, encoding='utf-8', newline='\n')
    print('Rewrote eseguiFree in', INDEX)
    print('eseguiFree length chars:', len(NEW_ESEGUI_FREE))

if __name__ == '__main__':
    main()
