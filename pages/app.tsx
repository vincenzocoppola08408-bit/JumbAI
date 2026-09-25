/* encoding-safe-unicode-v4: emoji removed from chrome */
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase-client';
import { trackGenera, trackCheckout } from '../lib/analytics';
import Toast from '../components/Toast';
import { clientCache, syncWithGalleryBackend } from '../lib/client-cache';

// ================================================================
// JumbAI 3.0 — Text-to-Image Generator: Sidebar + Console + Gallery + Auth
// ================================================================

type Sezione = 'casa' | 'galleria' | 'integrazioni';
type FiltroGalleria = 'tutti' | 'generazione' | 'completata' | 'fallita';
type StatoImmagine = 'generazione' | 'completata' | 'fallita';
type Aspetto = '1:1' | '4:3' | '3:4' | '16:9' | '9:16' | '3:2' | '2:3';

interface Immagine {
  id: string;
  user_id: string;
  prompt: string;
  prompt_negativo: string;
  seed: number | null;
  modello: string;
  categoria: string;
  size: string;
  url_immagine: string | null;
  provider: string;
  stato: StatoImmagine;
  errore: string | null;
  creato_il: string;
  completato_il: string | null;
}

// Legacy: vecchi record da video_generati come immagini
function normalizzaImmagine(r: any): Immagine {
  const url: string | null = r?.url_immagine ?? r?.url_video ?? null;
  let stato: StatoImmagine = r?.stato;
  if (!stato) {
    if (url && String(url).startsWith('http')) stato = 'completata';
    else if (url === 'failed' || url === 'fallito') stato = 'fallita';
    else stato = 'generazione';
  }
  return {
    id: r.id,
    user_id: r.user_id,
    prompt: r.prompt || r.prompt_usato || '',
    prompt_negativo: r.prompt_negativo || '',
    seed: r.seed || null,
    modello: r.modello || 'wanx2.1-t2i-turbo',
    categoria: r.categoria || 'generale',
    size: r.size || '1024*1024',
    url_immagine: url && String(url).startsWith('http') ? url : null,
    provider: r.provider || 'wan',
    stato,
    errore: r.errore || null,
    creato_il: r.creato_il,
    completato_il: r.completato_il || null,
  } as Immagine;
}

// Categorie predefinite
const CATEGORIE = [
  { id: 'Tutte', icona: '\u2728', colore: 'from-violet to-roseSoft', prompt: '' },
  { id: 'Ritratto', icona: '\ud83d\udc64', colore: 'from-violet to-purple-700', prompt: 'Ritratto fotorealistico, luce morbida dorata, profondità di campo, texture della pelle naturale, sfondo sfocato bokeh' },
  { id: 'Fantasy', icona: '\ud83e\uddd9', colore: 'from-fuchsia-500 to-purple-700', prompt: 'Scena fantasy epica, castello galleggiante, cascate luminose, atmosfera magica, colori vibranti' },
  { id: 'Anime', icona: '\ud83c\udfae', colore: 'from-sky-400 to-indigo-600', prompt: 'Stile anime giapponese, personaggio dettagliato, colori vividi, sfondo città illuminata al neon' },
  { id: 'Paesaggio', icona: '\ud83c\udfde\ufe0f', colore: 'from-emerald-500 to-teal-700', prompt: 'Paesaggio mozzafiato, montagne al tramonto, lago cristallino, fotografia HDR, luce naturale' },
  { id: 'Architettura', icona: '\ud83c\udfdb\ufe0f', colore: 'from-zinc-400 to-zinc-700', prompt: 'Architettura moderna, grattacielo in vetro e acciaio, rendering architettonico 8K, design minimalista' },
  { id: 'Cibo', icona: '\ud83c\udf7d\ufe0f', colore: 'from-amber-500 to-orange-700', prompt: 'Fotografia culinaria professionale, piatto gourmet, luce calda, profondità di campo, dettaglio croccante' },
  { id: 'Moda', icona: '\ud83d\udc57', colore: 'from-red-500 to-rose-700', prompt: 'Fotografia di moda, street style, atmosfera grintosa, illuminazione soffusa, texture tessuti' },
  { id: 'Astratto', icona: '\ud83c\udfa8', colore: 'from-cyan-500 to-blue-600', prompt: 'Arte astratta geometrica, gradienti fluidi, texture digitali, forme organiche colorate' },
];

const ASPECT_RATIOS: { id: Aspetto; label: string }[] = [
  { id: '1:1', label: 'Quadrato (1:1)' },
  { id: '4:3', label: 'Orizzontale (4:3)' },
  { id: '3:4', label: 'Verticale (3:4)' },
  { id: '16:9', label: 'Widescreen (16:9)' },
  { id: '9:16', label: 'Storie (9:16)' },
  { id: '3:2', label: 'Classico (3:2)' },
  { id: '2:3', label: 'Ritratto (2:3)' },
];

