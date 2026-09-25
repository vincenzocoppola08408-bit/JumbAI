import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase-client';

// ================================================================
// JumbAI Landing Page — Brand & Onboarding
// Copy esatta dalla Master Roadmap v1.0
// Fase 1: Posizionamento del Brand & Landing Page
// ================================================================

const FAQ_ITEMS = [
  {
    q: 'Qual è la differenza tra Crediti JumbAI e Buzz Civitai?',
    a: 'I Crediti JumbAI servono per l\'utilizzo dell\'interfaccia e dei moduli avanzati (Editor, Collage, Cache locale). Le immagini consumano i tuoi veri Buzz su Civitai tramite una connessione OAuth protetta, senza alcun ricarico nascosto.',
  },
  {
    q: 'Devo inserire la carta di credito per iniziare?',
    a: 'No. All\'iscrizione ricevi immediatamente 3 Crediti JumbAI di prova gratuiti. Puoi iniziare a creare senza inserire alcun metodo di pagamento.',
  },
  {
    q: 'Come funziona la generazione immagini?',
    a: 'Collega il tuo account Civitai via OAuth. Scrivi un prompt descrittivo, scegli il formato e premi Genera. Le immagini vengono elaborate sui server Civitai usando i tuoi Buzz personali. L\'HUD JumbAI ti mostra tutto in tempo reale.',
  },
  {
    q: 'Di chi è la proprietà delle immagini generate?',
    a: 'Le immagini appartengono a te. JumbAI non rivendica alcun diritto. Per i dettagli consulta i Termini di servizio del provider di generazione (Civitai).',
  },
  {
    q: 'Posso modificare le immagini dopo averle generate?',
    a: 'Sì. JumbAI include un Editor AI integrato per Inpainting/Img2Img, un Rimuovi Sfondo con canale alfa e una modalità Collage per composizioni grafiche. Il tutto senza uscire dall\'applicazione.',
  },
  {
    q: 'Le immagini vengono salvate in cloud? Quanto costa la banda?',
    a: 'Le immagini sono memorizzate nella cache locale del tuo browser (Cache API + IndexedDB). Al refresh, la galleria si carica in meno di 10ms a costo zero di banda. Una sincronizzazione silenziosa in background recupera solo i file generati da altri dispositivi.',
  },
  {
    q: 'Quali strumenti extra sono inclusi?',
    a: 'Oltre al Text-to-Image, JumbAI offre: Editor AI (Inpainting/Img2Img asincrono), Rimozione Sfondo automatizzata con canale alfa PNG, e Canvas Collage drag-and-drop per composizioni multi-immagine.',
  },
];

const CATEGORIE_SHOWCASE = [
  { nome: 'Ritratto', icona: '\ud83d\udc64', desc: 'Ritratti fotorealistici con luce studiata', grad: 'from-violet to-purple-700' },
  { nome: 'Fantasy', icona: '\ud83e\uddd9', desc: 'Mondi magici e creature fantastiche', grad: 'from-fuchsia-500 to-purple-700' },
  { nome: 'Anime', icona: '\ud83c\udfae', desc: 'Stile giapponese, colori vividi', grad: 'from-sky-400 to-indigo-600' },
  { nome: 'Paesaggio', icona: '\ud83c\udfde\ufe0f', desc: 'Natura, montagne, tramonti mozzafiato', grad: 'from-emerald-500 to-teal-700' },
  { nome: 'Architettura', icona: '\ud83c\udfdb\ufe0f', desc: 'Edifici, interni, design moderno', grad: 'from-zinc-400 to-zinc-700' },
  { nome: 'Cibo', icona: '\ud83c\udf7d\ufe0f', desc: 'Cucina gourmet, fotografia culinaria', grad: 'from-amber-500 to-orange-700' },
  { nome: 'Moda', icona: '\ud83d\udc57', desc: 'Street style, editorial, haute couture', grad: 'from-red-500 to-rose-700' },
  { nome: 'Astratto', icona: '\ud83c\udfa8', desc: 'Arte generativa, forme e gradienti', grad: 'from-cyan-500 to-blue-600' },
];

