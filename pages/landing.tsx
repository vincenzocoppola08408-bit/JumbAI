import { useState } from 'react';
import { supabase } from '../lib/supabase-client';

const FAQ_ITEMS = [
  {
    q: 'Quanto costa JumbAI?',
    a: 'Il piano Free include 3 crediti gratuiti per iniziare. Premium: Starter €6 una tantum per 10 immagini e Pro €15 una tantum per 100 immagini via Stripe.',
  },
  {
    q: 'Come funziona la generazione immagini?',
    a: 'Scrivi un prompt descrittivo, scegli un formato (1:1, 16:9, 9:16, ecc.) e premi Genera Gratis (crediti Wan/DashScope) o Premium (Fal.ai SDXL). L\'immagine appare in galleria in tempo reale.',
  },
  {
    q: 'Di chi è la proprietà delle immagini generate?',
    a: 'Le immagini sono generate dal tuo prompt. Per diritti d\'uso consulta i Termini di servizio dei provider (Wan/DashScope, Fal.ai).',
  },
  {
    q: 'Posso scaricare le immagini in alta risoluzione?',
    a: 'Sì, ogni immagine completata ha un pulsante Download. Puoi scaricarle tutte le volte che vuoi.',
  },
  {
    q: 'Cosa sono i crediti?',
    a: 'I crediti sono il saldo per generare. Ogni immagine Gratis costa 1 credito, ogni Premium costa 2. I pacchetti Starter (+10) e Pro (+100) ricaricano il saldo.',
  },
];

