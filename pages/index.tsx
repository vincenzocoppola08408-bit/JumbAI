/* encoding-safe-unicode-v2 */
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
type FiltroGalleria = 'tutti' | 'rendering' | 'completati' | 'falliti';
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

  async function caricaProfilo(userId: string) {
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
          const nuovo = payload.new as any;
          if (!nuovo) return;
          setVideos((prev) => {
            const idx = prev.findIndex((v) => v.id === nuovo.id);
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = { ...copy[idx], ...nuovo };
              return copy;
            }
            return [nuovo as Video, ...prev];
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
    if (data) setVideos(data as Video[]);
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
    alert('\u2705 Chiave BYOK salvata localmente. Il server non la vede mai.');
  }

  // ============ FILE IMMAGINE ============
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileImmagine(file);
    setImmaginePreview(URL.createObjectURL(file));
  }

  // ============ GENERAZIONE ============
  async function eseguiFree() {
    if (!byokKey.trim()) return alert('Inserisci la tua API Key BYOK nella sezione Sviluppatori.');
    if (!prompt.trim()) return alert('Scrivi un prompt.');
    trackGenera('free');
    setInviando(true);
    setMessaggio('Invio richiesta BYOK...');
    try {
      const resp = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=' + byokKey.trim(),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `Genera descrizione video basandoti su questo prompt: "${prompt}". Parametri: durata ${durata}s, risoluzione ${risoluzione}. ${generaAudio ? 'Includi audio.' : ''} ${ottimizzaPrompt ? 'Ottimizza e arricchisci la scena descritta.' : ''}` }] }],
          }),
        }
      );
      const data = await resp.json();
      console.log('BYOK response:', data);
      alert('\u2705 Richiesta BYOK completata! Verifica la console per la risposta.');
    } catch (e: any) {
      alert('\u274C Errore BYOK: ' + e.message);
    } finally {
      setInviando(false);
      setMessaggio('');
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
        setMessaggio('\u2705 ' + (data.message || 'Richiesta presa in carico!'));
        setPrompt('');
        setPromptNegativo('');
        setSeed('');
        setFileImmagine(null);
        setImmaginePreview(null);
        setGeneraAudio(false);
        // Aggiorna badge crediti dopo consumo Premium
        if (session?.user?.id) await caricaProfilo(session.user.id);
      } else {
        alert('\u274C ' + (data.error || 'Errore'));
      }
    } catch (e: any) {
      alert('\u274C Errore: ' + e.message);
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

  // ============ HELPER VIDEO FILTRATI ============
  const videoFiltrati = videos.filter((v) => {
    if (filtroGalleria === 'tutti') return true;
    return v.stato === filtroGalleria;
  });

  // Calcola costo crediti in base a durata
  const costoCrediti = durata <= 6 ? 1 : 2;

  // Prefer profili.crediti (schema attuale); fallback credits se assente a runtime
  const creditiUtente = profilo?.crediti ?? profilo?.credits ?? 0;

  // ============ RENDER SIDEBAR ============
  function renderSidebar() {
    const voci: { id: Sezione; icona: string; label: string }[] = [
      { id: 'casa', icona: '\uD83C\uDFE0', label: 'Casa' },
      { id: 'progetti', icona: '\uD83C\uDFAC', label: 'Progetti' },
      { id: 'integrazioni', icona: '\uD83D\uDD17', label: 'Integrazioni' },
      { id: 'sviluppatori', icona: '\u2699\uFE0F', label: 'Sviluppatori' },
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
              <span className="text-sm">{'\u2B50'}</span>
              <span>Premium · {creditiUtente} crediti</span>
            </div>
          ) : (
            <div className="badge-crediti border-amber/30 bg-amber/10 text-amber">
              <span>{'\uD83D\uDD11'}</span>
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
              { id: 'testo' as TabInput, label: '\uD83D\uDCDD Testo in Video' },
              { id: 'immagine' as TabInput, label: '\uD83D\uDDBC\uFE0F Immagine in Video' },
              { id: 'frame' as TabInput, label: '\uD83C\uDF9E\uFE0F Primo/Ultimo Frame' },
              { id: 'multiple' as TabInput, label: '\uD83D\uDCF8 Immagini Multiple' },
            ]).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setTabInput(tab.id)}
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
                    <span className="text-4xl">{'\uD83D\uDCE4'}</span>
                    <p className="text-sm text-coolGray">Trascina o clicca per caricare un&apos;immagine</p>
                    <p className="text-xs text-white/30">{'PNG, JPG, WEBP \u2014 Max 10MB'}</p>
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
                { label: 'Citt\u00E0', text: 'Un gatto che vola sopra una citt\u00E0 al tramonto, nuvole dorate, camera panoramica lenta, atmosfera cinematografica' },
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
                  <option value="hunyuan-video-pro">{'Hunyuan Video Pro \u26A1'}</option>
                  <option value="minimax-video">MiniMax Video</option>
                  <option value="cogvideo">CogVideoX</option>
                </>
              ) : (
                <>
                  <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash (BYOK)</option>
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro (BYOK)</option>
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
              <span className={`transition ${showAvanzate ? 'rotate-90' : ''}`}>{'\u25B6'}</span>
              Impostazioni Avanzate
            </button>

            {showAvanzate && (
              <div className="mt-4 p-5 rounded-2xl bg-ink border border-white/[0.08] grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Durata */}
                <div>
                  <label className="block text-sm font-medium text-coolGray mb-2">Durata</label>
                  <select value={durata} onChange={(e) => setDurata(Number(e.target.value))} className="select-jumbai">
                    <option value={4}>4 secondi ({session ? '1 \uD83E\uDE99' : 'gratuito'})</option>
                    <option value={6}>6 secondi ({session ? '1 \uD83E\uDE99' : 'gratuito'})</option>
                    <option value={8}>8 secondi ({session ? '2 \uD83E\uDE99' : 'Premium only'})</option>
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
                      <option value="16:9">{'16:9 \u2014 Orizzontale'}</option>
                      <option value="9:16">{'9:16 \u2014 Verticale (Reels/Stories)'}</option>
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
              {inviando ? '\u23F3' : '\uD83C\uDD93'} Genera Gratis <span className="text-xs text-coolGray">BYOK</span>
            </button>
            <button
              onClick={eseguiPremium}
              disabled={inviando}
              className="rounded-xl bg-gradient-to-r from-violet to-roseSoft text-white font-bold py-3.5 shadow-lg shadow-violet/30 hover:shadow-violet/50 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {inviando ? '\u23F3' : '\u26A1'} Genera Premium <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded-md">{costoCrediti} 🪙</span>
            </button>
          </div>

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
            <p className="mt-2 text-sm text-coolGray">{'Psicologia settimanale: prezzi che sembrano un caff\u00E8. Annulla quando vuoi.'}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Starter */}
            <div className="glass-card rounded-3xl p-8 hover:-translate-y-1 transition relative">
              <span className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-widest bg-surface3 text-coolGray px-2.5 py-1 rounded-full">Starter</span>
              <h3 className="font-display text-2xl font-bold mb-1">{'\u20AC1,50'}<span className="text-sm text-coolGray font-normal">/settimana</span></h3>
              <p className="text-sm text-coolGray mb-4">Equivalente a <strong className="text-textMain">{'\u20AC6 una tantum'}</strong> per 10 video</p>
              <ul className="text-sm text-coolGray space-y-2 mb-6">
                <li>{'\u2705 10 video generati'}</li>
                <li>{'\u2705 Risoluzione fino a 1080p'}</li>
                <li>{'\u2705 Supporto prioritario'}</li>
              </ul>
              <button
                onClick={() => { if (!session) { setShowLogin(true); return; } trackCheckout('starter'); alert('Checkout Stripe in arrivo!'); }}
                className="w-full rounded-xl bg-gradient-to-r from-violet to-roseSoft text-white font-semibold py-3 shadow-lg shadow-violet/30 hover:shadow-violet/50 transition"
              >
                Acquista Starter
              </button>
            </div>

            {/* Pro */}
            <div className="glass-card rounded-3xl p-8 relative overflow-hidden ring-1 ring-amber/40 shadow-xl shadow-amber/10 hover:-translate-y-1 transition">
              <span className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-widest bg-amber/20 text-amber px-2.5 py-1 rounded-full">Pro</span>
              <h3 className="font-display text-2xl font-bold mb-1">{'\u20AC3,75'}<span className="text-sm text-coolGray font-normal">/settimana</span></h3>
              <p className="text-sm text-coolGray mb-4">Equivalente a <strong className="text-textMain">{'\u20AC15 una tantum'}</strong> per 100 video</p>
              <ul className="text-sm text-coolGray space-y-2 mb-6">
                <li>{'\u2705 100 video generati'}</li>
                <li>{'\u2705 Risoluzione fino a 4K'}</li>
                <li>{'\u2705 Audio generato incluso'}</li>
                <li>{'\u2705 Modelli premium'}</li>
              </ul>
              <button
                onClick={() => { if (!session) { setShowLogin(true); return; } trackCheckout('pro'); alert('Checkout Stripe in arrivo!'); }}
                className="w-full rounded-xl bg-gradient-to-r from-amber to-roseSoft text-white font-semibold py-3 shadow-lg shadow-amber/30 hover:shadow-amber/50 transition"
              >
                Acquista Pro
              </button>
            </div>
          </div>

          {/* Fiducia */}
          <div className="flex flex-wrap items-center justify-center gap-6 mt-6 text-xs text-coolGray">
            <span>{'\uD83D\uDD12 Pagamento sicuro Stripe'}</span>
            <span>{'\uD83D\uDCB3 Visa \u00B7 Mastercard \u00B7 PayPal'}</span>
            <span className="flex items-center gap-1">{'
              \u2B50\u2B50\u2B50\u2B50\u2B50 '}<strong className="text-textMain">4.8/5</strong> su Trustpilot
            </span>
          </div>
        </section>
      </div>
    );
  }

  // ============ RENDER PROGETTI (Galleria) ============
  function renderProgetti() {
    const filtri: { id: FiltroGalleria; label: string; icona: string }[] = [
      { id: 'tutti', label: 'Tutti', icona: '\uD83D\uDCC1' },
      { id: 'rendering', label: 'In Rendering', icona: '\u23F3' },
      { id: 'completati', label: 'Completati', icona: '\u2705' },
      { id: 'falliti', label: 'Falliti', icona: '\u274C' },
    ];

    return (
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-3xl lg:text-4xl font-bold tracking-tight">I tuoi Progetti</h2>
          <button onClick={caricaVideo} className="text-sm font-medium text-violetSoft hover:text-white transition">{'
            \uD83D\uDD04 Aggiorna
          '}</button>
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
            <span className="text-5xl">{'\uD83D\uDD12'}</span>
            <p className="mt-4 text-coolGray">Accedi per vedere i tuoi progetti.</p>
            <button onClick={() => setShowLogin(true)} className="mt-4 rounded-xl bg-violet text-white font-semibold px-6 py-2.5 hover:bg-violet/90 transition">
              Accedi
            </button>
          </div>
        ) : videoFiltrati.length === 0 ? (
          <div className="glass-card rounded-3xl p-12 text-center">
            <span className="text-5xl">{'\uD83C\uDFAC'}</span>
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
                    <span className="status-badge bg-amber/20 text-amber border border-amber/30">{'
                      \u23F3 In Rendering
                    '}</span>
                  )}
                  {video.stato === 'completato' && (
                    <span className="status-badge bg-emerald/20 text-emerald border border-emerald/30">{'
                      \u2705 Completato
                    '}</span>
                  )}
                  {video.stato === 'fallito' && (
                    <span className="status-badge bg-red/20 text-red-400 border border-red/30">{'
                      \u274C Fallito
                    '}</span>
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
                      <video
                        src={video.url_video}
                        className="w-full h-full object-cover"
                        controls
                        preload="metadata"
                      />
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
                      <span className="text-3xl">{'\u274C'}</span>
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
      { name: 'Discord', icon: '\uD83D\uDCAC', desc: 'Notifiche automatiche quando un video \u00E8 pronto.', connected: false },
      { name: 'X (Twitter)', icon: '\uD83D\uDC26', desc: 'Pubblica i tuoi video direttamente su X.', connected: false },
      { name: 'YouTube', icon: '\u25B6\uFE0F', desc: 'Carica automaticamente su YouTube.', connected: false },
      { name: 'Telegram', icon: '\u2708\uFE0F', desc: 'Ricevi i video su Telegram.', connected: false },
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
                className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
                  int.connected
                    ? 'bg-emerald/20 text-emerald border border-emerald/30'
                    : 'bg-surface2 text-coolGray border border-white/[0.10] hover:text-textMain'
                }`}
              >
                {int.connected ? 'Connesso' : 'Connetti'}
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
          <h2 className="font-display text-3xl lg:text-4xl font-bold tracking-tight">{'\uD83D\uDD11 Sviluppatori \u2014 BYOK'}</h2>
          <p className="text-sm text-coolGray mt-1">
            Porta la tua chiave (Bring Your Own Key). La chiave resta <strong>solo</strong> nel tuo browser.
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
            <p className="text-xs text-coolGray mt-2">Memorizzata in localStorage. Il server non vede mai questa chiave.</p>
          </div>

          <div className="rounded-2xl bg-ink border border-white/[0.08] p-5">
            <h3 className="font-display text-base font-semibold mb-2">{'\uD83D\uDCD8 Come ottenere una chiave'}</h3>
            <ol className="text-sm text-coolGray space-y-2 list-decimal list-inside">
              <li>Vai su <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-violetSoft hover:underline">Google AI Studio</a> e genera una API Key gratuita</li>
              <li>Oppure usa <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noreferrer" className="text-violetSoft hover:underline">HuggingFace Tokens</a></li>
              <li>Incolla la chiave qui sopra e clicca Salva</li>
              <li>Usa il pulsante <strong>&quot;Genera Gratis BYOK&quot;</strong> nella Console</li>
            </ol>
          </div>

          <div className="rounded-2xl bg-ink border border-white/[0.08] p-5">
            <h3 className="font-display text-base font-semibold mb-2">{'\uD83D\uDD12 Privacy & Sicurezza'}</h3>
            <ul className="text-sm text-coolGray space-y-2 list-disc list-inside">
              <li>{'La chiave \u00E8 archiviata SOLO nel localStorage del tuo browser'}</li>
              <li>Le chiamate partono direttamente dal tuo browser all&apos;API Google</li>
              <li>{'Nessun proxy intermedio \u2014 zero logging lato server'}</li>
              <li>Costo server per il gestore: <strong>{'\u20AC0'}</strong></li>
            </ul>
          </div>
        </div>

        {session && (
          <div className="mt-6 glass-card rounded-3xl p-8">
            <h3 className="font-display text-xl font-bold mb-4">{'\uD83D\uDCCA La tua Dashboard'}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-2xl bg-ink border border-white/[0.08] p-4 text-center">
                <p className="text-2xl font-bold tabular-nums">{creditiUtente}</p>
                <p className="text-xs text-coolGray">Crediti</p>
              </div>
              <div className="rounded-2xl bg-ink border border-white/[0.08] p-4 text-center">
                <p className="text-2xl font-bold">{videos.length}</p>
                <p className="text-xs text-coolGray">{'\uD83C\uDFAC Video Totali'}</p>
              </div>
              <div className="rounded-2xl bg-ink border border-white/[0.08] p-4 text-center">
                <p className="text-2xl font-bold text-emerald">{videos.filter(v => v.stato === 'completato').length}</p>
                <p className="text-xs text-coolGray">{'\u2705 Completati'}</p>
              </div>
              <div className="rounded-2xl bg-ink border border-white/[0.08] p-4 text-center">
                <p className="text-2xl font-bold text-amber">{videos.filter(v => v.stato === 'rendering').length}</p>
                <p className="text-xs text-coolGray">{'\u23F3 In Coda'}</p>
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
              <span>{'\uD83D\uDD35'}</span> Continua con Google
            </button>

            <div className="flex items-center gap-3 text-xs text-coolGray my-2">
              <span className="flex-1 h-px bg-white/10"></span> oppure <span className="flex-1 h-px bg-white/10"></span>
            </div>

            <button onClick={handleAuth} className="w-full rounded-xl bg-gradient-to-r from-violet to-roseSoft text-white font-bold py-3 shadow-lg shadow-violet/30 hover:shadow-violet/50 transition">
              {isRegistrazione ? 'Registrati' : 'Accedi'}
            </button>

            <p className="text-center text-sm text-coolGray">
              {isRegistrazione ? 'Hai gi\u00E0 un account?' : 'Non hai un account?'}{' '}
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
          <button onClick={() => { void signInWithGoogle().catch((e) => { console.error(e); setShowLogin(true); alert((e as Error)?.message || 'Login Google non disponibile'); }); }} className="rounded-xl bg-gradient-to-r from-violet to-roseSoft text-white font-bold px-8 py-3 shadow-lg shadow-violet/30 hover:shadow-violet/50 transition">Accedi con Google</button>
        </div>
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
              {sezione === 'casa' && '\uD83C\uDFE0 Casa'}
              {sezione === 'progetti' && '\uD83C\uDFAC Progetti'}
              {sezione === 'integrazioni' && '\uD83D\uDD17 Integrazioni'}
              {sezione === 'sviluppatori' && '\u2699\uFE0F Sviluppatori'}
            </h1>
          </div>

          {/* Badge destra */}
          <div className="flex items-center gap-3">
            {session ? (
              <div className="badge-crediti border-violet/30 bg-violet/10 text-violetSoft text-xs">
                <span>{'\u2B50'}</span>
                <span>Crediti: <strong className="tabular-nums">{creditiUtente}</strong></span>
              </div>
            ) : (
              <div className="badge-crediti border-amber/30 bg-amber/10 text-amber text-xs">
                <span>{'\uD83D\uDD11'}</span>
                <span>Piano: Free (BYOK)</span>
              </div>
            )}
              <button onClick={() => { setShowLogin(false); router.push('/landing'); }} className="text-sm text-violetSoft hover:text-white transition">
              {session ? session.user?.email?.split('@')[0] : 'Accedi'}
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-8 lg:p-10">
          {renderContent()}
        </main>

        {/* Footer */}
        <footer className="border-t border-white/[0.08] py-8 text-center text-coolGray text-xs">
          <p>{'JumbAI 2.0 \u2014 AI Video Generator SaaS. Architettura BYOK + Premium. Zero costi GPU.'}</p>
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
                  Vai in <strong className="text-textMain">Casa</strong> e usa la Console Generativa: scrivi un prompt (o scegli un template) e premi Genera Gratis (BYOK) oppure Genera Premium.
                </p>
              </div>
            )}
            {onboardingStep === 1 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-violetSoft">Passo 2 di 3</p>
                <h3 className="font-display text-2xl font-bold">Crediti e piani</h3>
                <p className="text-sm text-coolGray leading-relaxed">
                  Il badge in alto mostra i tuoi <strong className="text-textMain">crediti</strong>{' Premium. I pacchetti Starter (~\u20AC6 / 10 video) e Pro (~\u20AC15 / 100 video) ricaricano il saldo; Free resta BYOK a \u20AC0 lato server.
                '}</p>
              </div>
            )}
            {onboardingStep === 2 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-violetSoft">Passo 3 di 3</p>
                <h3 className="font-display text-2xl font-bold">Trovare i progetti</h3>
                <p className="text-sm text-coolGray leading-relaxed">
                  Nella sidebar apri <strong className="text-textMain">Progetti</strong>{' per vedere i video in rendering o completati. Da l\u00EC puoi riprodurre e scaricare gli MP4 pronti.
                '}</p>
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