export default function LandingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);

  // Traccia scroll per navbar glass effetto
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  async function handleLogin() {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: typeof window !== 'undefined' ? window.location.origin + '/app' : 'https://jumbai.vercel.app/app',
          queryParams: { access_type: 'offline', prompt: 'consent', scope: 'openid email profile' },
        },
      });
      if (error) throw error;
    } catch (err: any) {
      console.error(err);
      alert('Login Google: ' + (err?.message || 'Errore di connessione. Verifica configurazione OAuth in Supabase.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-ink text-textMain font-inter">
      {/* ============ NAVBAR ============ */}
      <nav className={`fixed top-0 left-0 right-0 z-50 h-16 flex items-center justify-between px-6 lg:px-10 transition-all duration-300 ${
        scrolled ? 'glass border-b border-white/[0.05]' : 'bg-transparent'
      }`}>
        <a href="/" className="flex items-center gap-2.5 group">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-violet to-roseSoft text-white font-display font-bold text-sm shadow-lg shadow-violet/20">J</span>
          <span className="font-display text-xl tracking-tight leading-none">JumbAI</span>
        </a>
        <div className="flex items-center gap-4 text-sm font-medium text-coolGray">
          <a href="#features" className="hover:text-textMain transition hidden sm:inline">Funzionalita</a>
          <a href="#pricing" className="hover:text-textMain transition">Piani</a>
          <a href="#faq" className="hover:text-textMain transition hidden sm:inline">FAQ</a>
          <button
            onClick={handleLogin}
            disabled={loading}
            className="rounded-xl px-5 py-2 bg-violet text-white text-sm font-semibold hover:bg-violet/90 transition shadow-lg shadow-violet/20 disabled:opacity-50"
          >
            {loading ? 'Caricamento...' : 'Inizia Gratis'}
          </button>
        </div>
      </nav>

      {/* ============ HERO SECTION ============ */}
      <section className="relative pt-36 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        {/* Sfondo gradiente decorativo */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-violet/5 blur-[120px]"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-roseSoft/5 blur-[120px]"></div>
        </div>

        <div className="relative max-w-6xl mx-auto px-6 lg:px-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs font-medium text-violetSoft mb-6 border border-white/[0.08]">
            <span className="w-1.5 h-1.5 rounded-full bg-violet animate-pulse"></span>
            Il primo HUD professionale per creatori di immagini AI
          </div>

          <h1 className="font-display text-5xl sm:text-6xl lg:text-8xl font-bold tracking-tighter leading-[0.95] text-textMain max-w-5xl">
            Trasforma il tuo testo in<br />
            <span className="bg-gradient-to-r from-amber to-roseSoft bg-clip-text text-transparent">immagini straordinarie</span><br />
            in pochi secondi.
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-coolGray max-w-2xl leading-relaxed">
            Il primo HUD professionale per creatori di immagini AI. Collega il tuo account Civitai via OAuth, mantieni il controllo dei tuoi Buzz e sblocca strumenti avanzati di editing e rimozione sfondo in un unico spazio di lavoro centralizzato.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <button
              onClick={handleLogin}
              disabled={loading}
              className="inline-flex items-center gap-2.5 rounded-xl px-7 py-3.5 bg-textMain text-ink font-semibold text-base shadow-2xl shadow-white/10 hover:shadow-white/20 hover:-translate-y-0.5 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="inline-block w-4 h-4 rounded-full border-2 border-ink border-t-transparent animate-spin"></span>
                  Autenticazione...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  Inizia Gratis con Google
                </>
              )}
            </button>
            <a href="#pricing" className="inline-flex items-center gap-2 rounded-xl px-7 py-3.5 glass text-textMain font-medium text-base hover:bg-white/[0.08] transition">
              Scopri i piani
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3"/></svg>
            </a>
          </div>

          <p className="mt-4 text-sm text-coolGray/60 flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Nessuna carta richiesta. 3 crediti gratuiti all'iscrizione.
          </p>
        </div>
      </section>

      {/* ============ COME FUNZIONA ============ */}
      <section id="features" className="max-w-6xl mx-auto px-6 lg:px-10 pb-24">
        <div className="text-center mb-14">
          <h2 className="font-display text-4xl lg:text-6xl font-bold tracking-tighter">Come <span className="bg-gradient-to-r from-amber to-roseSoft bg-clip-text text-transparent">funziona</span></h2>
          <p className="mt-4 text-coolGray max-w-xl mx-auto">Tre passaggi per creare la tua prima immagine AI.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              step: '01',
              titolo: 'Connetti Civitai',
              desc: 'Collega il tuo account Civitai via OAuth. I tuoi Buzz restano tuoi. JumbAI non applica ricarichi nascosti sulle generazioni.',
              icona: (
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
              ),
            },
            {
              step: '02',
              titolo: 'Scrivi & Genera',
              desc: 'Descrivi la tua immagine in un prompt. Scegli formato e modello. Premi Genera e guarda la magia in tempo reale.',
              icona: (
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              ),
            },
            {
              step: '03',
              titolo: 'Modifica & Scarica',
              desc: 'Usa l\'Editor AI integrato per ritocchi, rimuovi lo sfondo con un clic o crea collage. Scarica in alta risoluzione.',
              icona: (
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              ),
            },
          ].map((f) => (
            <div key={f.step} className="glass-card rounded-3xl p-8 lg:p-10 hover:-translate-y-0.5 transition group">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet/20 to-roseSoft/20 border border-violet/20 flex items-center justify-center text-violetSoft mb-6 group-hover:scale-105 transition">
                {f.icona}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-violetSoft/60">{f.step}</span>
              <h3 className="font-display text-xl font-bold mt-2 mb-3">{f.titolo}</h3>
              <p className="text-sm text-coolGray leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ CATEGORIE SHOWCASE ============ */}
      <section className="max-w-6xl mx-auto px-6 lg:px-10 pb-24" aria-label="Categorie di immagini">
        <div className="text-center mb-14">
          <h2 className="font-display text-4xl lg:text-6xl font-bold tracking-tighter">Categorie di <span className="bg-gradient-to-r from-amber to-roseSoft bg-clip-text text-transparent">immagini</span></h2>
          <p className="mt-4 text-coolGray max-w-xl mx-auto">Dai ritratti fotorealistici all'arte astratta. Scegli la tua ispirazione.</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {CATEGORIE_SHOWCASE.map((cat) => (
            <div
              key={cat.nome}
              className={`glass-card rounded-2xl p-5 bg-gradient-to-br ${cat.grad} bg-opacity-10 hover:-translate-y-0.5 transition-all cursor-default group`}
            >
              <span className="text-3xl">{cat.icona}</span>
              <h3 className="font-display font-bold text-sm mt-2">{cat.nome}</h3>
              <p className="text-xs text-coolGray mt-1">{cat.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ MODELLO DI CREDITI (Spiegazione trasparente) ============ */}
      <section className="max-w-6xl mx-auto px-6 lg:px-10 pb-24">
        <div className="glass-card rounded-3xl p-8 lg:p-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-violet/10 to-transparent rounded-full blur-[80px] pointer-events-none"></div>

          <div className="relative">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs font-medium text-amber mb-6 border border-amber/20">
              <span className="w-1.5 h-1.5 rounded-full bg-amber"></span>
              Modello di trasparenza totale
            </div>

            <h2 className="font-display text-3xl lg:text-5xl font-bold tracking-tighter max-w-3xl">
              Come funzionano i <span className="bg-gradient-to-r from-amber to-roseSoft bg-clip-text text-transparent">crediti</span>
            </h2>

            <div className="mt-10 grid md:grid-cols-2 gap-8 lg:gap-12">
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-violet/20 border border-violet/30 flex items-center justify-center text-violetSoft shrink-0">
                    <span className="text-lg font-bold">J</span>
                  </div>
                  <div>
                    <h3 className="font-display font-semibold">Crediti JumbAI</h3>
                    <p className="text-sm text-coolGray mt-1">
                      Servono per utilizzare l'interfaccia HUD professionale, l'Editor AI avanzato, la modalita Collage, la Cache locale e tutti gli strumenti extra. Ogni generazione Text-to-Image consuma 1 credito JumbAI (Gratis) o 2 (Premium).
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-amber/20 border border-amber/30 flex items-center justify-center text-amber shrink-0">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  </div>
                  <div>
                    <h3 className="font-display font-semibold">Buzz Civitai (tuoi)</h3>
                    <p className="text-sm text-coolGray mt-1">
                      Le immagini vengono generate sui server Civitai consumando i tuoi Buzz personali, proprio come se usassi Civitai direttamente. JumbAI non applica alcun ricarico nascosto: e una connessione OAuth protetta e trasparente.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 p-5 rounded-2xl bg-violet/5 border border-violet/20 text-sm text-coolGray">
              <p className="flex items-start gap-3">
                <svg className="w-5 h-5 text-violetSoft mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span><strong className="text-textMain">Esempio pratico:</strong> Generi un'immagine Fantasy. JumbAI consuma 1 credito dal tuo conto JumbAI per l'uso dell'HUD e del modulo di generazione. La computazione avviene su Civitai e consuma i tuoi Buzz. Se la generazione fallisce (es. Buzz insufficienti), il credito JumbAI viene immediatamente rimborsato.</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ PRICING ============ */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 lg:px-10 pb-28" aria-label="Piani">
        <div className="text-center mb-14">
          <h2 className="font-display text-4xl lg:text-6xl font-bold tracking-tighter">Scegli il tuo <span className="bg-gradient-to-r from-amber to-roseSoft bg-clip-text text-transparent">piano</span></h2>
          <p className="mt-4 text-coolGray max-w-xl mx-auto">Inizia gratis con 3 crediti. Passa a Premium quando serve di pi&ugrave;.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {/* Free */}
          <article className="glass-card rounded-3xl p-8 lg:p-10 hover:-translate-y-1 transition">
            <h3 className="font-display text-xl font-bold mb-1">Free</h3>
            <p className="text-4xl font-display font-bold mb-2">€0</p>
            <p className="text-sm text-coolGray mb-6">3 crediti gratuiti per iniziare. Nessuna carta richiesta.</p>
            <ul className="text-sm text-coolGray space-y-2.5 mb-8">
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                3 immagini con Wan T2I
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Tutti i formati aspect ratio
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Galleria con cache locale
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Nessuna fatturazione
              </li>
            </ul>
            <button
              type="button"
              onClick={handleLogin}
              disabled={loading}
              className="w-full rounded-xl bg-surface2 border border-white/[0.10] text-textMain font-semibold py-3 hover:bg-surface3 transition disabled:opacity-50"
            >
              {loading ? 'Caricamento...' : 'Inizia Gratis'}
            </button>
          </article>

          {/* Starter */}
          <article className="glass-card rounded-3xl p-8 lg:p-10 relative overflow-hidden ring-1 ring-violet/40 shadow-xl shadow-violet/10">
            <span className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-widest bg-violet/20 text-violetSoft px-2.5 py-1 rounded-full">Popolare</span>
            <h3 className="font-display text-xl font-bold mb-1">Starter</h3>
            <p className="text-4xl font-display font-bold mb-2">€6 <span className="text-lg font-normal text-coolGray">una tantum</span></p>
            <p className="text-sm text-coolGray mb-6">10 immagini premium con Fal.ai SDXL.</p>
            <ul className="text-sm text-coolGray space-y-2.5 mb-8">
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                10 immagini Premium
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Qualita SDXL superiore
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Prompt negativo & seed
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Editor AI + Rimuovi Sfondo
              </li>
            </ul>
            <button
              type="button"
              onClick={handleLogin}
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-violet to-roseSoft text-white font-semibold py-3 shadow-lg shadow-violet/30 hover:shadow-violet/50 transition disabled:opacity-50"
            >
              {loading ? 'Caricamento...' : 'Acquista Starter'}
            </button>
          </article>

          {/* Pro */}
          <article className="glass-card rounded-3xl p-8 lg:p-10 hover:-translate-y-1 transition">
            <h3 className="font-display text-xl font-bold mb-1">Pro</h3>
            <p className="text-4xl font-display font-bold mb-2">€15 <span className="text-lg font-normal text-coolGray">una tantum</span></p>
            <p className="text-sm text-coolGray mb-6">100 immagini premium + modelli avanzati.</p>
            <ul className="text-sm text-coolGray space-y-2.5 mb-8">
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                100 immagini Premium
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Qualita SDXL + code prioritarie
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Editor AI + Rimuovi Sfondo + Collage
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Cache locale + sync multi-dispositivo
              </li>
            </ul>
            <button
              type="button"
              onClick={handleLogin}
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-amber to-roseSoft text-white font-semibold py-3 shadow-lg shadow-amber/30 hover:shadow-amber/50 transition disabled:opacity-50"
            >
              {loading ? 'Caricamento...' : 'Acquista Pro'}
            </button>
          </article>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-6 mt-6 text-xs text-coolGray">
          <span className="flex items-center gap-1.5">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/></svg>
            Pagamento sicuro Stripe
          </span>
          <span>Visa &middot; Mastercard &middot; PayPal</span>
          <span className="flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
            Dati crittografati AES-256
          </span>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section id="faq" className="max-w-3xl mx-auto px-6 lg:px-10 pb-28" aria-label="Domande frequenti">
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl lg:text-5xl font-bold tracking-tighter">Domande <span className="bg-gradient-to-r from-amber to-roseSoft bg-clip-text text-transparent">frequenti</span></h2>
          <p className="mt-3 text-coolGray text-sm">Tutto quello che devi sapere su JumbAI.</p>
        </div>

        <div className="space-y-3">
          {FAQ_ITEMS.map((item, idx) => {
            const open = faqOpen === idx;
            return (
              <div key={item.q} className="glass-card rounded-2xl overflow-hidden border border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setFaqOpen(open ? null : idx)}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-white/[0.03] transition"
                  aria-expanded={open}
                >
                  <span className="font-display font-semibold text-sm sm:text-base">{item.q}</span>
                  <span className={`text-violetSoft text-lg transition shrink-0 ${open ? 'rotate-45' : ''}`}>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  </span>
                </button>
                {open && (
                  <div className="px-5 pb-5 text-sm text-coolGray leading-relaxed border-t border-white/[0.06] pt-3">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ============ CTA FINALE ============ */}
      <section className="max-w-6xl mx-auto px-6 lg:px-10 pb-28">
        <div className="glass-card rounded-3xl p-12 lg:p-16 text-center relative overflow-hidden">
          <div className="absolute top-[-50%] left-[-20%] w-[70%] h-[100%] bg-gradient-to-r from-violet/10 to-roseSoft/10 rounded-full blur-[100px] pointer-events-none"></div>

          <div className="relative">
            <h2 className="font-display text-3xl lg:text-5xl font-bold tracking-tighter max-w-3xl mx-auto">
              Pronto a creare la tua prossima <span className="bg-gradient-to-r from-amber to-roseSoft bg-clip-text text-transparent">opera d'arte</span>?
            </h2>
            <p className="mt-4 text-coolGray max-w-lg mx-auto">
              Unisciti a JumbAI. 3 crediti gratuiti per iniziare. Nessuna carta richiesta.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <button
                onClick={handleLogin}
                disabled={loading}
                className="inline-flex items-center gap-2.5 rounded-xl px-8 py-4 bg-textMain text-ink font-semibold text-base shadow-2xl shadow-white/10 hover:shadow-white/20 hover:-translate-y-0.5 transition-all disabled:opacity-50"
              >
                {loading ? 'Caricamento...' : 'Inizia Gratis con Google'}
              </button>
              <a href="#features" className="inline-flex items-center gap-2 rounded-xl px-8 py-4 glass text-textMain font-medium text-base hover:bg-white/[0.08] transition">
                Scopri di pi&ugrave;
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="border-t border-white/[0.08] py-12 px-6 lg:px-10">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-violet to-roseSoft text-white font-display font-bold text-sm">J</span>
                <span className="font-display text-xl tracking-tight">JumbAI</span>
              </div>
              <p className="text-xs text-coolGray">Il primo HUD professionale per creatori di immagini AI.</p>
            </div>
            <div>
              <h4 className="font-display font-semibold text-sm mb-3">Prodotto</h4>
              <ul className="space-y-2 text-xs text-coolGray">
                <li><a href="#features" className="hover:text-textMain transition">Funzionalita</a></li>
                <li><a href="#pricing" className="hover:text-textMain transition">Piani</a></li>
                <li><a href="#faq" className="hover:text-textMain transition">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-display font-semibold text-sm mb-3">Risorse</h4>
              <ul className="space-y-2 text-xs text-coolGray">
                <li><a href="/" className="hover:text-textMain transition">Home</a></li>
                <li><span className="text-white/20">Termini di Servizio</span></li>
                <li><span className="text-white/20">Privacy Policy</span></li>
              </ul>
            </div>
            <div>
              <h4 className="font-display font-semibold text-sm mb-3">Connettiti</h4>
              <ul className="space-y-2 text-xs text-coolGray">
                <li><span className="text-white/20">Discord (Prossimamente)</span></li>
                <li><span className="text-white/20">X / Twitter (Prossimamente)</span></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/[0.06] pt-6 text-center text-xs text-coolGray/50">
            <p>&copy; {new Date().getFullYear()} JumbAI. Tutti i diritti riservati.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}