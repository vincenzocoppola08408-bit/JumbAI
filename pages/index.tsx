/* encoding-safe-unicode-v4: emoji removed from chrome */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase-client';
import { signInWithGoogle } from '../lib/auth-google';
import { trackGenera, trackCheckout } from '../lib/analytics';

// ================================================================
// JumbAI 2.0 — Full Dashboard: Sidebar + Console + Gallery + Auth
// ================================================================

type Sezione = 'casa' | 'progetti' | 'integrazioni' | 'sviluppatori';
type TabInput = 'testo' | 'immagine' | 'frame' | 'multiple';
type FiltroGalleria = 'tutti' | 'rendering' | 'completato' | 'fallito';
type StatoVideo = 'rendering' | 'completato' | 'fallito';

interface Video {
  id: string;
  user_id: string;
  titolo: string;
  prompt: string;
  prompt_negativo: string;
  seed: number | null;
  modello: string;
  tipo_input: TabInput;
  immagine_url: string | null;
  durata_secondi: number;
  risoluzione: string;
  genera_audio: boolean;
  ottimizza_prompt: boolean;
  stato: StatoVideo;
  url_video: string | null;
  url_anteprima: string | null;
  errore: string | null;
  creato_il: string;
  completato_il: string | null;
}

// Legacy DB video_generati (id, user_id, url_video, prompt_usato, creato_il): derive UI fields
function normalizzaVideo(r: any): Video {
  const url: string | null = r?.url_video ?? null;
  let stato: StatoVideo = r?.stato;
  if (!stato) {
    if (url && String(url).startsWith('http')) stato = 'completato';
    else if (url === 'failed' || url === 'fallito') stato = 'fallito';
    else stato = 'rendering';
  }
  const prompt = r?.prompt ?? r?.prompt_usato ?? '';
  return {
    ...r,
    prompt,
    titolo: r?.titolo ?? String(prompt).substring(0, 60),
    stato,
    url_video: url && String(url).startsWith('http') ? url : (stato === 'completato' ? url : null),
  } as Video;
}

