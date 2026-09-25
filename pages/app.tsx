/* ================================================================
   JumbAI APP — Dashboard / Generatore Immagini
   Design: dark glass morphing con gradienti violet/rose
   Route: /app (autenticato)
   ================================================================ */

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase-client';
import { trackGenera, trackCheckout } from '../lib/analytics';
import Toast from '../components/Toast';
import { clientCache, syncWithGalleryBackend } from '../lib/client-cache';

// --- tipo dati ---
type Sezione = 'casa' | 'galleria' | 'integrazioni';
type FiltroGalleria = 'tutti' | 'generazione' | 'completata' | 'fallita';
type StatoImmagine = 'generazione' | 'completata' | 'fallita';
type Aspetto = '1:1' | '4:3' | '3:4' | '16:9' | '9:16' | '3:2' | '2:3';

interface Immagine {
  id: string; user_id: string; prompt: string; prompt_negativo: string;
  seed: number | null; modello: string; categoria: string; size: string;
  url_immagine: string | null; provider: string; stato: StatoImmagine;
  errore: string | null; creato_il: string; completato_il: string | null;
}

const CATEGORIE = [
  { id: 'Tutte', icona: '✨', colore: 'from-violet to-roseSoft', prompt: '' },
  { id: 'Ritratto', icona: '👤', colore: 'from-violet to-purple-700', prompt: 'Ritratto fotorealistico, luce morbida dorata, profondità di campo, texture della pelle naturale, sfondo sfocato bokeh' },
  { id: 'Fantasy', icona: '🧙', colore: 'from-fuchsia-500 to-purple-700', prompt: 'Scena fantasy epica, castello galleggiante, cascate luminose, atmosfera magica, colori vibranti' },
  { id: 'Anime', icona: '🎮', colore: 'from-sky-400 to-indigo-600', prompt: 'Stile anime giapponese, personaggio dettagliato, colori vividi, sfondo città illuminata al neon' },
  { id: 'Paesaggio', icona: '🏞️', colore: 'from-emerald-500 to-teal-700', prompt: 'Paesaggio mozzafiato, montagne al tramonto, lago cristallino, fotografia HDR, luce naturale' },
  { id: 'Architettura', icona: '🏛️', colore: 'from-zinc-400 to-zinc-700', prompt: 'Architettura moderna, grattacielo in vetro e acciaio, rendering architettonico 8K, design minimalista' },
  { id: 'Cibo', icona: '🍽️', colore: 'from-amber-500 to-orange-700', prompt: 'Fotografia culinaria professionale, piatto gourmet, luce calda, profondità di campo, dettaglio croccante' },
  { id: 'Moda', icona: '👗', colore: 'from-red-500 to-rose-700', prompt: 'Fotografia di moda, street style, atmosfera grintosa, illuminazione soffusa, texture tessuti' },
  { id: 'Astratto', icona: '🎨', colore: 'from-cyan-500 to-blue-600', prompt: 'Arte astratta geometrica, gradienti fluidi, texture digitali, forme organiche colorate' },
];

const ASPECT_RATIOS = [
  { id: '1:1' as Aspetto, label: 'Quadrato (1:1)' },
  { id: '4:3' as Aspetto, label: 'Orizzontale (4:3)' },
  { id: '3:4' as Aspetto, label: 'Verticale (3:4)' },
  { id: '16:9' as Aspetto, label: 'Widescreen (16:9)' },
  { id: '9:16' as Aspetto, label: 'Storie (9:16)' },
  { id: '3:2' as Aspetto, label: 'Classico (3:2)' },
];