export default function LandingPage() {
  const [loading, setLoading] = useState(false);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  async function handleLogin() {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: typeof window !== 'undefined' ? window.location.origin : 'https://jumbai.vercel.app',
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
      {/* NAVBAR */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-16 glass border-b border-white/[0.05] flex items-center justify-between px-6 lg:px-10">
        <a href="/landing" className="flex items-center gap-2.5 group">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-violet to-roseSoft text-white font-display font-bold text-sm shadow-lg shadow-violet/20">J</span>
          <span className="font-display text-xl tracking-tight leading-none">JumbAI</span>
        </a>
        <div className="flex items-center gap-4 text-sm font-medium text-coolGray">
          <a href="#pricing" className="hover:text-textMain transition">Piani</a>
          <a href="#faq" className="hover:text-textMain transition">FAQ</a>
          <button
            onClick={handleLogin}
            disabled={loading}
            className="rounded-xl px-4 py-2 bg-violet text-white text-sm font-semibold hover:bg-violet/90 transition shadow-lg shadow-violet/20 disabled:opacity-50"
          >
            {loading ? 'Caricamento...' : 'Accedi con Google'}
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section id="hero" className="pt-32 pb-16 lg:pt-44 lg:pb-24">
        <div className="max-w-6xl mx-auto px-6 lg:px-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs font-medium text-violetSoft mb-6 border border-white/[0.08]">
            <span className="w-1.5 h-1.5 rounded-full bg-violet animate-pulse"></span>
            Text-to-Image AI — Genera con Wan e Fal.ai
          </div>
          <h1 className="font-display text-5xl sm:text-6xl lg:text-8xl font-bold tracking-tighter leading-[0.95] text-textMain">
            Trasforma il tuo testo in<br />
            <span className="bg-gradient-to-r from-amber to-roseSoft bg-clip-text text-transparent">immagini straordinarie</span><br />
            in pochi secondi.
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-coolGray max-w-2xl leading-relaxed">
            JumbAI trasforma le tue idee in immagini AI di alta qualità. Gratis con Wan (DashScope) o Premium con Fal.ai SDXL. Nessuna GPU, nessun costo nascosto.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <button
              onClick={handleLogin}
              disabled={loading}
              className="inline-flex items-center gap-2.5 rounded-xl px-7 py-3.5 bg-textMain text-ink font-semibold text-base shadow-2xl shadow-white/10 hover:shadow-white/20 hover:-translate-y-0.5 transition disabled:opacity-50"
            >
              {loading ? 'Autenticazione...' : 'Inizia con Google'}
            </button>
            <a href="#pricing" className="inline-flex items-center gap-2 rounded-xl px-7 py-3.5 glass text-textMain font-medium text-base hover:bg-white/[0.08] transition">Scopri i piani</a>
          </div>
        </div>
      </section>

      {/* VETRINA */}
      <section className="max-w-6xl mx-auto px-6 lg:px-10 pb-24" aria-label="Esempi di Generazione">
        <h2 className="font-display text-3xl lg:text-4xl font-bold tracking-tight mb-8">Categorie di immagini</h2>
        <div className="grid md:grid-cols-4 gap-4">
          {[
            { nome: 'Ritratto', icon: '', desc: 'Ritratti fotorealistici con luce studiata', grad: 'from-violet to-purple-700' },
            { nome: 'Fantasy', icon: '', desc: 'Mondi magici e creature fantastiche', grad: 'from-fuchsia-500 to-purple-700' },
            { nome: 'Anime', icon: '', desc: 'Stile giapponese, colori vividi', grad: 'from-sky-400 to-indigo-600' },
            { nome: 'Paesaggio', icon: '', desc: 'Natura, montagne, tramonti mozzafiato', grad: 'from-emerald-500 to-teal-700' },
            { nome: 'Architettura', icon: '', desc: 'Edifici, interni, design moderno', grad: 'from-zinc-400 to-zinc-700' },
            { nome: 'Cibo', icon: '', desc: 'Cucina gourmet, fotografia culinaria', grad: 'from-amber-500 to-orange-700' },
            { nome: 'Moda', icon: '', desc: 'Street style, editorial, haute couture', grad: 'from-red-500 to-rose-700' },
            { nome: 'Astratto', icon: '', desc: 'Arte generativa, forme e gradienti', grad: 'from-cyan-500 to-blue-600' },
          ].map((cat) => (
            <div key={cat.nome} className={`glass-card rounded-2xl p-5 bg-gradient-to-br ${cat.grad} bg-opacity-10 hover:-translate-y-0.5 transition`}>
              <span className="text-3xl">{cat.icon}</span>
              <h3 className="font-display font-bold text-sm mt-2">{cat.nome}</h3>
              <p className="text-xs text-coolGray mt-1">{cat.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 lg:px-10 pb-28" aria-label="Piani">
        <div className="text-center mb-14">
          <h2 className="font-display text-4xl lg:text-6xl font-bold tracking-tighter">Scegli il tuo <span className="bg-gradient-to-r from-amber to-roseSoft bg-clip-text text-transparent">piano</span></h2>
          <p className="mt-4 text-coolGray max-w-xl mx-auto">Inizia gratis con 3 crediti. Passa a Premium quando serve di più.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {/* Free */}
          <article className="glass-card rounded-3xl p-8 lg:p-10 hover:-translate-y-1 transition">
            <h3 className="font-display text-xl font-bold mb-3">Free</h3>
            <p className="text-3xl font-display font-bold mb-2">€0</p>
            <p className="text-sm text-coolGray mb-6">3 crediti gratuiti per iniziare. Nessuna carta richiesta.</p>
            <ul className="text-sm text-coolGray space-y-2 mb-6 list-disc list-inside">
              <li>3 immagini gratis (Wan)</li>
              <li>Formati 1:1, 16:9, 9:16</li>
              <li>Nessuna fatturazione</li>
            </ul>
            <button
              type="button"
              onClick={handleLogin}
              disabled={loading}
              className="w-full rounded-xl bg-surface2 border border-white/[0.10] text-textMain font-semibold py-3 hover:bg-surface3 transition disabled:opacity-50"
            >
              Inizia Gratis
            </button>
          </article>

          {/* Starter */}
          <article className="glass-card rounded-3xl p-8 lg:p-10 relative overflow-hidden ring-1 ring-violet/40 shadow-xl shadow-violet/10">
            <span className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-widest bg-violet/20 text-violetSoft px-2.5 py-1 rounded-full">Popolare</span>
            <h3 className="font-display text-xl font-bold mb-3">Starter</h3>
            <p className="text-3xl font-display font-bold mb-2">€6 <span className="text-lg font-normal text-coolGray"> una tantum</span></p>
            <p className="text-sm text-coolGray mb-6">10 immagini premium (Fal SDXL).</p>
            <ul className="text-sm text-coolGray space-y-2 mb-6 list-disc list-inside">
              <li>10 immagini Premium</li>
              <li>Qualità SDXL superiore</li>
              <li>Tutti i formati aspect ratio</li>
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
            <h3 className="font-display text-xl font-bold mb-3">Pro</h3>
            <p className="text-3xl font-display font-bold mb-2">€15 <span className="text-lg font-normal text-coolGray"> una tantum</span></p>
            <p className="text-sm text-coolGray mb-6">100 immagini premium (Fal SDXL + modelli avanzati).</p>
            <ul className="text-sm text-coolGray space-y-2 mb-6 list-disc list-inside">
              <li>100 immagini Premium</li>
              <li>Qualità SDXL + priorità code</li>
              <li>Tutti i formati + negativo prompt</li>
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
          <span>Pagamento sicuro Stripe</span>
          <span>Visa · Mastercard · PayPal</span>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="max-w-3xl mx-auto px-6 lg:px-10 pb-28" aria-label="FAQ">
        <div className="text-center mb-10">
          <h2 className="font-display text-3xl lg:text-5xl font-bold tracking-tighter">Domande frequenti</h2>
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
                  <span className={`text-violetSoft text-lg transition ${open ? 'rotate-45' : ''}`}>+</span>
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
    </div>
  );
}