export default function Home() {
  // ---- Auth ----
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [profilo, setProfilo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // ---- UI ----
  const [sezione, setSezione] = useState<Sezione>('casa');
  const [tabInput, setTabInput] = useState<TabInput>('testo');
  const [filtroGalleria, setFiltroGalleria] = useState<FiltroGalleria>('tutti');

  // ---- Form ----
  const [prompt, setPrompt] = useState('');
  const [promptNegativo, setPromptNegativo] = useState('');
  const [seed, setSeed] = useState('');
  const [modello, setModello] = useState('gemini-2.0-flash-exp');
  const [durata, setDurata] = useState(4);
  const [risoluzione, setRisoluzione] = useState('720p');
  // ADD-8: aspect_ratio per Fal Premium (9:16 | 16:9); nascosto in BYOK
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [generaAudio, setGeneraAudio] = useState(false);
  const [ottimizzaPrompt, setOttimizzaPrompt] = useState(true);
  const [fileImmagine, setFileImmagine] = useState<File | null>(null);
  const [immaginePreview, setImmaginePreview] = useState<string | null>(null);
  const [showAvanzate, setShowAvanzate] = useState(false);

  // ---- BYOK ----
  const [byokKey, setByokKey] = useState('');

  // ---- Videos ----
  const [videos, setVideos] = useState<Video[]>([]);
  const [inviando, setInviando] = useState(false);
  const [messaggio, setMessaggio] = useState('');

  // ---- Modali ----
  const [showLogin, setShowLogin] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistrazione, setIsRegistrazione] = useState(false);

  // ---- Onboarding (ADD-2) ----
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  // ADD-9 gallery Ispirati
  const [ispiratiItems, setIspiratiItems] = useState<{id:string;titolo:string;prompt:string;gradient:string}[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ============ AUTH ============
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) caricaProfilo(session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user?.id) caricaProfilo(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (byokKey) localStorage.setItem('jumbai_byok_key', byokKey);
  }, [byokKey]);

  useEffect(() => {
    const saved = localStorage.getItem('jumbai_byok_key');
    if (saved) setByokKey(saved);
    fetch('/ispirati/items.json')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => { if (Array.isArray(data)) setIspiratiItems(data); })
      .catch(() => {});
  }, []);

  // Logged-in users: default console model to Fal (free/premium path)
  useEffect(() => {
    if (!session) return;
    const FAL = ['hunyuan-video', 'hunyuan-video-pro', 'minimax-video', 'cogvideo'];
    setModello((prev) => (FAL.includes(prev) ? prev : 'hunyuan-video'));
  }, [session?.user?.id]);

  // Onboarding: mostra solo al primo login (flag localStorage.jumbai_onboarded = '1')
  useEffect(() => {
    if (!session) {
      setShowOnboarding(false);
      return;
    }
    try {
      const flag = localStorage.getItem('jumbai_onboarded');
      if (flag !== '1') setShowOnboarding(true);
    } catch {
      setShowOnboarding(true);
    }
  }, [session]);

  function completaOnboarding() {
    try {
      localStorage.setItem('jumbai_onboarded', '1');
    } catch { /* ignore */ }
    setShowOnboarding(false);
    setOnboardingStep(0);
  }

  async function caricaProfilo(userId: string, opts?: { skipClaim?: boolean }) {
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
  }

  // ============ SUPABASE REALTIME ============
  useEffect(() => {
    if (!session?.user?.id) return;

    caricaVideo();

    const channel = supabase
      .channel('video_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'video_generati',
          filter: `user_id=eq.${session.user.id}`,
        },
        (payload) => {
          const raw = payload.new as any;
          if (!raw || !raw.id) return;
          const nuovo = normalizzaVideo(raw);
          setVideos((prev) => {
            const idx = prev.findIndex((v) => v.id === nuovo.id);
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = normalizzaVideo({ ...copy[idx], ...raw });
              return copy;
            }
            return [nuovo, ...prev];
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session?.user?.id]);

  async function caricaVideo() {
    if (!session?.user?.id) return;
    const { data } = await supabase
      .from('video_generati')
      .select('*')
      .eq('user_id', session.user.id)
      .order('creato_il', { ascending: false });
    if (data) setVideos((data as any[]).map(normalizzaVideo));
  }

  // ============ LOGIN / REGISTRAZIONE ============
  async function handleAuth() {
    if (isRegistrazione) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) return alert(error.message);
      alert('Registrazione effettuata! Controlla la tua email per confermare.');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return alert(error.message);
    }
    setShowLogin(false);
    setEmail('');
    setPassword('');
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setSession(null);
    setProfilo(null);
    setVideos([]);
  }

  // ============ BYOK KEY ============
  function salvaByok() {
    if (!byokKey.trim()) return alert('Inserisci la chiave');
    localStorage.setItem('jumbai_byok_key', byokKey.trim());
    alert(' Chiave BYOK salvata localmente. Il server non la vede mai.');
  }

  function setTabInputSafe(tab: TabInput) {
    if (tab !== 'testo') {
      setMessaggio('Image-to-video: Presto. Per ora usa input Testo (Fal testo-video).');
      setTimeout(() => setMessaggio(''), 5000);
      return;
    }
    setTabInput(tab);
  }

  // ============ FILE IMMAGINE ============
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileImmagine(file);
    setImmaginePreview(URL.createObjectURL(file));
  }

  // ============ GENERAZIONE ============
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


  async function eseguiByokVeo() {
    if (!byokKey.trim()) return alert('Inserisci e salva la tua API Key BYOK.');
    if (!prompt.trim()) return alert('Scrivi un prompt nella sezione Casa prima di generare con BYOK.');
    if (!session?.user?.id) return setShowLogin(true);

    const apiKey = byokKey.trim();
    const veoModel = modello.startsWith('veo-') ? modello : 'veo-3.1-generate-preview';
    trackGenera('byok');
    setInviando(true);
    setMessaggio('Avvio Veo BYOK...');
    try {
      let immagine_base64: string | null = null;
      if (tabInput !== 'testo' && fileImmagine) {
        immagine_base64 = await file2base64(fileImmagine);
      }
      const startResp = await fetch('/api/byok-veo-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          prompt: prompt.trim(),
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
      if (!startResp.ok) throw new Error(startData?.error || `Avvio fallito (${startResp.status})`);
      const operationName = startData.operationName as string;
      if (!operationName) throw new Error('operationName mancante');

      let videoUri: string | null = null;
      for (let attempt = 1; attempt <= 120; attempt++) {
        setMessaggio(`Veo BYOK in corso… (${attempt}/120)`);
        await new Promise((r) => setTimeout(r, 6000));
        const stResp = await fetch('/api/byok-veo-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey, operationName }),
        });
        const stData = await stResp.json();
        if (!stResp.ok) throw new Error(stData?.error || `Status fallito (${stResp.status})`);
        if (stData.error) throw new Error(stData.error);
        if (stData.done) {
          videoUri = stData.videoUri || null;
          if (!videoUri) throw new Error('videoUri assente');
          break;
        }
      }
      if (!videoUri) throw new Error('Timeout Veo BYOK (~12 min)');

      setMessaggio('Download video BYOK…');
      const dlResp = await fetch('/api/byok-veo-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, videoUri }),
      });
      if (!dlResp.ok) {
        const err = await dlResp.json().catch(() => ({}));
        throw new Error(err?.error || `Download fallito (${dlResp.status})`);
      }
      const blob = await dlResp.blob();
      const localUrl = URL.createObjectURL(blob);

      const { data: inserted, error: insertErr } = await supabase
        .from('video_generati')
        .insert({
          user_id: session.user.id,
          prompt_usato: prompt.trim(),
          url_video: videoUri,
        })
        .select('id')
        .single();
      if (insertErr) console.warn('BYOK insert video_generati:', insertErr);

      setMessaggio('BYOK completato — video in Progetti');
      await caricaVideo();
      setSezione('progetti');
      const a = document.createElement('a');
      a.href = localUrl;
      a.download = `jumbai-byok-${inserted?.id || Date.now()}.mp4`;
      a.click();
    } catch (e: any) {
      alert('BYOK: ' + (e?.message || 'errore'));
      setMessaggio('');
    } finally {
      setInviando(false);
      setTimeout(() => setMessaggio(''), 8000);
    }
  }


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

  async function eseguiFree() {
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

  async function eseguiPremium() {
    if (!session) return setShowLogin(true);
    if (!prompt.trim()) return alert('Scrivi un prompt.');
    trackGenera('premium');
    setInviando(true);
    setMessaggio('Invio richiesta Premium...');
    try {
      const body: any = {
        userId: session.user.id,
        prompt: prompt.trim(),
        modello,
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
        setMessaggio(' ' + (data.message || 'Richiesta presa in carico!'));
        setPrompt('');
        setPromptNegativo('');
        setSeed('');
        setFileImmagine(null);
        setImmaginePreview(null);
        setGeneraAudio(false);
        // Aggiorna badge crediti dopo consumo Premium + galleria Progetti
        if (session?.user?.id) await caricaProfilo(session.user.id);
        await caricaVideo();
        setSezione('progetti');
        setFiltroGalleria('tutti');
        setTimeout(() => { void caricaVideo(); }, 2500);
        setTimeout(() => { void caricaVideo(); }, 8000);
      } else {
        alert(' ' + (data.error || 'Errore'));
      }
    } catch (e: any) {
      alert(' Errore: ' + e.message);
    } finally {
      setInviando(false);
      setTimeout(() => setMessaggio(''), 5000);
    }
  }

  function file2base64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ============ STRIPE CHECKOUT ============
  async function avviaCheckout(pacchetto: 'starter' | 'pro') {
    if (!session?.user?.id) {
      setShowLogin(true);
      return;
    }
    trackCheckout(pacchetto);
    try {
      const resp = await fetch('/api/crea-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: session.user.id, pacchetto }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        alert(data.error || 'Errore creazione checkout.');
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert('URL checkout mancante.');
      }
    } catch (e: any) {
      alert('Errore checkout: ' + (e?.message || 'sconosciuto'));
    }
  }

  function etichettaPiano(pacchetto: 'starter' | 'pro'): { label: string; disabled: boolean } {
    const piano = (profilo?.piano || 'free') as string;
    // Schema attuale: piano in ('free','premium') — non distingue starter vs pro.
    // Se premium: "Cambia piano" (ricarica). Se in futuro piano===starter|pro, marca solo quel piano.
    if (piano === pacchetto) {
      return { label: 'Già in utilizzo', disabled: true };
    }
    if (piano === 'premium' || piano === 'starter' || piano === 'pro') {
      return { label: 'Cambia piano', disabled: false };
    }
    return { label: pacchetto === 'starter' ? 'Acquista Starter' : 'Acquista Pro', disabled: false };
  }

  // ============ HELPER VIDEO FILTRATI ============
  const videoFiltrati = videos.filter((v) => {
    if (filtroGalleria === 'tutti') return true;
    return v.stato === filtroGalleria;
  });

  // Calcola costo crediti in base a durata
  const costoCrediti = durata <= 6 ? 1 : 2;

  // Schema reale: solo profili.crediti (colonna 'credits' non esiste -> PostgREST 400)
  const creditiUtente = profilo?.crediti ?? 0;

  // ============ RENDER SIDEBAR ============
  function renderSidebar() {
    const voci: { id: Sezione; icona: string; label: string }[] = [
      { id: 'casa', icona: '', label: 'Casa' },
      { id: 'progetti', icona: '', label: 'Progetti' },
      { id: 'integrazioni', icona: '', label: 'Integrazioni' },
      { id: 'sviluppatori', icona: '', label: 'Sviluppatori' },
    ];

    return (
      <aside className="fixed left-0 top-0 bottom-0 w-64 z-50 bg-surface border-r border-white/[0.06] flex flex-col">
        {/* Logo */}
        <div className="px-6 py-6 border-b border-white/[0.06]">
          <a href="/landing" className="flex items-center gap-2.5" aria-label="JumbAI Home - Landing Page">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-violet to-roseSoft text-white font-display font-bold text-base shadow-lg shadow-violet/20">J</span>
            <span className="font-display text-xl tracking-tight text-textMain">JumbAI</span>
          </a>
        </div>

        {/* Menu */}
        <nav className="flex-1 px-3 py-6 space-y-1">
          {voci.map((v) => (
            <button
              key={v.id}
              onClick={() => setSezione(v.id)}
              className={`sidebar-item w-full ${sezione === v.id ? 'active' : ''}`}
            >
              <span className="text-lg">{v.icona}</span>
              <span>{v.label}</span>
            </button>
          ))}
        </nav>

        {/* Badge piano */}
        <div className="px-4 py-4 border-t border-white/[0.06]">
          {session ? (
            <div className="badge-crediti border-violet/30 bg-violet/10 text-violetSoft">
              <span className="text-sm"></span>
              <span>Premium · {creditiUtente} crediti</span>
            </div>
          ) : (
            <div className="badge-crediti border-amber/30 bg-amber/10 text-amber">
              <span></span>
              <span>Free (BYOK)</span>
            </div>
          )}
        </div>

        {/* Auth */}
        <div className="px-4 py-4 border-t border-white/[0.06]">
          {session ? (
            <div className="space-y-2">
              <p className="text-xs text-coolGray truncate">{session.user?.email}</p>
              <button onClick={handleLogout} className="text-xs text-roseSoft hover:text-white transition">
                Esci
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowLogin(true)}
              className="w-full rounded-xl bg-violet text-white text-sm font-semibold py-2.5 hover:bg-violet/90 transition shadow-lg shadow-violet/20"
            >
              Accedi / Registrati
            </button>
          )}
        </div>

        {/* Video Studio */}
        <div className="px-4 py-4 border-t border-white/[0.06]">
          <button
            type="button"
            onClick={() => router.push('/video-studio')}
            className="w-full rounded-xl bg-gradient-to-r from-violet to-roseSoft text-white text-sm font-bold py-3 shadow-lg shadow-violet/20 hover:shadow-violet/40 transition"
          >
            Video Studio
          </button>
        </div>
      </aside>
    );
  }

  // ============ RENDER CASA (Console) ============
  function renderCasa() {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="glass-card rounded-3xl p-8 lg:p-10 shadow-2xl">
          {/* Header Console */}
          <div className="flex items-center gap-3 mb-6">
            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet to-violetSoft text-white flex items-center justify-center shadow-lg shadow-violet/30">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </span>
            <div>
              <h2 className="font-display text-2xl lg:text-3xl font-bold tracking-tight">Console Generativa</h2>
              <p className="text-sm text-coolGray">Trasforma la tua idea in un video AI in secondi.</p>
            </div>
          </div>

          {/* Tabs Input */}
          <div className="flex flex-wrap gap-2 mb-6">
            {([
              { id: 'testo' as TabInput, label: 'Testo in Video' },
              { id: 'immagine' as TabInput, label: 'Immagine in Video' },
              { id: 'frame' as TabInput, label: 'Primo/Ultimo Frame' },
              { id: 'multiple' as TabInput, label: 'Immagini Multiple' },
            ]).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setTabInputSafe(tab.id)}
                className={`tab-btn ${tabInput === tab.id ? 'active' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Upload Immagine (se necessario) */}
          {(tabInput === 'immagine' || tabInput === 'frame' || tabInput === 'multiple') && (
            <div className="mb-6">
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              <div
                className="upload-zone"
                onClick={() => fileInputRef.current?.click()}
              >
                {immaginePreview ? (
                  <div className="space-y-2">
                    <img src={immaginePreview} alt="Preview" className="max-h-48 mx-auto rounded-lg" />
                    <p className="text-xs text-coolGray">Clicca per cambiare immagine</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <span className="text-4xl"></span>
                    <p className="text-sm text-coolGray">Trascina o clicca per caricare un&apos;immagine</p>
                    <p className="text-xs text-white/30">PNG, JPG, WEBP — Max 10MB</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Prompt */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-coolGray mb-2">Prompt descrittivo</label>
            <textarea
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Una donna in un abito rosso cammina in una strada cyberpunk illuminata al neon, pioggia leggera, camera fluida cinematic..."
              className="input-jumbai resize-y min-h-[100px]"
            />
            {/* Template prompt chips (ADD-4) */}
            <div className="flex flex-wrap gap-2 mt-3">
              {[
                { label: 'Città', text: 'Un gatto che vola sopra una città al tramonto, nuvole dorate, camera panoramica lenta, atmosfera cinematografica' },
                { label: 'Natura', text: 'Tramonto dorato sulle Alpi, laghetto alpino che riflette le nuvole, camera panoramica lenta, luce naturale' },
                { label: 'Moda', text: 'Modella in passerella al rallentatore, abito di seta che ondeggia, luci morbide da studio, inquadratura elegante' },
                { label: 'Prodotto', text: 'Una sneaker premium su piedistallo di vetro, rotazione lenta a 360 gradi, riflessi metallici, sfondo scuro minimal' },
                { label: 'Spazio', text: 'Astronave che emerge dalle nuvole di una gigante gassosa, scie di luce blu, camera orbitale epica' },
                { label: 'Cucina', text: 'Burger gourmet al rallentatore con formaggio filante, vapore caldo, luci morbide, stile video pubblicitario' },
              ].map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => setPrompt(chip.text)}
                  className="rounded-full px-3 py-1.5 text-xs font-medium glass border border-white/[0.08] text-coolGray hover:text-textMain hover:border-violet/40 hover:bg-violet/10 transition"
                >
                  {chip.label}
                </button>
              ))}
            </div>
            {/* Gallery statica Ispirati (ADD-9) */}
            {ispiratiItems.length > 0 && (
              <div className="mt-5">
                <p className="text-sm font-medium text-coolGray mb-2">Ispirati</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {ispiratiItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setPrompt(item.prompt)}
                      className={`text-left rounded-xl p-3 border border-white/[0.08] bg-gradient-to-br ${item.gradient} bg-opacity-20 hover:border-violet/40 transition min-h-[72px]`}
                    >
                      <span className="text-xs font-semibold text-white drop-shadow">{item.titolo}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Modello */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-coolGray mb-2">Specificare modello</label>
            <select value={modello} onChange={(e) => setModello(e.target.value)} className="select-jumbai">
              {session ? (
                <>
                  <option value="hunyuan-video">Hunyuan Video (Standard)</option>
                  <option value="hunyuan-video-pro">Hunyuan Video Pro </option>
                  <option value="minimax-video">MiniMax Video</option>
                  <option value="cogvideo">CogVideoX</option>
                  <option value="veo-3.1-generate-preview">Veo 3.1 (BYOK avanzato — Sviluppatori)</option>
                </>
              ) : (
                <>
                  <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash (BYOK → Veo)</option>
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro (BYOK → Veo)</option>
                  <option value="veo-3.1-generate-preview">Veo 3.1 (BYOK)</option>
                </>
              )}
            </select>
          </div>

          {/* Impostazioni Avanzate (espandibile) */}
          <div className="mb-4">
            <button
              onClick={() => setShowAvanzate(!showAvanzate)}
              className="flex items-center gap-2 text-sm text-coolGray hover:text-textMain transition"
            >
              <span className={`transition ${showAvanzate ? 'rotate-90' : ''}`}></span>
              Impostazioni Avanzate
            </button>

            {showAvanzate && (
              <div className="mt-4 p-5 rounded-2xl bg-ink border border-white/[0.08] grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Durata */}
                <div>
                  <label className="block text-sm font-medium text-coolGray mb-2">Durata</label>
                  <select value={durata} onChange={(e) => setDurata(Number(e.target.value))} className="select-jumbai">
                    <option value={4}>4 secondi ({session ? '1 ' : 'gratuito'})</option>
                    <option value={6}>6 secondi ({session ? '1 ' : 'gratuito'})</option>
                    <option value={8}>8 secondi ({session ? '2 ' : 'Premium only'})</option>
                  </select>
                </div>

                {/* Risoluzione */}
                <div>
                  <label className="block text-sm font-medium text-coolGray mb-2">Risoluzione</label>
                  <select value={risoluzione} onChange={(e) => setRisoluzione(e.target.value)} className="select-jumbai">
                    <option value="720p">720p</option>
                    <option value="1080p">1080p</option>
                    <option value="4K">4K</option>
                  </select>
                </div>

                {/* Aspect ratio ADD-8: solo Premium/Fal; nascosto in BYOK (Gemini testo) */}
                {session && (
                  <div>
                    <label className="block text-sm font-medium text-coolGray mb-2">Formato (aspect ratio)</label>
                    <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="select-jumbai">
                      <option value="16:9">16:9 — Orizzontale</option>
                      <option value="9:16">9:16 — Verticale (Reels/Stories)</option>
                    </select>
                  </div>
                )}

                {/* Toggle Audio */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-coolGray">Genera Audio</span>
                  <div
                    className={`toggle-bg ${generaAudio ? 'active' : ''}`}
                    onClick={() => setGeneraAudio(!generaAudio)}
                  >
                    <div className="toggle-dot"></div>
                  </div>
                </div>

                {/* Toggle Ottimizzazione */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-coolGray">Ottimizzazione Automatica Prompt</span>
                  <div
                    className={`toggle-bg ${ottimizzaPrompt ? 'active' : ''}`}
                    onClick={() => setOttimizzaPrompt(!ottimizzaPrompt)}
                  >
                    <div className="toggle-dot"></div>
                  </div>
                </div>

                {/* Prompt Negativo */}
                <div>
                  <label className="block text-sm font-medium text-coolGray mb-2">Prompt Negativo</label>
                  <input
                    value={promptNegativo}
                    onChange={(e) => setPromptNegativo(e.target.value)}
                    placeholder="Cosa NON deve apparire (es. sfocato, artefatti)"
                    className="input-jumbai"
                  />
                </div>

                {/* Seed */}
                <div>
                  <label className="block text-sm font-medium text-coolGray mb-2">Seme (Seed)</label>
                  <input
                    type="number"
                    value={seed}
                    onChange={(e) => setSeed(e.target.value)}
                    placeholder="Casuale se vuoto"
                    className="input-jumbai"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
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
          </p>

          {/* Messaggio */}
          {messaggio && (
            <div className="mt-4 rounded-xl bg-violet/10 border border-violet/20 text-violetSoft px-5 py-4 text-sm font-medium flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-violet animate-pulse"></span>
              <span>{messaggio}</span>
            </div>
          )}
        </div>

        {/* ---- PREZZI ---- */}
        <section className="mt-12">
          <div className="text-center mb-8">
            <h2 className="font-display text-3xl lg:text-4xl font-bold tracking-tight">
              Scegli il tuo <span className="gradient-text">Piano</span>
            </h2>
            <p className="mt-2 text-sm text-coolGray">Psicologia settimanale: prezzi che sembrano un caffè. Annulla quando vuoi.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Free — fuori da Stripe */}
            <div className="glass-card rounded-3xl p-8 hover:-translate-y-1 transition relative">
              <span className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-widest bg-surface3 text-coolGray px-2.5 py-1 rounded-full">Free</span>
              <h3 className="font-display text-2xl font-bold mb-1">€0<span className="text-sm text-coolGray font-normal">/sempre</span></h3>
              <p className="text-sm text-coolGray mb-4">Include ~3 generazioni gratis con crediti JumbAI. BYOK opzionale in Sviluppatori.</p>
              <ul className="text-sm text-coolGray space-y-2 mb-6">
                <li>~3 video gratis (crediti JumbAI / Fal)</li>
                <li>Nessuna fatturazione Google richiesta</li>
                <li>BYOK opzionale in Sviluppatori</li>
              </ul>
              <button
                type="button"
                disabled
                className="w-full rounded-xl bg-surface2 border border-white/[0.10] text-coolGray font-semibold py-3 cursor-not-allowed opacity-80"
              >
                Già in utilizzo
              </button>
            </div>

            {/* Starter */}
            <div className="glass-card rounded-3xl p-8 hover:-translate-y-1 transition relative">
              <span className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-widest bg-surface3 text-coolGray px-2.5 py-1 rounded-full">Starter</span>
              <h3 className="font-display text-2xl font-bold mb-1">€1,50<span className="text-sm text-coolGray font-normal">/settimana</span></h3>
              <p className="text-sm text-coolGray mb-4">Equivalente a <strong className="text-textMain">€6 una tantum</strong> per 10 crediti</p>
              <ul className="text-sm text-coolGray space-y-2 mb-6">
                <li>10 video generati</li>
                <li>Risoluzione fino a 1080p</li>
                <li>Supporto prioritario</li>
              </ul>
              {(() => {
                const btn = etichettaPiano('starter');
                return (
                  <button
                    type="button"
                    disabled={btn.disabled || inviando}
                    onClick={() => { if (!btn.disabled) void avviaCheckout('starter'); }}
                    className="w-full rounded-xl bg-gradient-to-r from-violet to-roseSoft text-white font-semibold py-3 shadow-lg shadow-violet/30 hover:shadow-violet/50 transition disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {btn.label}
                  </button>
                );
              })()}
            </div>

            {/* Pro */}
            <div className="glass-card rounded-3xl p-8 relative overflow-hidden ring-1 ring-amber/40 shadow-xl shadow-amber/10 hover:-translate-y-1 transition">
              <span className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-widest bg-amber/20 text-amber px-2.5 py-1 rounded-full">Pro</span>
              <h3 className="font-display text-2xl font-bold mb-1">€3,75<span className="text-sm text-coolGray font-normal">/settimana</span></h3>
              <p className="text-sm text-coolGray mb-4">Equivalente a <strong className="text-textMain">€15 una tantum</strong> per 100 crediti</p>
              <ul className="text-sm text-coolGray space-y-2 mb-6">
                <li>100 video generati</li>
                <li>Risoluzione fino a 4K</li>
                <li>Audio generato incluso</li>
                <li>Modelli premium</li>
              </ul>
              {(() => {
                const btn = etichettaPiano('pro');
                return (
                  <button
                    type="button"
                    disabled={btn.disabled || inviando}
                    onClick={() => { if (!btn.disabled) void avviaCheckout('pro'); }}
                    className="w-full rounded-xl bg-gradient-to-r from-amber to-roseSoft text-white font-semibold py-3 shadow-lg shadow-amber/30 hover:shadow-amber/50 transition disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {btn.label}
                  </button>
                );
              })()}
            </div>
          </div>

          {/* Fiducia */}
          <div className="flex flex-wrap items-center justify-center gap-6 mt-6 text-xs text-coolGray">
            <span>Pagamento sicuro Stripe</span>
            <span>Visa · Mastercard · PayPal</span>
            <span className="flex items-center gap-1">
              <strong className="text-textMain">4.8/5</strong> su Trustpilot
            </span>
          </div>
        </section>
      </div>
    );
  }

  // ============ RENDER PROGETTI (Galleria) ============
  function renderProgetti() {
    const filtri: { id: FiltroGalleria; label: string; icona: string }[] = [
      { id: 'tutti', label: 'Tutti', icona: '' },
      { id: 'rendering', label: 'In Rendering', icona: '' },
      { id: 'completato', label: 'Completati', icona: '' },
      { id: 'fallito', label: 'Falliti', icona: '' },
    ];

    return (
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-3xl lg:text-4xl font-bold tracking-tight">I tuoi Progetti</h2>
          <button onClick={caricaVideo} className="text-sm font-medium text-violetSoft hover:text-white transition">
             Aggiorna
          </button>
        </div>

        {/* Filtri */}
        <div className="flex flex-wrap gap-2 mb-6">
          {filtri.map((f) => (
            <button
              key={f.id}
              onClick={() => setFiltroGalleria(f.id)}
              className={`filter-btn ${filtroGalleria === f.id ? 'active' : ''}`}
            >
              {f.icona} {f.label} {f.id !== 'tutti' && `(${videos.filter(v => v.stato === f.id).length})`}
            </button>
          ))}
        </div>

        {/* Griglia */}
        {!session ? (
          <div className="glass-card rounded-3xl p-12 text-center">
            <span className="text-5xl"></span>
            <p className="mt-4 text-coolGray">Accedi per vedere i tuoi progetti.</p>
            <button onClick={() => setShowLogin(true)} className="mt-4 rounded-xl bg-violet text-white font-semibold px-6 py-2.5 hover:bg-violet/90 transition">
              Accedi
            </button>
          </div>
        ) : videoFiltrati.length === 0 ? (
          <div className="glass-card rounded-3xl p-12 text-center">
            <span className="text-5xl"></span>
            <p className="mt-4 text-coolGray">Nessun video trovato in questa categoria.</p>
            <p className="text-xs text-coolGray mt-1">Genera il primo dalla sezione Casa!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {videoFiltrati.map((video) => (
              <article key={video.id} className="video-card">
                <div className="relative bg-ink2 aspect-video flex items-center justify-center overflow-hidden">
                  {/* Status badge */}
                  {video.stato === 'rendering' && (
                    <span className="status-badge bg-amber/20 text-amber border border-amber/30">
                       In Rendering
                    </span>
                  )}
                  {video.stato === 'completato' && (
                    <span className="status-badge bg-emerald/20 text-emerald border border-emerald/30">
                       Completato
                    </span>
                  )}
                  {video.stato === 'fallito' && (
                    <span className="status-badge bg-red/20 text-red-400 border border-red/30">
                       Fallito
                    </span>
                  )}

                  {video.stato === 'rendering' ? (
                    <div className="text-center px-4">
                      <div className="shimmer w-full h-full absolute inset-0"></div>
                      <div className="relative z-10">
                        <span className="inline-block w-8 h-8 rounded-full border-2 border-amber border-t-transparent animate-spin"></span>
                        <p className="text-xs text-coolGray mt-2">{video.prompt?.substring(0, 40)}...</p>
                      </div>
                    </div>
                  ) : video.stato === 'completato' && video.url_video ? (
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
                      )}
                      {/* ADD-7: watermark leggero solo Free (ospite / BYOK senza sessione Premium) */}
                      {!session && (
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                          <span className="text-white/25 text-2xl font-display font-bold tracking-widest select-none rotate-[-18deg]">
                            JumbAI
                          </span>
                        </div>
                      )}
                    </>
                  ) : video.stato === 'fallito' ? (
                    <div className="text-center px-4">
                      <span className="text-3xl"></span>
                      <p className="text-xs text-red-400 mt-1">{video.errore || 'Errore sconosciuto'}</p>
                    </div>
                  ) : (
                    <div className="shimmer w-full h-full"></div>
                  )}
                </div>

                <div className="p-4">
                  <p className="text-xs text-coolGray mb-2 line-clamp-2">{video.prompt}</p>
                  <div className="flex items-center justify-between text-[10px] text-white/40">
                    <span>{video.durata_secondi}s · {video.risoluzione}</span>
                    <span>{new Date(video.creato_il).toLocaleDateString('it-IT')}</span>
                  </div>
                  {/* Export formato (ADD-5/ADD-6): MP4 provider, WebM/GIF con estensione scelta */}
                  {video.stato === 'completato' && video.url_video && (
                    <div className="mt-3 space-y-2">
                      <button
                        type="button"
                        onClick={() => {
                          const q = new URLSearchParams({
                            url: video.url_video as string,
                            id: video.id,
                            prompt: (video.prompt || '').slice(0, 120),
                          });
                          window.open(`/editor?${q.toString()}`, '_blank', 'noopener,noreferrer');
                        }}
                        className="w-full inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-violet to-roseSoft text-white text-[11px] font-bold py-2.5 shadow-lg shadow-violet/20 hover:shadow-violet/40 transition"
                      >
                        Apri in Editor
                      </button>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-coolGray">Export formato</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(['mp4', 'webm', 'gif'] as const).map((formato) => (
                          <a
                            key={formato}
                            href={video.url_video as string}
                            download={`jumbai-${video.id}.${formato}`}
                            title={formato === 'mp4' ? 'Scarica MP4' : 'Il provider fornisce MP4; conversione nativa in roadmap'}
                            className={`inline-flex items-center justify-center rounded-lg border text-[11px] font-semibold py-2 transition ${formato === 'mp4' ? 'bg-violet/20 border-violet/30 text-violetSoft hover:bg-violet/30' : 'bg-surface2 border-white/[0.10] text-coolGray hover:text-textMain'}`}
                          >
                            {formato.toUpperCase()}
                          </a>
                        ))}
                      </div>
                      <p className="text-[10px] leading-relaxed text-white/40">Il provider consegna MP4; WebM/GIF usano il nome scelto, la conversione nativa ? in roadmap.</p>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ============ RENDER INTEGRAZIONI ============
  function renderIntegrazioni() {
    const integrations = [
      { name: 'Discord', icon: '', desc: 'Notifiche automatiche quando un video è pronto.', connected: false },
      { name: 'X (Twitter)', icon: '', desc: 'Pubblica i tuoi video direttamente su X.', connected: false },
      { name: 'YouTube', icon: '', desc: 'Carica automaticamente su YouTube.', connected: false },
      { name: 'Telegram', icon: '✈', desc: 'Ricevi i video su Telegram.', connected: false },
    ];

    return (
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h2 className="font-display text-3xl lg:text-4xl font-bold tracking-tight">Integrazioni</h2>
          <p className="text-sm text-coolGray mt-1">Connetti i tuoi servizi preferiti per automatizzare il workflow.</p>
        </div>

        <div className="space-y-4">
          {integrations.map((int) => (
            <div key={int.name} className="glass-card rounded-2xl p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-3xl">{int.icon}</span>
                <div>
                  <h3 className="font-display font-semibold">{int.name}</h3>
                  <p className="text-xs text-coolGray">{int.desc}</p>
                </div>
              </div>
              <button
                type="button"
                disabled
                title="Integrazione in arrivo"
                className={`rounded-lg px-4 py-2 text-xs font-semibold transition opacity-70 cursor-not-allowed ${
                  int.connected
                    ? 'bg-emerald/20 text-emerald border border-emerald/30'
                    : 'bg-surface2 text-coolGray border border-white/[0.10]'
                }`}
              >
                {int.connected ? 'Connesso' : 'Presto'}
              </button>
            </div>
          ))}
        </div>

        {!session && (
          <div className="mt-6 glass-card rounded-2xl p-6 text-center">
            <p className="text-sm text-coolGray">Accedi per configurare le integrazioni.</p>
          </div>
        )}
      </div>
    );
  }

  // ============ RENDER SVILUPPATORI (BYOK) ============
  function renderSviluppatori() {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h2 className="font-display text-3xl lg:text-4xl font-bold tracking-tight"> Sviluppatori — BYOK</h2>
          <p className="text-sm text-coolGray mt-1">
            BYOK è <strong>opzionale e avanzato</strong>: le generazioni gratuite usano i crediti JumbAI (Fal).
            Se usi una tua chiave, resta <strong>solo</strong> nel tuo browser — non serve abilitare fatturazione Google per usare Genera Gratis.
          </p>
        </div>

        <div className="glass-card rounded-3xl p-8 space-y-6">
          <div>
            <label className="block text-sm font-medium text-coolGray mb-2">La tua API Key</label>
            <div className="flex gap-2">
              <input
                type="password"
                value={byokKey}
                onChange={(e) => setByokKey(e.target.value)}
                placeholder="API Key (Google Gemini / HuggingFace)"
                className="input-jumbai flex-1"
              />
              <button onClick={salvaByok} className="rounded-xl bg-violet text-white text-sm font-semibold px-5 py-3 hover:bg-violet/90 transition shadow-lg shadow-violet/20 whitespace-nowrap">
                Salva
              </button>
            </div>
            <p className="text-xs text-coolGray mt-2">Memorizzata in localStorage. Per Veo la chiave passa solo ephemeral alle API byok-veo-* (mai salvata su DB).</p>
            <button
              type="button"
              disabled={inviando || !byokKey.trim()}
              onClick={() => void eseguiByokVeo()}
              className="mt-4 w-full rounded-xl bg-amber/20 border border-amber/40 text-amber font-semibold py-3 hover:bg-amber/30 transition disabled:opacity-50"
            >
              {inviando ? 'Generazione BYOK…' : 'Genera con BYOK Veo (opzionale)'}
            </button>
            <p className="text-[11px] text-coolGray mt-2">Usa il prompt della sezione Casa. Genera Gratis = Wan (DashScope) + crediti JumbAI.</p>
          </div>

          <div className="rounded-2xl bg-ink border border-white/[0.08] p-5">
            <h3 className="font-display text-base font-semibold mb-2"> Come ottenere una chiave</h3>
            <ol className="text-sm text-coolGray space-y-2 list-decimal list-inside">
              <li>Per generare gratis: accedi e usa <strong>&quot;Genera Gratis&quot;</strong> in Casa (crediti JumbAI, nessuna chiave Google)</li>
              <li>BYOK opzionale: genera una API Key su <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-violetSoft hover:underline">Google AI Studio</a> oppure un token <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noreferrer" className="text-violetSoft hover:underline">HuggingFace</a></li>
              <li>Incolla la chiave qui sopra e clicca Salva (resta in localStorage)</li>
              <li>BYOK non richiede di abilitare la fatturazione Google per usare le generazioni gratuite JumbAI</li>
            </ol>
          </div>

          <div className="rounded-2xl bg-ink border border-white/[0.08] p-5">
            <h3 className="font-display text-base font-semibold mb-2"> Privacy & Sicurezza</h3>
            <ul className="text-sm text-coolGray space-y-2 list-disc list-inside">
              <li>La chiave è archiviata SOLO nel localStorage del tuo browser</li>
              <li>Le chiamate Veo passano ephemeral da /api/byok-veo-* (chiave mai salvata su DB)</li>
              <li>Nessuna persistenza della chiave; solo inoltro ephemeral verso Google</li>
              <li>Le generazioni gratuite JumbAI usano i crediti piattaforma (Fal), non la tua chiave</li>
            </ul>
          </div>
        </div>

        {session && (
          <div className="mt-6 glass-card rounded-3xl p-8">
            <h3 className="font-display text-xl font-bold mb-4"> La tua Dashboard</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-2xl bg-ink border border-white/[0.08] p-4 text-center">
                <p className="text-2xl font-bold tabular-nums">{creditiUtente}</p>
                <p className="text-xs text-coolGray">Crediti</p>
              </div>
              <div className="rounded-2xl bg-ink border border-white/[0.08] p-4 text-center">
                <p className="text-2xl font-bold">{videos.length}</p>
                <p className="text-xs text-coolGray"> Video Totali</p>
              </div>
              <div className="rounded-2xl bg-ink border border-white/[0.08] p-4 text-center">
                <p className="text-2xl font-bold text-emerald">{videos.filter(v => v.stato === 'completato').length}</p>
                <p className="text-xs text-coolGray"> Completati</p>
              </div>
              <div className="rounded-2xl bg-ink border border-white/[0.08] p-4 text-center">
                <p className="text-2xl font-bold text-amber">{videos.filter(v => v.stato === 'rendering').length}</p>
                <p className="text-xs text-coolGray"> In Coda</p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============ RENDER SEZIONE PRINCIPALE ============
  function renderContent() {
    switch (sezione) {
      case 'casa': return renderCasa();
      case 'progetti': return renderProgetti();
      case 'integrazioni': return renderIntegrazioni();
      case 'sviluppatori': return renderSviluppatori();
    }
  }

  // ============ MODALE LOGIN ============
  function renderLoginModal() {
    if (!showLogin) return null;
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowLogin(false)}>
        <div className="glass-card rounded-3xl p-8 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
          <div className="text-center mb-6">
            <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-violet to-roseSoft text-white font-display font-bold text-2xl shadow-lg shadow-violet/20 mb-3">
              J
            </span>
            <h2 className="font-display text-2xl font-bold">{isRegistrazione ? 'Crea Account' : 'Accedi'}</h2>
            <p className="text-sm text-coolGray mt-1">
              {isRegistrazione ? 'Registrati per sbloccare il Piano Premium' : 'Accedi per usare i tuoi crediti Premium'}
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-coolGray mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-jumbai" placeholder="tua@email.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-coolGray mb-1">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input-jumbai" placeholder="Minimo 6 caratteri" />
            </div>

            <button onClick={() => {
              void signInWithGoogle().catch((e) => { console.error(e); alert(e?.message || 'Login Google non disponibile'); });
            }} className="w-full rounded-xl bg-white text-ink font-bold py-3 shadow-lg hover:bg-gray-100 transition flex items-center justify-center gap-2 mb-3">
              <span></span> Continua con Google
            </button>

            <div className="flex items-center gap-3 text-xs text-coolGray my-2">
              <span className="flex-1 h-px bg-white/10"></span> oppure <span className="flex-1 h-px bg-white/10"></span>
            </div>

            <button onClick={handleAuth} className="w-full rounded-xl bg-gradient-to-r from-violet to-roseSoft text-white font-bold py-3 shadow-lg shadow-violet/30 hover:shadow-violet/50 transition">
              {isRegistrazione ? 'Registrati' : 'Accedi'}
            </button>

            <a href="/api/civitai-login" className="block w-full rounded-xl bg-violet/10 border border-violet/30 text-violetSoft font-bold py-3 text-center hover:bg-violet/20 transition mt-2">
              Collega CivitAI (OAuth)
            </a>

            <p className="text-center text-sm text-coolGray">
              {isRegistrazione ? 'Hai già un account?' : 'Non hai un account?'}{' '}
              <button onClick={() => setIsRegistrazione(!isRegistrazione)} className="text-violetSoft hover:underline">
                {isRegistrazione ? 'Accedi' : 'Registrati'}
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ============ LAYOUT PRINCIPALE ============
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink">
        <div className="text-center">
          <span className="inline-block w-10 h-10 rounded-full border-2 border-violet border-t-transparent animate-spin"></span>
          <p className="mt-4 text-coolGray text-sm">Caricamento...</p>
        </div>
      </div>
    );
  }

  // Se non autenticato, mostra la richiesta di login (non la dashboard completa)
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink">
        <div className="glass-card rounded-3xl p-10 max-w-md text-center shadow-2xl border-violet/20">
          <h2 className="font-display text-3xl font-bold mb-3">JumbAI Dashboard</h2>
          <p className="text-coolGray mb-6">Autenticati per accedere alla console generativa, ai progetti e al BYOK.</p>
          <button onClick={() => { void signInWithGoogle().catch((e) => { console.error(e); setShowLogin(true); alert((e as Error)?.message || 'Login Google non disponibile'); }); }} className="rounded-xl bg-gradient-to-r from-violet to-roseSoft text-white font-bold px-8 py-3 shadow-lg shadow-violet/30 hover:shadow-violet/50 transition">Continua con Google</button>
          <button type="button" onClick={() => setShowLogin(true)} className="mt-3 rounded-xl border border-white/15 bg-surface2 text-textMain font-semibold px-8 py-3 hover:bg-white/[0.06] transition">Accedi o registrati con email</button>
          <a href="/landing" className="block text-sm text-coolGray hover:text-violetSoft transition mt-4">Torna alla landing</a>
        </div>
        {renderLoginModal()}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink">
      {/* Sidebar */}
      {renderSidebar()}

      {/* Main Content */}
      <div className="ml-64 min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-40 h-16 glass border-b border-white/[0.05] flex items-center justify-between px-8">
          <div>
            <h1 className="font-display text-lg font-bold">
              {sezione === 'casa' && 'Casa'}
              {sezione === 'progetti' && 'Progetti'}
              {sezione === 'integrazioni' && 'Integrazioni'}
              {sezione === 'sviluppatori' && 'Sviluppatori'}
            </h1>
          </div>

          {/* Badge destra */}
          <div className="flex items-center gap-3">
            {session ? (
              <div className="badge-crediti border-violet/30 bg-violet/10 text-violetSoft text-xs">
                <span></span>
                <span>Crediti: <strong className="tabular-nums">{creditiUtente}</strong></span>
              </div>
            ) : (
              <div className="badge-crediti border-amber/30 bg-amber/10 text-amber text-xs">
                <span></span>
                <span>Piano: Free (BYOK)</span>
              </div>
            )}
            <div className="relative">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={session ? showAccountMenu : undefined}
                onClick={() => {
                  if (!session) {
                    setShowLogin(true);
                    return;
                  }
                  setShowAccountMenu((v) => !v);
                }}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] pl-1.5 pr-3 py-1 text-sm text-violetSoft hover:text-white hover:border-violet/40 hover:bg-violet/10 transition"
              >
                {session ? (
                  <>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-violet to-roseSoft text-[11px] font-bold text-white">
                      {(session.user?.email || "?").charAt(0).toUpperCase()}
                    </span>
                    <span className="max-w-[9rem] truncate">{session.user?.email?.split("@")[0]}</span>
                    <span className={`text-[10px] text-coolGray transition ${showAccountMenu ? "rotate-180" : ""}`}>▾</span>
                  </>
                ) : (
                  <span className="px-1">Accedi</span>
                )}
              </button>
              {session && showAccountMenu && (
                <>
                  <button
                    type="button"
                    aria-label="Chiudi menu account"
                    className="fixed inset-0 z-40 cursor-default bg-black/20"
                    onClick={() => setShowAccountMenu(false)}
                  />
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-64 origin-top-right rounded-2xl border border-white/10 bg-ink/95 p-2 shadow-2xl shadow-black/50 ring-1 ring-violet/20 backdrop-blur-md z-50"
                  >
                    <div className="rounded-xl bg-white/[0.03] px-3 py-3 mb-1">
                      <p className="text-[11px] uppercase tracking-wide text-coolGray mb-1">Account</p>
                      <p className="text-sm text-textMain truncate">{session.user?.email}</p>
                      <p className="text-xs text-violetSoft mt-1">
                        Crediti: <strong className="tabular-nums">{profilo?.crediti ?? 0}</strong>
                      </p>
                    </div>
                    <button
                      type="button"
                      role="menuitem"
                      className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-textMain hover:bg-violet/15 hover:text-violetSoft transition"
                      onClick={() => { setSezione("progetti"); setShowAccountMenu(false); }}
                    >
                      I miei progetti
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-textMain hover:bg-violet/15 hover:text-violetSoft transition"
                      onClick={() => { setSezione("casa"); setShowAccountMenu(false); }}
                    >
                      Console Generativa
                    </button>
                    <div className="my-1 h-px bg-white/10" />
                    <button
                      type="button"
                      role="menuitem"
                      className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-roseSoft hover:bg-roseSoft/10 hover:text-white transition"
                      onClick={() => { setShowAccountMenu(false); void handleLogout(); }}
                    >
                      Esci
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-8 lg:p-10">
          {renderContent()}
        </main>

        {/* Footer */}
        <footer className="border-t border-white/[0.08] py-8 text-center text-coolGray text-xs">
          <p>JumbAI 2.0 — AI Video Generator SaaS. Architettura BYOK + Premium. Zero costi GPU.</p>
        </footer>
      </div>

      {/* Modale Login */}
      {renderLoginModal()}

      {/* Onboarding 3-step (ADD-2) */}
      {showOnboarding && session && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="glass-card rounded-3xl p-8 w-full max-w-lg shadow-2xl border border-violet/20 relative">
            <button
              type="button"
              onClick={completaOnboarding}
              className="absolute top-4 right-4 text-xs text-coolGray hover:text-textMain transition"
            >
              Chiudi
            </button>
            <div className="flex items-center gap-2 mb-6">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className={`h-1.5 flex-1 rounded-full ${i <= onboardingStep ? 'bg-violet' : 'bg-white/10'}`}
                />
              ))}
            </div>
            {onboardingStep === 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-violetSoft">Passo 1 di 3</p>
                <h3 className="font-display text-2xl font-bold">Generare un video</h3>
                <p className="text-sm text-coolGray leading-relaxed">
                  Vai in <strong className="text-textMain">Casa</strong> e usa la Console Generativa: scrivi un prompt (o scegli un template) e premi Genera Gratis (crediti JumbAI) oppure Genera Premium.
                </p>
              </div>
            )}
            {onboardingStep === 1 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-violetSoft">Passo 2 di 3</p>
                <h3 className="font-display text-2xl font-bold">Crediti e piani</h3>
                <p className="text-sm text-coolGray leading-relaxed">
                  Il badge in alto mostra i tuoi <strong className="text-textMain">crediti</strong> Premium. I pacchetti Starter (~€6 / 10 video) e Pro (~€15 / 100 video) ricaricano il saldo; i nuovi account ricevono ~3 crediti gratis; BYOK resta opzionale in Sviluppatori.
                </p>
              </div>
            )}
            {onboardingStep === 2 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-violetSoft">Passo 3 di 3</p>
                <h3 className="font-display text-2xl font-bold">Trovare i progetti</h3>
                <p className="text-sm text-coolGray leading-relaxed">
                  Nella sidebar apri <strong className="text-textMain">Progetti</strong> per vedere i video in rendering o completati. Da lì puoi riprodurre e scaricare gli MP4 pronti.
                </p>
              </div>
            )}
            <div className="mt-8 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={completaOnboarding}
                className="text-sm text-coolGray hover:text-textMain transition"
              >
                Salta
              </button>
              {onboardingStep < 2 ? (
                <button
                  type="button"
                  onClick={() => setOnboardingStep((s) => s + 1)}
                  className="rounded-xl bg-violet text-white text-sm font-semibold px-5 py-2.5 hover:bg-violet/90 transition shadow-lg shadow-violet/20"
                >
                  Avanti
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    completaOnboarding();
                    setSezione('progetti');
                  }}
                  className="rounded-xl bg-gradient-to-r from-violet to-roseSoft text-white text-sm font-bold px-5 py-2.5 shadow-lg shadow-violet/30 hover:shadow-violet/50 transition"
                >
                  Vai ai Progetti
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}