export default function AppDashboard() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [profilo, setProfilo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sezione, setSezione] = useState<Sezione>('casa');
  const [filtroGalleria, setFiltroGalleria] = useState<FiltroGalleria>('tutti');
  const [categoriaFiltro, setCategoriaFiltro] = useState('Tutte');
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
  const [toasts, setToasts] = useState<{id:string;type:string;message:string}[]>([]);
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistrazione, setIsRegistrazione] = useState(false);
  const [lightboxImg, setLightboxImg] = useState<Immagine|null>(null);
  const [checkoutMsg, setCheckoutMsg] = useState('');
  const wsRef = useRef<WebSocket|null>(null);

  function addToast(m: string, t = 'info', d = 4000) {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts(p => [...p, {id, type: t, message: m}]);
    setTimeout(() => setToasts(p => p.filter(x => x.id !== id)), d + 300);
  }
  const removeToast = (id: string) => setToasts(p => p.filter(t => t.id !== id));

  // --- Auth ---
  useEffect(() => {
    supabase.auth.getSession().then(({data:{session}}) => {
      setSession(session);
      if (!session) router.replace('/');
      else caricaProfilo(session.user.id);
      setLoading(false);
    });
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) router.replace('/');
      else if (s.user?.id) caricaProfilo(s.user.id);
    });
    return () => subscription.unsubscribe();
  }, [router]);

  // --- Cache hydration ---
  useEffect(() => {
    if (!session?.user?.id) return;
    (async () => {
      try {
        const meta = await clientCache.getAllFromIndexedDB();
        if (!meta?.length) return;
        const list = meta.map((m: any) => ({
          id: m.id, user_id: session.user.id, prompt: m.prompt||'',
          stato: m.stato||'generazione', categoria: m.categoria||'generale',
          url_immagine: m.url||null, creato_il: m.timestamp||new Date().toISOString(),
          completato_il: null, provider: 'wan', size: '1024*1024', seed: null,
          prompt_negativo: '', modello: 'wanx2.1-t2i-turbo', errore: null
        }));
        setImmagini(list);
      } catch {}
    })();
  }, [session?.user?.id]);

  // --- Real-time DB + Cache save ---
  useEffect(() => {
    if (!session?.user?.id) return;
    caricaImmagini();
    const ch = supabase.channel('immagini_changes')
      .on('postgres_changes', { event:'*', schema:'public', table:'immagini_generate', filter:`user_id=eq.${session.user.id}` }, (payload) => {
        const raw = payload.new as any;
        if (!raw?.id) return;
        setImmagini(prev => {
          const idx = prev.findIndex(v => v.id === raw.id);
          const n = { id: raw.id, user_id: session.user.id, prompt: raw.prompt||'', prompt_negativo: '', seed: raw.seed||null, modello: raw.modello||'wan', categoria: raw.categoria||'generale', size: raw.size||'1024*1024', url_immagine: raw.url_immagine||null, provider: raw.provider||'wan', stato: raw.stato||'generazione', errore: raw.errore||null, creato_il: raw.creato_il||new Date().toISOString(), completato_il: raw.completato_il||null };
          if (idx >= 0) { const c = [...prev]; c[idx] = n; return c; }
          return [n, ...prev];
        });
        // Cache update
        if (raw.url_immagine && raw.stato === 'completata') {
          fetch(raw.url_immagine).then(r => r.blob()).then(b => clientCache.saveToCache(raw.url_immagine, b)).catch(() => {});
          clientCache.saveToIndexedDB({ id: raw.id, url: raw.url_immagine, prompt: raw.prompt||'', buzz_cost: raw.civitai_buzz_cost||0, stato: raw.stato, categoria: raw.categoria||'generale', timestamp: raw.creato_il || Date.now() });
        }
      }).subscribe();

    return () => {
      // Cleanup: remove channel synchronously (ignore Promise return)
      supabase.removeChannel(ch);
    };
  }, [session?.user?.id]);

  // --- WebSocket real-time ---
  useEffect(() => {
    if (!session?.user?.id) return;
    try {
      const ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL || `wss://${window.location.hostname}:8080`);
      wsRef.current = ws;
      ws.onopen = () => { ws.send(JSON.stringify({type:'auth',token:session.access_token||''})); ws.send(JSON.stringify({type:'join_room',room:'room_user_'+session.user.id})); };
      ws.onmessage = (e) => { try { const msg = JSON.parse(e.data); if (msg.type==='generation_completed') { addToast('Immagine pronta!', 'success', 5000); caricaImmagini(); } } catch {} };
      ws.onerror = () => { wsRef.current = null; };
      ws.onclose = () => { wsRef.current = null; };
    } catch {}
    return () => { if (wsRef.current) { wsRef.current.close(); wsRef.current = null; } };
  }, [session?.user?.id]);

  async function caricaProfilo(uid: string) {
    try { await fetch('/api/claim-free-credits', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({userId:uid}) }); } catch {}
    const { data } = await supabase.from('profili').select('crediti,piano').eq('id', uid).single();
    setProfilo(data);
  }

  async function caricaImmagini() {
    if (!session?.user?.id) return;
    try {
      const { data: t2i } = await supabase.from('immagini_generate').select('*').eq('user_id', session.user.id).order('creato_il', {ascending:false});
      const { data: legacy } = await supabase.from('video_generati').select('*').eq('user_id', session.user.id).order('creato_il', {ascending:false});
      const combined = [ ...(t2i||[]).map(n => ({id:n.id,user_id:n.user_id,prompt:n.prompt||n.prompt_usato||'',prompt_negativo:n.prompt_negativo||'',seed:n.seed||null,modello:n.modello||'wanx2.1-t2i-turbo',categoria:n.categoria||'generale',size:n.size||'1024*1024',url_immagine:n.url_immagine||null,provider:n.provider||'wan',stato:n.stato||'generazione',errore:n.errore||null,creato_il:n.creato_il||new Date().toISOString(),completato_il:n.completato_il||null})), ...(legacy||[]).map(n => ({id:n.id,user_id:n.user_id,prompt:n.prompt||n.prompt_usato||'',prompt_negativo:n.prompt_negativo||'',seed:n.seed||null,modello:n.modello||'wanx2.1-t2i-turbo',categoria:n.categoria||'generale',size:n.size||'1024*1024',url_immagine:n.url_video||null,provider:'wan',stato:n.stato||'generazione',errore:null,creato_il:n.creato_il||new Date().toISOString(),completato_il:null})) ];
      const seen = new Set<string>();
      const deduped = combined.filter(img => { if (seen.has(img.id)) return false; seen.add(img.id); return true; });
      setImmagini(deduped);
    } catch {}
  }

  // --- Generation ---
  async function eseguiFree() {
    if (!session?.user?.id) return router.replace('/');
    if (!prompt.trim()) { addToast('Scrivi un prompt.', 'warning', 4000); return; }
    setInviando(true); setMessaggio('Generazione gratuita in corso...');
    try {
      await caricaProfilo(session.user.id);
      const {data} = await supabase.from('profili').select('crediti').eq('id',session.user.id).single();
      if ((data?.crediti??0) < 1) { addToast('Crediti insufficienti.', 'warning', 6000); setInviando(false); return; }
      trackGenera('free');
      const resp = await fetch('/api/genera-immagine-free', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:session.user.id,prompt:prompt.trim(),prompt_negativo:promptNegativo.trim(),seed:seed?parseInt(seed):null,aspect_ratio:aspectRatio,ottimizza_prompt:ottimizzaPrompt,categoria:categoria==='Tutte'?'generale':categoria})});
      const d = await resp.json();
      if (resp.ok) { addToast('Immagine in generazione!', 'success', 5000); setPrompt(''); setPromptNegativo(''); setSeed(''); await caricaProfilo(session.user.id); await caricaImmagini(); setSezione('galleria'); setFiltroGalleria('tutti'); }
      else addToast('Errore: '+(d.error||''), 'error', 7000);
    } catch (e:any) { addToast('Errore: '+(e?.message||''),'error',7000); }
    finally { setInviando(false); setTimeout(()=>setMessaggio(''),8000); }
  }

  async function eseguiPremium() {
    if (!session?.user?.id) return router.replace('/');
    if (!prompt.trim()) { alert('Scrivi un prompt.'); return; }
    setInviando(true); setMessaggio('Generazione Premium in corso...');
    try {
      const {data} = await supabase.from('profili').select('crediti').eq('id',session.user.id).single();
      if ((data?.crediti??0) < 2) { alert('Servono 2 crediti per Premium.'); setInviando(false); return; }
      trackGenera('premium');
      const resp = await fetch('/api/genera-premium',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:session.user.id,prompt:prompt.trim(),prompt_negativo:promptNegativo.trim(),seed:seed?parseInt(seed):null,aspect_ratio:aspectRatio,ottimizza_prompt:ottimizzaPrompt,modello:'fal',categoria:categoria==='Tutte'?'generale':categoria})});
      const d = await resp.json();
      if (resp.ok) { setMessaggio('Premium in generazione!'); setPrompt(''); setPromptNegativo(''); setSeed(''); await caricaProfilo(session.user.id); await caricaImmagini(); setSezione('galleria'); setFiltroGalleria('tutti'); }
      else alert('Errore generazione Premium');
    } catch (e:any){ alert('Errore'); }
    finally { setInviando(false); setTimeout(()=>setMessaggio(''),8000); }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setSession(null); setProfilo(null); setImmagini([]);
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    router.replace('/');
  }

  // --- Render ---
  const creditiUtente = profilo?.crediti ?? 0;
  const immaginiFiltrate = immagini.filter(img => filtroGalleria === 'tutti' || img.stato === filtroGalleria);
  const immaginiCategoriaFiltrata = categoriaFiltro === 'Tutte' ? immaginiFiltrate : immaginiFiltrate.filter(img => img.categoria?.toLowerCase() === categoriaFiltro.toLowerCase());

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink">
        <div className="text-center"><span className="inline-block w-10 h-10 rounded-full border-2 border-violet border-t-transparent animate-spin"></span><p className="mt-4 text-coolGray text-sm">Caricamento...</p></div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink text-textMain">
        <div className="glass-card rounded-3xl p-10 max-w-md text-center shadow-2xl border-violet/20">
          <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-violet to-roseSoft text-white font-display font-bold text-2xl shadow-lg shadow-violet/20 mb-3">J</span>
          <h2 className="font-display text-3xl font-bold mb-3">JumbAI Dashboard</h2>
          <p className="text-coolGray mb-6">Autenticati per accedere al generatore.</p>
          <button onClick={() => router.push('/')} className="rounded-xl bg-gradient-to-r from-violet to-roseSoft text-white font-bold px-8 py-3 shadow-lg shadow-violet/30 hover:shadow-violet/50 transition">Torna alla Landing</button>
          <button onClick={() => setShowLogin(true)} className="mt-3 rounded-xl border border-white/15 bg-surface2 text-textMain font-semibold px-8 py-3 hover:bg-white/[0.06] transition">Accedi / Registrati</button>
        </div>
        {showLogin && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowLogin(false)}>
            <div className="glass-card rounded-3xl p-8 w-full max-w-md mx-4" onClick={e=>e.stopPropagation()}>
              <h2 className="font-display text-2xl font-bold mb-2">{isRegistrazione?'Crea Account':'Accedi'}</h2>
              <input type="email" className="input-jumbai mb-3" placeholder="email@esempio.it" value={email} onChange={e=>setEmail(e.target.value)} />
              <input type="password" className="input-jumbai mb-3" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} />
              <button onClick={async () => { if(isRegistrazione) { const {error} = await supabase.auth.signUp({email,password}); if(error) alert(error.message); else alert('Controlla la tua email.'); } else { const {error} = await supabase.auth.signInWithPassword({email,password}); if(error) alert(error.message); else setShowLogin(false); } }} className="w-full rounded-xl bg-gradient-to-r from-violet to-roseSoft text-white font-bold py-3 shadow-lg shadow-violet/30 transition">{isRegistrazione?'Registrati':'Accedi'}</button>
              <button onClick={() => setIsRegistrazione(!isRegistrazione)} className="w-full text-sm text-coolGray mt-2">{isRegistrazione?'Hai già un account? Accedi':'Non hai un account? Registrati'}</button>
              <button onClick={() => setShowLogin(false)} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center">×</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink text-textMain font-inter flex">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-72 z-50 bg-surface border-r border-white/[0.06] flex flex-col">
        <div className="px-6 py-6 border-b border-white/[0.06] flex items-center gap-2.5">
          <a href="/" className="flex items-center gap-2.5"><span className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet to-roseSoft text-white font-display font-bold flex items-center justify-center shadow-lg shadow-violet/20">J</span><span className="font-display text-xl tracking-tight">JumbAI</span></a>
        </div>
        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
          {[
            {id:'casa' as Sezione, icona:'🏠', label:'Casa'},
            {id:'galleria' as Sezione, icona:'🖼️', label:'Galleria'},
            {id:'integrazioni' as Sezione, icona:'🔗', label:'Integrazioni'},
          ].map(v => (
            <button key={v.id} onClick={() => setSezione(v.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${sezione===v.id ? 'bg-violet/15 text-violetSoft border border-violet/20' : 'text-coolGray hover:text-textMain hover:bg-white/[0.06]'}`}>
              <span className="text-lg">{v.icona}</span><span>{v.label}</span>
            </button>
          ))}
          <div className="pt-4 pb-2"><p className="px-4 text-[10px] font-bold uppercase tracking-wider text-coolGray/40">Filtra per Categoria</p></div>
          {CATEGORIE.map(cat => (
            <button key={cat.id} onClick={() => setCategoriaFiltro(prev => prev === cat.id ? 'Tutte' : cat.id)} className={`w-full flex items-center gap-3 px-4 py-2 text-xs font-medium transition rounded-xl ${categoriaFiltro === cat.id ? 'bg-violet/10 text-violetSoft border border-violet/20' : 'text-coolGray hover:text-textMain hover:bg-white/[0.05]'}`}>
              <span>{cat.icona}</span>
              <span className="flex-1 text-left">{cat.id}</span>
              <span className="text-[10px] bg-violet/20 text-violetSoft px-1.5 rounded-full">{immagini.filter(i => i.categoria?.toLowerCase() === cat.id.toLowerCase()).length}</span>
            </button>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-white/[0.06] flex items-center justify-between">
          <div className="badge-crediti border-violet/30 bg-violet/10 text-violetSoft"><span className="font-bold">{creditiUtente}</span><span>crediti</span></div>
          <button onClick={handleLogout} className="text-xs text-roseSoft hover:text-white transition">Esci</button>
        </div>
      </aside>

      {/* Main */}
      <main className="ml-72 min-h-screen flex-1">
        <header className="sticky top-0 z-40 h-16 glass border-b border-white/[0.05] flex items-center justify-between px-8 lg:px-10">
          <h1 className="font-display text-xl font-bold tracking-tight">{sezione==='casa'&&'Casa'}{sezione==='galleria'&&'Galleria'}{sezione==='integrazioni'&&'Integrazioni'}</h1>
          <div className="flex items-center gap-3">
            <div className="badge-crediti border-violet/30 bg-violet/10 text-violetSoft text-xs"><span>Crediti: <strong className="tabular-nums">{creditiUtente}</strong></span></div>
            <div className="relative">
              <button onClick={() => {}} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] pl-2 pr-3 py-1 text-sm hover:border-violet/40 hover:bg-violet/10 transition"><span className="w-7 h-7 rounded-full bg-gradient-to-br from-violet to-roseSoft text-[10px] font-bold text-white">{(session?.user?.email||'?').charAt(0).toUpperCase()}</span><span className="max-w-[8rem] truncate">{session?.user?.email?.split('@')[0]}</span></button>
            </div>
          </div>
        </header>

        <div className="p-8 lg:p-10">
          {/* CASA */}
          {sezione === 'casa' && (
            <div className="max-w-5xl mx-auto space-y-10">
              <div className="glass-card rounded-3xl p-8 lg:p-10 shadow-2xl">
                <div className="flex items-center gap-3 mb-6">
                  <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet to-violetSoft text-white flex items-center justify-center shadow-lg shadow-violet/30"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg></span>
                  <div><h2 className="font-display text-2xl lg:text-3xl font-bold tracking-tight">Genera Immagine</h2><p className="text-sm text-coolGray">Trasforma le parole in immagini AI.</p></div>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-coolGray mb-2">Prompt</label>
                  <textarea className="input-jumbai resize-y min-h-[100px]" rows={4} value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Una donna in un abito rosso cammina in una strada cyberpunk..." />
                </div>
                <div className="flex flex-wrap gap-2 mb-4">
                  {CATEGORIE.filter(c=>c.id!=='Tutte').map(cat => (
                    <button key={cat.id} onClick={() => { setCategoria(cat.id); if(cat.prompt) setPrompt(cat.prompt); }} className={`rounded-xl px-3 py-2 text-xs font-medium border transition ${categoria===cat.id ? 'bg-violet/20 text-violetSoft border-violet/30' : 'bg-ink border-white/[0.08] text-coolGray hover:text-textMain hover:border-violet/40'}`}>
                      <span>{cat.icona}</span> {cat.id}
                    </button>
                  ))}
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-coolGray mb-2">Formato</label>
                  <div className="flex flex-wrap gap-2">
                    {ASPECT_RATIOS.map(ar => (
                      <button key={ar.id} onClick={() => setAspectRatio(ar.id)} className={`rounded-xl px-3 py-2 text-xs font-medium border transition ${aspectRatio===ar.id ? 'bg-violet/20 text-violetSoft border-violet/30' : 'bg-ink border-white/[0.08] text-coolGray hover:text-textMain hover:border-violet/40'}`}>{ar.label}</button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-6">
                  <button onClick={eseguiFree} disabled={inviando} className="rounded-xl bg-surface2 border border-white/[0.10] text-textMain font-semibold py-3.5 hover:bg-surface3 transition disabled:opacity-50">Genera Gratis <span className="text-xs text-coolGray">1 cr</span></button>
                  <button onClick={eseguiPremium} disabled={inviando} className="rounded-xl bg-gradient-to-r from-violet to-roseSoft text-white font-bold py-3.5 shadow-lg shadow-violet/30 hover:shadow-violet/50 transition disabled:opacity-50">Genera Premium <span className="text-xs bg-white/20 px-1 rounded-md">2 cr</span></button>
                </div>
                <p className="mt-2 text-xs text-coolGray text-center">Gratis = Wan (DashScope). Premium = Fal.ai SDXL.</p>
                {messaggio && <div className="mt-4 rounded-xl bg-violet/10 border border-violet/20 text-violetSoft px-5 py-4 text-sm font-medium flex items-center gap-3"><span className="w-2 h-2 rounded-full bg-violet animate-pulse"></span><span>{messaggio}</span></div>}
              </div>

              {/* Pricing */}
              <section>
                <h2 className="font-display text-3xl font-bold tracking-tight mb-8">Scegli il piano</h2>
                <div className="grid md:grid-cols-3 gap-6">
                  {[ {t:'Free',p:'€0',d:'3 crediti gratuiti',f:['3 immagini Wan','Tutti i formati'],btn:'Inizia Gratis'}, {t:'Starter',p:'€6',d:'10 immagini premium',f:['10 immagini SDXL','Tutti i formati','Editor AI'],btn:'Acquista Starter'}, {t:'Pro',p:'€15',d:'100 immagini premium',f:['100 immagini SDXL','Codice prioritaria','Collage + Cache'],btn:'Acquista Pro'} ].map(plan => (
                    <div key={plan.t} className="glass-card rounded-3xl p-8 hover:-translate-y-1 transition">
                      <h3 className="font-display text-xl font-bold">{plan.t}</h3>
                      <p className="text-3xl font-display font-bold">{plan.p}<span className="text-base font-normal text-coolGray"> una tantum</span></p>
                      <p className="text-sm text-coolGray mb-4">{plan.d}</p>
                      <ul className="text-sm text-coolGray space-y-1 mb-6">{plan.f.map((f,i)=><li key={i}>• {f}</li>)}</ul>
                      <button onClick={() => router.push('/landing#pricing')} className="w-full rounded-xl bg-gradient-to-r from-violet to-roseSoft text-white font-semibold py-3 shadow-lg shadow-violet/30 hover:shadow-violet/50 transition">{plan.btn}</button>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* GALLERIA */}
          {sezione === 'galleria' && (
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <h2 className="font-display text-3xl font-bold">Galleria</h2>
                  {categoriaFiltro !== 'Tutte' && (
                    <span className="text-xs font-medium bg-violet/20 text-violetSoft border border-violet/30 px-3 py-1 rounded-full flex items-center gap-1">{CATEGORIE.find(c=>c.id===categoriaFiltro)?.icona} {categoriaFiltro} <button onClick={()=>setCategoriaFiltro('Tutte')} className="hover:text-white">×</button></span>
                  )}
                </div>
                <button onClick={caricaImmagini} className="text-sm font-medium text-violetSoft hover:text-white transition">Aggiorna</button>
              </div>
              <div className="flex flex-wrap gap-2 mb-6">
                {['tutti','generazione','completata','fallita'].map(f => (
                  <button key={f} onClick={() => setFiltroGalleria(f as any)} className={`rounded-lg px-3 py-1.5 text-xs font-medium border ${filtroGalleria===f ? 'bg-violet/20 text-violetSoft border-violet/30' : 'bg-ink border-white/[0.08] text-coolGray'}`}>{f}<span className="ml-1">({immagini.filter(i=>f==='tutti'||i.stato===f).length})</span></button>
                ))}
              </div>
              {immaginiCategoriaFiltrata.length === 0 ? (
                <div className="glass-card rounded-3xl p-12 text-center"><p className="text-coolGray">Nessuna immagine.</p></div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {immaginiCategoriaFiltrata.map(img => (
                    <article key={img.id} className="video-card rounded-2xl overflow-hidden cursor-pointer bg-surface border border-white/[0.08]" onClick={()=>setLightboxImg(img)}>
                      <div className="relative aspect-square bg-ink2 flex items-center justify-center overflow-hidden">
                        {img.stato==='generazione' ? <div className="text-center px-4"><div className="shimmer w-full h-full absolute inset-0"></div><span className="inline-block w-8 h-8 rounded-full border-2 border-amber border-t-transparent animate-spin relative z-10"></span><p className="text-xs text-coolGray mt-2">{img.prompt?.substring(0,40)}...</p></div> : img.stato==='completata' && img.url_immagine ? <img src={img.url_immagine} alt={img.prompt} className="w-full h-full object-cover" /> : <div className="text-center px-4"><p className="text-xs text-red-400 mt-1">{img.errore||'Fallita'}</p></div>}
                      </div>
                      <div className="p-4">
                        <p className="text-xs text-coolGray mb-2 line-clamp-2">{img.prompt}</p>
                        <div className="flex items-center justify-between text-[10px] text-white/40"><span>{img.categoria} · {img.size}</span><span>{new Date(img.creato_il).toLocaleDateString('it-IT')}</span></div>
                        {img.stato==='completata' && img.url_immagine && <a href={img.url_immagine || undefined} download={`jumbai-${img.id}.png`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-lg bg-violet/20 border border-violet/30 text-violetSoft text-[11px] font-bold py-2 px-3 hover:bg-violet/30 transition mt-2" onClick={e=>e.stopPropagation()}>Scarica</a>}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* INTEGRAZIONI */}
          {sezione === 'integrazioni' && (
            <div className="max-w-3xl mx-auto">
              <h2 className="font-display text-3xl font-bold mb-2">Integrazioni</h2>
              <p className="text-sm text-coolGray mb-6">Connetti servizi preferiti per automatizzare il workflow.</p>
              <div className="space-y-3">
                {[
                  {name:'Discord', desc:'Notifiche automatiche quando l\'immagine è pronta.', connected:false},
                  {name:'X (Twitter)', desc:'Pubblica le immagini direttamente su X.', connected:false},
                  {name:'Telegram', desc:'Ricevi le immagini su Telegram.', connected:false},
                  {name:'Slack', desc:'Condividi le immagini nel tuo team.', connected:false},
                ].map(int => (
                  <div key={int.name} className="glass-card rounded-2xl p-6 flex items-center justify-between">
                    <div><h3 className="font-display font-semibold">{int.name}</h3><p className="text-xs text-coolGray">{int.desc}</p></div>
                    <button disabled className="rounded-lg px-4 py-2 text-xs font-semibold bg-surface2 text-coolGray border border-white/[0.10] opacity-70 cursor-not-allowed">Presto</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Lightbox */}
        {lightboxImg && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={()=>setLightboxImg(null)}>
            <div className="relative max-w-3xl w-full max-h-[90vh] overflow-auto glass-card rounded-3xl p-6" onClick={e=>e.stopPropagation()}>
              <button onClick={()=>setLightboxImg(null)} className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition">×</button>
              {lightboxImg.url_immagine && <img src={lightboxImg.url_immagine} alt={lightboxImg.prompt || ''} className="w-full rounded-2xl max-h-[60vh] object-contain" />}
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium">{lightboxImg.prompt}</p>
                <div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full px-2 py-0.5 bg-violet/20 text-violetSoft">{lightboxImg.categoria}</span><span className="rounded-full px-2 py-0.5 bg-ink border border-white/[0.08]">Seed: {lightboxImg.seed||'casuale'}</span><span className="rounded-full px-2 py-0.5 bg-ink border border-white/[0.08]">{lightboxImg.modello}</span></div>
                <a href={lightboxImg.url_immagine || undefined} download={`jumbai-${lightboxImg.id}.png`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet to-roseSoft text-white text-sm font-bold px-5 py-2.5 shadow-lg shadow-violet/20 hover:shadow-violet/40 transition mt-2">Scarica Immagine</a>
              </div>
            </div>
          </div>
        )}

        {/* Toast */}
        <div className="fixed top-0 right-0 z-[200] p-4 space-y-2 pointer-events-none">
          {toasts.map((t, idx) => (
            <div key={t.id} className="pointer-events-auto"><Toast message={t.message} type={t.type} duration={4000} onClose={() => removeToast(t.id)} offset={idx * 60} /></div>
          ))}
        </div>
      </main>
    </div>
  );
}