export default function AppDashboard() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [profilo, setProfilo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sezione, setSezione] = useState<Sezione>('casa');
  const [filtroGalleria, setFiltroGalleria] = useState<FiltroGalleria>('tutti');
  const [prompt, setPrompt] = useState('');
  const [promptNegativo, setPromptNegativo] = useState('');
  const [seed, setSeed] = useState('');
  const [aspectRatio, setAspectRatio] = useState<Aspetto>('1:1');
  const [categoria, setCategoria] = useState('Tutte');
  const [ottimizzaPrompt, setOttimizzaPrompt] = useState(true);
  const [showAvanzate, setShowAvanzate] = useState(false);
  const [immagini, setImmagini] = useState<Immagine[]>([]);
  const [inviando, setInviando] = useState(false);
  const [messaggio, setMessaggio] = useState('');
  // Toast notifications per UI/UX errori
  const [toasts, setToasts] = useState<Array<{ id: string; type: string; message: string }>>([]);

  function addToast(message: string, type: string = 'info', duration: number = 4000) {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration + 300);
  }

  function removeToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }
  const [showLogin, setShowLogin] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistrazione, setIsRegistrazione] = useState(false);
  const [ispiratiItems, setIspiratiItems] = useState<{ id: string; titolo: string; prompt: string; gradient: string; categoria: string }[]>([]);
  const [lightboxImg, setLightboxImg] = useState<Immagine | null>(null);
  const [canale, setCanale] = useState<string | null>(null);
  const [checkoutMsg, setCheckoutMsg] = useState('');

  // ---- HUD Professionale ----
  const [categoriaFiltro, setCategoriaFiltro] = useState('Tutte');
  const [cachePronta, setCachePronta] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // ============ AUTH ============
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        caricaProfilo(session.user.id);
      } else {
        router.replace('/');
      }
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user?.id) caricaProfilo(session.user.id);
    });
    return () => subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    fetch('/ispirati/items.json')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => { if (Array.isArray(data)) setIspiratiItems(data); })
      .catch(() => {});
  }, []);

  // Checkout success/cancelled dalla query string
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get('checkout') === 'success') {
      setCheckoutMsg('Pagamento completato! Crediti aggiunti al tuo account.');
      setTimeout(() => setCheckoutMsg(''), 8000);
      window.history.replaceState({}, '', '/app');
      if (session?.user?.id) caricaProfilo(session.user.id);
    }
    if (q.get('checkout') === 'cancelled') {
      setCheckoutMsg('Pagamento annullato. Puoi riprovare quando vuoi.');
      setTimeout(() => setCheckoutMsg(''), 8000);
      window.history.replaceState({}, '', '/app');
    }
  }, [session]);

  async function caricaProfilo(userId: string) {
    try {
      await fetch('/api/claim-free-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
    } catch { /* best-effort */ }
    const { data } = await supabase.from('profili').select('crediti, piano').eq('id', userId).single();
    setProfilo(data);
  }

  // ============ REALTIME IMMAGINI + SMART CACHE ============
  useEffect(() => {
    if (!session?.user?.id) return;

    // 1. Carica IMMEDIATAMENTE dalla cache locale (<10ms)
    hydrataDaCache();

    // 2. Carica dal server (silenzioso, aggiorna cache in background)
    caricaImmagini();

    // 3. Sync silenzioso con backend per file mancanti
    syncWithGalleryBackend(session.user.id, window.location.origin).catch(console.warn);

    // 4. Postgres changes subscription
    const channel = supabase
      .channel('immagini_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'immagini_generate',
        filter: `user_id=eq.${session.user.id}`,
      }, (payload) => {
        const raw = payload.new as any;
        if (!raw || !raw.id) return;
        const nuovo = normalizzaImmagine(raw);
        setImmagini((prev) => {
          const idx = prev.findIndex((v) => v.id === nuovo.id);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = normalizzaImmagine({ ...copy[idx], ...raw });
            return copy;
          }
          return [nuovo, ...prev];
        });
        // Salva in cache la nuova immagine
        const blobPromise = raw.url_immagine
          ? fetch(raw.url_immagine).then(r => r.blob()).then(b => clientCache.saveToCache(raw.url_immagine, b)).catch(() => {})
          : Promise.resolve();
        blobPromise.then(() => clientCache.saveToIndexedDB({
          id: raw.id,
          url: raw.url_immagine,
          prompt: raw.prompt || '',
          buzz_cost: raw.civitai_buzz_cost || 0,
          stato: raw.stato,
          categoria: raw.categoria || 'generale',
          timestamp: raw.creato_il || Date.now()
        }));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session?.user?.id]);

  async function hydrataDaCache() {
    try {
      const metaList = await clientCache.getAllFromIndexedDB();
      if (!metaList || metaList.length === 0) return;
      const hydrate = metaList.map(meta => normalizzaImmagine(meta));
      setImmagini(hydrate);
      setCachePronta(true);
    } catch { /* silenzioso */ }
  }

  async function caricaImmagini() {
    if (!session?.user?.id) return;
    // Carica da immagini_generate
    const { data: t2i } = await supabase
      .from('immagini_generate')
      .select('*')
      .eq('user_id', session.user.id)
      .order('creato_il', { ascending: false });
    // Carica anche legacy da video_generati (per backward compat)
    const { data: legacy } = await supabase
      .from('video_generati')
      .select('*')
      .eq('user_id', session.user.id)
      .order('creato_il', { ascending: false });

    const combined = [
      ...(t2i || []).map(normalizzaImmagine),
      ...(legacy || []).map(normalizzaImmagine),
    ];
    // Deduplica per id
    const seen = new Set<string>();
    const deduped = combined.filter((img) => {
      if (seen.has(img.id)) return false;
      seen.add(img.id);
      return true;
    });
    setImmagini(deduped);

    // Salva in cache locale in background
    (async () => {
      for (const img of deduped) {
        if (img.url_immagine && img.stato === 'completata') {
          try {
            const existing = await clientCache.loadFromIndexedDB(img.id);
            if (!existing) {
              const resp = await fetch(img.url_immagine);
              const blob = await resp.blob();
              await clientCache.saveToCache(img.url_immagine, blob);
              await clientCache.saveToIndexedDB({
                id: img.id,
                url: img.url_immagine,
                prompt: img.prompt,
                buzz_cost: 0,
                stato: img.stato,
                categoria: img.categoria,
                timestamp: img.creato_il
              });
            }
          } catch { /* silenzioso */ }
        }
      }
    })();
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

  // ============ WEB SOCKET PER NOTIFICHE IN TEMPO REALE ============
  useEffect(() => {
    if (!session?.user?.id || wsRef.current) return;
    try {
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || `wss://${window.location.hostname}:8080`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'auth', token: session.access_token || '' }));
        ws.send(JSON.stringify({ type: 'join_room', room: 'room_user_' + session.user.id }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'generation_completed') {
            addToast('Nuova immagine pronta!', 'success', 5000);
            caricaImmagini();
          }
        } catch { /* silenzioso */ }
      };

      ws.onclose = () => { wsRef.current = null; };
      ws.onerror = () => { wsRef.current = null; };
    } catch { /* silenzioso */ }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [session?.user?.id]);

  async function handleLogout() {
    await supabase.auth.signOut();
    setSession(null);
    setProfilo(null);
    setImmagini([]);
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    router.replace('/');
  }

  function handleGoogleLogin() {
    // Usa redirect full-page invece di popup per evitare blocchi
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/app',
        queryParams: { access_type: 'offline', prompt: 'consent', scope: 'openid email profile' },
      },
    }).catch((err) => {
      console.error('Google OAuth error:', err);
      // Fallback: alert chiaro con istruzioni
      alert('Login Google non disponibile. Assicurati che Google OAuth sia configurato in Supabase Dashboard (Authentication \u2192 Providers \u2192 Google).');
    });
  }

  // ============ GENERAZIONE ============
  async function eseguiFree() {
    if (!session?.user?.id) return router.replace('/');
    if (!prompt.trim()) {
      addToast('Scrivi un prompt per generare un\'immagine.', 'warning', 4000);
      return;
    }

    setInviando(true);
    setMessaggio('Generazione immagine gratuita in corso...');

    try {
      await caricaProfilo(session.user.id);
      const { data: profiloFresh } = await supabase
        .from('profili')
        .select('crediti')
        .eq('id', session.user.id)
        .single();
      if ((profiloFresh?.crediti ?? 0) < 1) {
        setMessaggio('Crediti insufficienti. Acquista un piano Premium.');
        addToast('Crediti insufficienti. Acquista un piano Premium.', 'warning', 6000);
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
          aspect_ratio: aspectRatio,
          ottimizza_prompt: ottimizzaPrompt,
          categoria: categoria === 'Tutte' ? 'generale' : categoria,
        }),
      });
      const data = await resp.json();
      if (resp.ok) {
        setMessaggio(data.message || 'Immagine in generazione!');
        addToast('Immagine in generazione!', 'success', 5000);
        setPrompt('');
        setPromptNegativo('');
        setSeed('');
        await caricaProfilo(session.user.id);
        await caricaImmagini();
        setSezione('galleria');
        setFiltroGalleria('tutti');
        if (data.task_id) {
          // Poll leggero
          pollTask(data.task_id, data.image_id, session.user.id);
        }
      } else {
        addToast('Errore generazione: ' + (data.error || data.providerMessage || 'Errore non specificato'), 'error', 7000);
        alert(data.error || data.providerMessage || 'Errore generazione');
      }
    } catch (e: any) {
      addToast('Errore durante la generazione: ' + (e?.message || 'sconosciuto'), 'error', 7000);
      alert('Errore: ' + (e?.message || 'sconosciuto'));
    } finally {
      setInviando(false);
      setTimeout(() => setMessaggio(''), 8000);
    }
  }

  async function eseguiPremium() {
    if (!session?.user?.id) return router.replace('/');
    if (!prompt.trim()) return alert('Scrivi un prompt per generare un\'immagine Premium.');

    setInviando(true);
    setMessaggio('Generazione immagine Premium in corso...');

    try {
      const { data: profiloFresh } = await supabase
        .from('profili')
        .select('crediti')
        .eq('id', session.user.id)
        .single();
      if ((profiloFresh?.crediti ?? 0) < 2) {
        setMessaggio('Crediti insufficienti per Premium (servono 2 crediti).');
        alert('Crediti insufficienti! Servono almeno 2 crediti per Premium.');
        return;
      }

      trackGenera('premium');
      const resp = await fetch('/api/genera-premium', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          prompt: prompt.trim(),
          prompt_negativo: promptNegativo.trim(),
          seed: seed ? parseInt(seed) : null,
          aspect_ratio: aspectRatio,
          ottimizza_prompt: ottimizzaPrompt,
          modello: 'fal',
          categoria: categoria === 'Tutte' ? 'generale' : categoria,
        }),
      });
      const data = await resp.json();
      if (resp.ok) {
        setMessaggio(data.message || 'Immagine Premium in generazione!');
        setPrompt('');
        setPromptNegativo('');
        setSeed('');
        await caricaProfilo(session.user.id);
        await caricaImmagini();
        setSezione('galleria');
        setFiltroGalleria('tutti');
        setTimeout(() => { void caricaImmagini(); }, 3000);
        setTimeout(() => { void caricaImmagini(); }, 8000);
      } else {
        alert(data.error || 'Errore generazione Premium');
      }
    } catch (e: any) {
      alert('Errore: ' + (e?.message || 'sconosciuto'));
    } finally {
      setInviando(false);
      setTimeout(() => setMessaggio(''), 8000);
    }
  }

  async function pollTask(taskId: string, imageId: string | null, userId: string) {
    const MAX_ATTEMPTS = 36;
    const TIMEOUT_ATTEMPTS = 3; // After this many, check if image appeared via DB
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await new Promise((r) => setTimeout(r, 8000));
      try {
        const resp = await fetch('/api/wan-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId, imageId: imageId || undefined, userId }),
        });
        const data = await resp.json();
        if (data.status === 'SUCCEEDED' || data.status === 'FAILED') {
          await caricaImmagini();
          await caricaProfilo(userId);
          if (data.status === 'SUCCEEDED') {
            setMessaggio('Immagine completata! Vedi in Galleria.');
          } else {
            setMessaggio('Generazione fallita.');
          }
          return;
        }
        if (i > TIMEOUT_ATTEMPTS && i % 6 === 0) {
          // Periodic re-sync from DB (webhook may have completed it)
          await caricaImmagini();
          const done = immagini.some(img => img.id === imageId && img.stato !== 'generazione');
          if (done) {
            setMessaggio('Immagine pronta!');
            return;
          }
        }
        setMessaggio(`Generazione in corso... (${i + 1}/${MAX_ATTEMPTS})`);
      } catch { /* retry silently */ }
    }
    // Max timeout \u2014 mark as failed
    setMessaggio('Timeout generazione. Potrebbe essere ancora in elaborazione.');
    if (imageId) {
      await fetch('/api/wan-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, imageId, userId, forceFail: true }),
      }).catch(() => {});
      await caricaImmagini();
    }
  }

  // ============ STRIPE CHECKOUT ============
  async function avviaCheckout(pacchetto: 'starter' | 'pro') {
    if (!session?.user?.id) { setShowLogin(true); return; }
    trackCheckout(pacchetto);
    try {
      const resp = await fetch('/api/crea-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: session.user.id, pacchetto }),
      });
      const data = await resp.json();
      if (!resp.ok) { alert(data.error || 'Errore checkout.'); return; }
      if (data.url) { window.location.href = data.url; }
      else { alert('URL checkout mancante.'); }
    } catch (e: any) {
      alert('Errore checkout: ' + (e?.message || 'sconosciuto'));
    }
  }

  function etichettaPiano(pacchetto: 'starter' | 'pro') {
    const piano = (profilo?.piano || 'free') as string;
    if (piano === 'premium' || piano === 'starter' || piano === 'pro') {
      return { label: 'Cambia piano', disabled: false };
    }
    return { label: pacchetto === 'starter' ? 'Acquista Starter' : 'Acquista Pro', disabled: false };
  }

  // ============ FILTRAGGIO ============
  const immaginiFiltrate = immagini.filter((img) => {
    if (filtroGalleria === 'tutti') return true;
    return img.stato === filtroGalleria;
  });

  const immaginiPerCategoria = (catId: string) => {
    if (catId === 'Tutte') return immaginiFiltrate;
    return immaginiFiltrate.filter(img =>
      img.categoria?.toLowerCase() === catId.toLowerCase() ||
      img.categoria?.toLowerCase() === 'generale' && catId === 'Tutte'
    );
  };

  const immaginiCategoriaFiltrata = categoriaFiltro === 'Tutte'
    ? immaginiFiltrate
    : immaginiFiltrate.filter(img =>
        img.categoria?.toLowerCase() === categoriaFiltro.toLowerCase()
      );

  const creditiUtente = profilo?.crediti ?? 0;

  // Conteggi per ogni categoria nella sidebar
  const conteggiCategorie: Record<string, number> = {};
  CATEGORIE.forEach(cat => {
    if (cat.id === 'Tutte') {
      conteggiCategorie['Tutte'] = immagini.length;
    } else {
      conteggiCategorie[cat.id] = immagini.filter(img =>
        img.categoria?.toLowerCase() === cat.id.toLowerCase()
      ).length;
    }
  });

  // ============ RENDER SIDEBAR ============
  function renderSidebar() {
    const voci: { id: Sezione; icona: string; label: string }[] = [
      { id: 'casa', icona: '\ud83c\udfe0', label: 'Casa' },
      { id: 'galleria', icona: '\ud83d\uddbc\ufe0f', label: 'Galleria' },
      { id: 'integrazioni', icona: '\ud83d\udd17', label: 'Integrazioni' },
    ];

    return (
      <aside className="fixed left-0 top-0 bottom-0 w-64 z-50 bg-surface border-r border-white/[0.06] flex flex-col">
        <div className="px-6 py-6 border-b border-white/[0.06]">
          <a href="/" className="flex items-center gap-2.5" aria-label="JumbAI Home - Landing Page">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-violet to-roseSoft text-white font-display font-bold text-base shadow-lg shadow-violet/20">J</span>
            <span className="font-display text-xl tracking-tight text-textMain">JumbAI</span>
          </a>
        </div>

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
          <div className="pt-4 pb-2">
            <p className="px-4 text-[10px] font-semibold uppercase tracking-wider text-coolGray/50">Filtra per Categoria</p>
          </div>
          {CATEGORIE.map((cat) => {
            const conteggio = conteggiCategorie[cat.id] || 0;
            const isActive = categoriaFiltro === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  // Se gia' attiva, resetta a 'Tutte'
                  setCategoriaFiltro(isActive && cat.id !== 'Tutte' ? 'Tutte' : cat.id);
                  setSezione('galleria');
                }}
                className={`sidebar-item w-full text-xs ${isActive ? 'active' : ''}`}
              >
                <span>{cat.icona}</span>
                <span className="flex-1 text-left">{cat.id}</span>
                {conteggio > 0 && (
                  <span className="text-[10px] font-bold bg-violet/20 text-violetSoft px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                    {conteggio}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-white/[0.06]">
          {session ? (
            <div className="badge-crediti border-violet/30 bg-violet/10 text-violetSoft">
              <span>{creditiUtente}</span>
              <span>crediti</span>
            </div>
          ) : (
            <div className="badge-crediti border-amber/30 bg-amber/10 text-amber">
              <span>Free</span>
            </div>
          )}
        </div>

        <div className="px-4 py-4 border-t border-white/[0.06]">
          {session ? (
            <div className="space-y-2">
              <p className="text-xs text-coolGray truncate">{session.user?.email}</p>
              <button onClick={handleLogout} className="text-xs text-roseSoft hover:text-white transition">Esci</button>
            </div>
          ) : (
            <button onClick={() => setShowLogin(true)} className="w-full rounded-xl bg-violet text-white text-sm font-semibold py-2.5 hover:bg-violet/90 transition shadow-lg shadow-violet/20">
              Accedi / Registrati
            </button>
          )}
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
              <h2 className="font-display text-2xl lg:text-3xl font-bold tracking-tight">Genera Immagine</h2>
              <p className="text-sm text-coolGray">Trasforma le tue parole in immagini AI di alta qualit&agrave;.</p>
            </div>
          </div>

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
            {/* Template chips */}
            <div className="flex flex-wrap gap-2 mt-3">
              {[
                { label: 'Ritratto', text: CATEGORIE[1].prompt },
                { label: 'Fantasy', text: CATEGORIE[2].prompt },
                { label: 'Anime', text: CATEGORIE[3].prompt },
                { label: 'Paesaggio', text: CATEGORIE[4].prompt },
                { label: 'Cibo', text: CATEGORIE[6].prompt },
                { label: 'Moda', text: CATEGORIE[7].prompt },
              ].map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => { setPrompt(chip.text); setCategoria(chip.label); }}
                  className="rounded-full px-3 py-1.5 text-xs font-medium glass border border-white/[0.08] text-coolGray hover:text-textMain hover:border-violet/40 hover:bg-violet/10 transition"
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* Categorie cliccabili */}
            <div className="mt-5">
              <p className="text-sm font-medium text-coolGray mb-2">Categorie</p>
              <div className="flex flex-wrap gap-2">
                {CATEGORIE.filter(c => c.id !== 'Tutte').map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => { setCategoria(cat.id); if (cat.prompt && !prompt) setPrompt(cat.prompt); }}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition border ${
                      categoria === cat.id
                        ? 'bg-violet/20 text-violetSoft border-violet/30'
                        : 'bg-ink border-white/[0.08] text-coolGray hover:text-textMain hover:border-violet/40'
                    }`}
                  >
                    <span>{cat.icona}</span>
                    <span>{cat.id}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Galleria Ispirati */}
            {ispiratiItems.length > 0 && (
              <div className="mt-5">
                <p className="text-sm font-medium text-coolGray mb-2">Ispirati</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {ispiratiItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => { setPrompt(item.prompt); setCategoria(item.categoria || 'generale'); }}
                      className={`text-left rounded-xl p-3 border border-white/[0.08] bg-gradient-to-br ${item.gradient} bg-opacity-20 hover:border-violet/40 transition min-h-[72px]`}
                    >
                      <span className="text-xs font-semibold text-white drop-shadow">{item.titolo}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Aspect Ratio */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-coolGray mb-2">Formato (aspect ratio)</label>
            <div className="flex flex-wrap gap-2">
              {ASPECT_RATIOS.map((ar) => (
                <button
                  key={ar.id}
                  type="button"
                  onClick={() => setAspectRatio(ar.id)}
                  className={`rounded-xl px-3 py-2 text-xs font-medium transition border ${
                    aspectRatio === ar.id
                      ? 'bg-violet/20 text-violetSoft border-violet/30'
                      : 'bg-ink border-white/[0.08] text-coolGray hover:text-textMain hover:border-violet/40'
                  }`}
                >
                  {ar.label}
                </button>
              ))}
            </div>
          </div>

          {/* Impostazioni Avanzate (espandibile) */}
          <div className="mb-4">
            <button
              onClick={() => setShowAvanzate(!showAvanzate)}
              className="flex items-center gap-2 text-sm text-coolGray hover:text-textMain transition"
            >
              <span className={`transition ${showAvanzate ? 'rotate-90' : ''}`}>&#9654;</span>
              Impostazioni Avanzate
            </button>
            {showAvanzate && (
              <div className="mt-4 p-5 rounded-2xl bg-ink border border-white/[0.08] grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-coolGray mb-2">Prompt Negativo</label>
                  <input
                    value={promptNegativo}
                    onChange={(e) => setPromptNegativo(e.target.value)}
                    placeholder="Cosa NON deve apparire (es. sfocato, artefatti)"
                    className="input-jumbai"
                  />
                </div>
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
                <div className="flex items-center justify-between">
                  <span className="text-sm text-coolGray">Ottimizzazione Automatica Prompt</span>
                  <div className={`toggle-bg ${ottimizzaPrompt ? 'active' : ''}`} onClick={() => setOttimizzaPrompt(!ottimizzaPrompt)}>
                    <div className="toggle-dot"></div>
                  </div>
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
              {session ? <span className="text-xs text-coolGray">1 cr</span> : null}
            </button>
            <button
              onClick={eseguiPremium}
              disabled={inviando}
              className="rounded-xl bg-gradient-to-r from-violet to-roseSoft text-white font-bold py-3.5 shadow-lg shadow-violet/30 hover:shadow-violet/50 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {inviando ? '...' : ''} Genera Premium <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded-md">2 cr</span>
            </button>
          </div>
          <p className="mt-2 text-xs text-coolGray text-center">
            Gratis = Wan (DashScope). Premium = Fal.ai SDXL. 1 credito per immagine Free, 2 per Premium.
          </p>

          {/* Messaggio */}
          {messaggio && (
            <div className="mt-4 rounded-xl bg-violet/10 border border-violet/20 text-violetSoft px-5 py-4 text-sm font-medium flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-violet animate-pulse"></span>
              <span>{messaggio}</span>
            </div>
          )}

          {/* Checkout message */}
          {checkoutMsg && (
            <div className="mt-4 rounded-xl bg-emerald/10 border border-emerald/20 text-emerald px-5 py-4 text-sm font-medium">
              {checkoutMsg}
            </div>
          )}
        </div>

        {/* PREZZI */}
        <section className="mt-12">
          <div className="text-center mb-8">
            <h2 className="font-display text-3xl lg:text-4xl font-bold tracking-tight">
              Scegli il tuo <span className="gradient-text">Piano</span>
            </h2>
            <p className="mt-2 text-sm text-coolGray">Inizia gratis con 3 crediti. Passa a Premium quando serve.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Free */}
            <div className="glass-card rounded-3xl p-8 hover:-translate-y-1 transition relative">
              <span className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-widest bg-surface3 text-coolGray px-2.5 py-1 rounded-full">Free</span>
              <h3 className="font-display text-2xl font-bold mb-1">0<span className="text-sm text-coolGray font-normal">/sempre</span></h3>
              <p className="text-sm text-coolGray mb-4">3 crediti gratuiti per iniziare. Nessuna carta richiesta.</p>
              <ul className="text-sm text-coolGray space-y-2 mb-6">
                <li>Immagini con Wan T2I</li>
                <li>Tutti i formati</li>
                <li>Nessuna fatturazione</li>
              </ul>
              <button type="button" disabled className="w-full rounded-xl bg-surface2 border border-white/[0.10] text-coolGray font-semibold py-3 cursor-not-allowed opacity-80">
                Gi&agrave; in utilizzo
              </button>
            </div>

            {/* Starter */}
            <div className="glass-card rounded-3xl p-8 hover:-translate-y-1 transition relative">
              <span className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-widest bg-surface3 text-coolGray px-2.5 py-1 rounded-full">Starter</span>
              <h3 className="font-display text-2xl font-bold mb-1">6<span className="text-sm text-coolGray font-normal"> una tantum</span></h3>
              <p className="text-sm text-coolGray mb-4">10 immagini premium con Fal.ai SDXL</p>
              <ul className="text-sm text-coolGray space-y-2 mb-6">
                <li>10 immagini Premium</li>
                <li>Qualit&agrave; SDXL superiore</li>
                <li>Tutti i formati aspect ratio</li>
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
              <h3 className="font-display text-2xl font-bold mb-1">15<span className="text-sm text-coolGray font-normal"> una tantum</span></h3>
              <p className="text-sm text-coolGray mb-4">100 immagini premium + code prioritarie</p>
              <ul className="text-sm text-coolGray space-y-2 mb-6">
                <li>100 immagini Premium</li>
                <li>Qualit&agrave; SDXL + priorita code</li>
                <li>Tutti i formati + negativo prompt</li>
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
          <div className="flex flex-wrap items-center justify-center gap-6 mt-6 text-xs text-coolGray">
            <span>Pagamento sicuro Stripe</span>
            <span>Visa &middot; Mastercard &middot; PayPal</span>
          </div>
        </section>
      </div>
    );
  }

  // ============ RENDER GALLERIA ============
  function renderGalleria() {
    const filtri: { id: FiltroGalleria; label: string }[] = [
      { id: 'tutti', label: 'Tutti' },
      { id: 'generazione', label: 'In Generazione' },
      { id: 'completata', label: 'Completate' },
      { id: 'fallita', label: 'Fallite' },
    ];

    return (
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-3xl lg:text-4xl font-bold tracking-tight">La tua Galleria</h2>
            {categoriaFiltro !== 'Tutte' && (
              <span className="inline-flex items-center gap-1 text-xs font-medium bg-violet/20 text-violetSoft border border-violet/30 px-3 py-1 rounded-full">
                <span>{CATEGORIE.find(c => c.id === categoriaFiltro)?.icona}</span>
                {categoriaFiltro}
                <button onClick={() => setCategoriaFiltro('Tutte')} className="ml-1 hover:text-white">&times;</button>
              </span>
            )}
          </div>
          <button onClick={caricaImmagini} className="text-sm font-medium text-violetSoft hover:text-white transition">Aggiorna</button>
        </div>

        {/* Filtri per stato */}
        <div className="flex flex-wrap gap-2 mb-6">
          {filtri.map((f) => (
            <button
              key={f.id}
              onClick={() => setFiltroGalleria(f.id)}
              className={`filter-btn ${filtroGalleria === f.id ? 'active' : ''}`}
            >
              {f.label} {f.id !== 'tutti' && `(${immagini.filter(v => v.stato === f.id).length})`}
            </button>
          ))}
        </div>

        {!session ? (
          <div className="glass-card rounded-3xl p-12 text-center">
            <p className="mt-4 text-coolGray">Accedi per vedere le tue immagini.</p>
            <button onClick={() => setShowLogin(true)} className="mt-4 rounded-xl bg-violet text-white font-semibold px-6 py-2.5 hover:bg-violet/90 transition">Accedi</button>
          </div>
        ) : immaginiCategoriaFiltrata.length === 0 ? (
          <div className="glass-card rounded-3xl p-12 text-center">
            <p className="mt-4 text-coolGray">Nessuna immagine trovata in questa categoria.</p>
            <p className="text-xs text-coolGray mt-1">Genera la prima dalla sezione Casa!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {immaginiCategoriaFiltrata.map((img) => (
              <article key={img.id} className="video-card cursor-pointer" onClick={() => setLightboxImg(img)}>
                <div className="relative bg-ink2 aspect-square flex items-center justify-center overflow-hidden rounded-t-2xl">
                  {img.stato === 'generazione' && (
                    <span className="status-badge bg-amber/20 text-amber border border-amber/30">In Generazione</span>
                  )}
                  {img.stato === 'completata' && (
                    <span className="status-badge bg-emerald/20 text-emerald border border-emerald/30">Completata</span>
                  )}
                  {img.stato === 'fallita' && (
                    <span className="status-badge bg-red/20 text-red-400 border border-red/30">Fallita</span>
                  )}

                  {img.stato === 'generazione' ? (
                    <div className="text-center px-4">
                      <div className="shimmer w-full h-full absolute inset-0"></div>
                      <div className="relative z-10">
                        <span className="inline-block w-8 h-8 rounded-full border-2 border-amber border-t-transparent animate-spin"></span>
                        <p className="text-xs text-coolGray mt-2">{img.prompt?.substring(0, 40)}...</p>
                      </div>
                    </div>
                  ) : img.stato === 'completata' && img.url_immagine ? (
                    <img src={img.url_immagine} alt={img.prompt || 'Immagine generata'} className="w-full h-full object-cover" />
                  ) : img.stato === 'fallita' ? (
                    <div className="text-center px-4">
                      <p className="text-xs text-red-400 mt-1">{img.errore || 'Errore sconosciuto'}</p>
                    </div>
                  ) : (
                    <div className="shimmer w-full h-full"></div>
                  )}
                </div>
                <div className="p-4">
                  <p className="text-xs text-coolGray mb-2 line-clamp-2">{img.prompt}</p>
                  <div className="flex items-center justify-between text-[10px] text-white/40">
                    <span>{img.categoria} &middot; {img.size}</span>
                    <span>{new Date(img.creato_il).toLocaleDateString('it-IT')}</span>
                  </div>
                  {img.stato === 'completata' && img.url_immagine && (
                    <div className="mt-2">
                      <a
                        href={img.url_immagine}
                        download={`jumbai-${img.id}.png`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center rounded-lg bg-violet/20 border border-violet/30 text-violetSoft text-[11px] font-bold py-2 px-3 hover:bg-violet/30 transition"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Scarica
                      </a>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Lightbox */}
        {lightboxImg && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setLightboxImg(null)}>
            <div className="relative max-w-3xl w-full max-h-[90vh] overflow-auto glass-card rounded-3xl p-6" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setLightboxImg(null)}
                className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition"
              >
                &#10005;
              </button>
              {lightboxImg.url_immagine && (
                <img src={lightboxImg.url_immagine} alt={lightboxImg.prompt} className="w-full rounded-2xl max-h-[60vh] object-contain" />
              )}
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium">{lightboxImg.prompt}</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full px-2 py-0.5 bg-violet/20 text-violetSoft">{lightboxImg.categoria}</span>
                  <span className="rounded-full px-2 py-0.5 bg-ink border border-white/[0.08]">Seed: {lightboxImg.seed || 'casuale'}</span>
                  <span className="rounded-full px-2 py-0.5 bg-ink border border-white/[0.08]">{lightboxImg.modello}</span>
                  <span className="rounded-full px-2 py-0.5 bg-ink border border-white/[0.08]">{lightboxImg.size}</span>
                </div>
                <p className="text-[10px] text-white/40">
                  {new Date(lightboxImg.creato_il).toLocaleString('it-IT')}
                </p>
                {lightboxImg.url_immagine && (
                  <a
                    href={lightboxImg.url_immagine}
                    download={`jumbai-${lightboxImg.id}.png`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet to-roseSoft text-white text-sm font-bold px-5 py-2.5 shadow-lg shadow-violet/20 hover:shadow-violet/40 transition mt-2"
                  >
                    Scarica Immagine
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============ RENDER INTEGRAZIONI ============
  function renderIntegrazioni() {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h2 className="font-display text-3xl lg:text-4xl font-bold tracking-tight">Integrazioni</h2>
          <p className="text-sm text-coolGray mt-1">Connetti i tuoi servizi preferiti per automatizzare il workflow.</p>
        </div>
        <div className="space-y-4">
          {[
            { name: 'Discord', desc: 'Notifiche automatiche quando un\'immagine &egrave; pronta.', connected: false },
            { name: 'X (Twitter)', desc: 'Pubblica le tue immagini direttamente su X.', connected: false },
            { name: 'Telegram', desc: 'Ricevi le immagini su Telegram.', connected: false },
            { name: 'Slack', desc: 'Condividi le immagini nel tuo team Slack.', connected: false },
          ].map((int) => (
            <div key={int.name} className="glass-card rounded-2xl p-6 flex items-center justify-between">
              <div>
                <h3 className="font-display font-semibold">{int.name}</h3>
                <p className="text-xs text-coolGray">{int.desc}</p>
              </div>
              <button
                type="button"
                disabled
                className={`rounded-lg px-4 py-2 text-xs font-semibold transition opacity-70 cursor-not-allowed ${
                  int.connected ? 'bg-emerald/20 text-emerald border border-emerald/30' : 'bg-surface2 text-coolGray border border-white/[0.10]'
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

  // ============ RENDER SEZIONE PRINCIPALE ============
  function renderContent() {
    switch (sezione) {
      case 'casa': return renderCasa();
      case 'galleria': return renderGalleria();
      case 'integrazioni': return renderIntegrazioni();
    }
  }

  // ============ MODALE LOGIN ============
  function renderLoginModal() {
    if (!showLogin) return null;
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowLogin(false)}>
        <div className="glass-card rounded-3xl p-8 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
          <div className="text-center mb-6">
            <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-violet to-roseSoft text-white font-display font-bold text-2xl shadow-lg shadow-violet/20 mb-3">J</span>
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
            <button
              onClick={handleGoogleLogin}
              className="w-full rounded-xl bg-white text-ink font-bold py-3 shadow-lg hover:bg-gray-100 transition flex items-center justify-center gap-2 mb-3"
            >
              Continua con Google
            </button>
            <div className="flex items-center gap-3 text-xs text-coolGray my-2">
              <span className="flex-1 h-px bg-white/10"></span> oppure <span className="flex-1 h-px bg-white/10"></span>
            </div>
            <button onClick={handleAuth} className="w-full rounded-xl bg-gradient-to-r from-violet to-roseSoft text-white font-bold py-3 shadow-lg shadow-violet/30 hover:shadow-violet/50 transition">
              {isRegistrazione ? 'Registrati' : 'Accedi'}
            </button>
            <p className="text-center text-sm text-coolGray">
              {isRegistrazione ? 'Hai gi\u00e0 un account?' : 'Non hai un account?'}{' '}
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

  return (
    <div className="min-h-screen bg-ink">
      {renderSidebar()}
      <div className="ml-64 min-h-screen">
        <header className="sticky top-0 z-40 h-16 glass border-b border-white/[0.05] flex items-center justify-between px-8">
          <div>
            <h1 className="font-display text-lg font-bold">
              {sezione === 'casa' && 'Casa'}
              {sezione === 'galleria' && 'Galleria'}
              {sezione === 'integrazioni' && 'Integrazioni'}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {session ? (
              <div className="badge-crediti border-violet/30 bg-violet/10 text-violetSoft text-xs">
                <span>Crediti: <strong className="tabular-nums">{creditiUtente}</strong></span>
              </div>
            ) : (
              <div className="badge-crediti border-amber/30 bg-amber/10 text-amber text-xs">
                <span>Piano: Free</span>
              </div>
            )}
            <div className="relative">
              <button
                type="button"
                onClick={() => { if (!session) { setShowLogin(true); return; } setShowAccountMenu((v) => !v); }}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] pl-1.5 pr-3 py-1 text-sm text-violetSoft hover:text-white hover:border-violet/40 hover:bg-violet/10 transition"
              >
                {session ? (
                  <>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-violet to-roseSoft text-[11px] font-bold text-white">
                      {(session.user?.email || "?").charAt(0).toUpperCase()}
                    </span>
                    <span className="max-w-[9rem] truncate">{session.user?.email?.split("@")[0]}</span>
                  </>
                ) : (
                  <span className="px-1">Accedi</span>
                )}
              </button>
              {session && showAccountMenu && (
                <>
                  <button type="button" aria-label="Chiudi" className="fixed inset-0 z-40 cursor-default bg-black/20" onClick={() => setShowAccountMenu(false)} />
                  <div role="menu" className="absolute right-0 mt-2 w-64 origin-top-right rounded-2xl border border-white/10 bg-ink/95 p-2 shadow-2xl shadow-black/50 ring-1 ring-violet/20 backdrop-blur-md z-50">
                    <div className="rounded-xl bg-white/[0.03] px-3 py-3 mb-1">
                      <p className="text-xs text-coolGray mb-1">{session.user?.email}</p>
                      <p className="text-xs text-violetSoft">Crediti: <strong>{creditiUtente}</strong></p>
                    </div>
                    <button type="button" className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-textMain hover:bg-violet/15 hover:text-violetSoft transition" onClick={() => { setSezione("galleria"); setShowAccountMenu(false); }}>La mia galleria</button>
                    <button type="button" className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-textMain hover:bg-violet/15 hover:text-violetSoft transition" onClick={() => { setSezione("casa"); setShowAccountMenu(false); }}>Genera immagine</button>
                    <div className="my-1 h-px bg-white/10" />
                    <button type="button" className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-roseSoft hover:bg-roseSoft/10 hover:text-white transition" onClick={() => { setShowAccountMenu(false); void handleLogout(); }}>Esci</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>
        <main className="p-8 lg:p-10">
          {renderContent()}
        </main>
        <footer className="border-t border-white/[0.08] py-8 text-center text-coolGray text-xs">
          <p>JumbAI 3.0 &mdash; AI Image Generator. Text-to-Image con Wan e Fal.ai.</p>
        </footer>
      </div>
      {renderLoginModal()}
      {/* Toast notifications */}
      <div className="fixed top-0 right-0 z-[200] p-4 space-y-2 pointer-events-none">
        {toasts.map((t, idx) => (
          <div key={t.id} className="pointer-events-auto">
            <Toast
              message={t.message}
              type={t.type}
              duration={4000}
              onClose={() => removeToast(t.id)}
              offset={idx * 60}
            />
          </div>
        ))}
      </div>
    </div>
  );
}