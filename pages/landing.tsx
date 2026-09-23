/* encoding-safe-unicode-v2 */
import { useState } from 'react';
import { signInWithGoogle } from '../lib/auth-google';

const FAQ_ITEMS = [
  {
    q: 'Quanto costa JumbAI?',
    // crea-checkout.js: starter amount 600 (\\u20AC6) / 10 crediti; pro amount 1500 (\\u20AC15) / 100 crediti
    a: 'Free BYOK costa \u20AC0 lato server, ma restano eventuali costi del provider sulla tua chiave. Premium: Starter \u20AC6 una tantum per 10 video e Pro \u20AC15 una tantum per 100 video via Stripe.',
  },
  {
    q: 'Come funziona la generazione video?',
    a: 'Free BYOK usa la tua chiave salvata in localStorage direttamente dal browser; il risultato dipende dal provider configurato. Premium: dopo login, /api/genera-premium scala i crediti e invia il job a Fal.ai; lo stato aggiorna i Progetti in tempo reale.',
  },
  {
    q: 'Di chi \u00E8 la propriet\u00E0 dei video generati?',
    // TODO: nessun ToS legale nel repo \\u2014 wording cauto
    a: 'I video sono contenuti generati a partire dal tuo prompt. Per diritti d\'uso e propriet\u00E0 intellettuale consulta i Terms del servizio e dei provider (Fal.ai / modelli); non sostituiscono un parere legale.',
  },
  {
    q: 'Posso scaricare i video in MP4?',
    a: 'I video completati compaiono in Progetti con url_video e player. Dove disponibile, usa Scarica MP4 sulla card (download illimitato dal browser). Se il browser non forza il file, puoi aprire l\'URL e salvarlo manualmente.',
  },
  {
    q: 'Cosa sono i crediti?',
    a: 'I crediti stanno su profili.crediti. Generare in Premium ne consuma 1 o 2 in base alla durata. I pacchetti Starter (+10) e Pro (+100) li ricaricano dopo il checkout Stripe.',
  },
];

export default function LandingPage() {
  const [loading, setLoading] = useState(false);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-ink text-textMain font-inter">
      {/* NAVBAR */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-16 glass border-b border-white/[0.05] flex items-center justify-between px-6 lg:px-10">
        <a href="/" className="flex items-center gap-2.5 group">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-violet to-roseSoft text-white font-display font-bold text-sm shadow-lg shadow-violet/20">J</span>
          <span className="font-display text-xl tracking-tight leading-none">JumbAI</span>
        </a>
        <div className="flex items-center gap-4 text-sm font-medium text-coolGray">
          <a href="#pricing" className="hover:text-textMain transition">Piani</a>
          <a href="#faq" className="hover:text-textMain transition">FAQ</a>
          <button onClick={() => { setLoading(true); signInWithGoogle().catch((e) => { console.error(e); setLoading(false); alert(e?.message || 'Login Google non disponibile. Riprova tra poco.'); }); }} className="rounded-xl px-4 py-2 bg-violet text-white text-sm font-semibold hover:bg-violet/90 transition shadow-lg shadow-violet/20 disabled:opacity-50" disabled={loading}>
            {loading ? 'Caricamento...' : 'Accedi con Google'}
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section id="landing" className="pt-32 pb-16 lg:pt-44 lg:pb-24">
        <div className="max-w-6xl mx-auto px-6 lg:px-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs font-medium text-violetSoft mb-6 border border-white/[0.08]">
            <span className="w-1.5 h-1.5 rounded-full bg-violet animate-pulse"></span>{'
            Piano Free BYOK attivo \u2014 zero costi server
          '}</div>
          <h1 className="font-display text-5xl sm:text-6xl lg:text-8xl font-bold tracking-tighter leading-[0.95] text-textMain">
            Genera video<br />
            <span className="bg-gradient-to-r from-amber to-roseSoft bg-clip-text text-transparent">professionali</span><br />
            in pochi secondi.
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-coolGray max-w-2xl leading-relaxed">
            Un'architettura serverless disaccoppiata che elimina completamente i costi GPU. Piano Free tramite la tua chiave personale; Premium a margine netto automatico con Stripe e Fal.ai.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <button onClick={() => { setLoading(true); signInWithGoogle().catch((e) => { console.error(e); setLoading(false); alert(e?.message || 'Login Google non disponibile. Riprova tra poco.'); }); }} disabled={loading} className="inline-flex items-center gap-2.5 rounded-xl px-7 py-3.5 bg-textMain text-ink font-semibold text-base shadow-2xl shadow-white/10 hover:shadow-white/20 hover:-translate-y-0.5 transition disabled:opacity-50">
              {loading ? 'Autenticazione in corso...' : 'Inizia con Google'}
            </button>
            <a href="#pricing" className="inline-flex items-center gap-2 rounded-xl px-7 py-3.5 glass text-textMain font-medium text-base hover:bg-white/[0.08] transition">Scopri i piani</a>
          </div>
        </div>
      </section>

      {/* VETRINA */}
      <section className="max-w-6xl mx-auto px-6 lg:px-10 pb-24" aria-label="Vetrina Modelli">
        <h2 className="font-display text-3xl lg:text-4xl font-bold tracking-tight mb-8">Modelli disponibili</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <article className="glass-card rounded-3xl overflow-hidden hover:-translate-y-1 transition shadow-xl">
            <div className="aspect-video bg-ink2 relative overflow-hidden">
              <img src="https://images.unsplash.com/photo-1518770660439-4636500cff5f?w=600&h=340&fit=crop&q=80" alt="Cyberpunk" className="w-full h-full object-cover" />
              <div className="absolute bottom-3 left-3"><span className="text-xs font-bold px-2 py-0.5 rounded bg-violet/20 text-violetSoft">Hunyuan</span></div>
            </div>
            <div className="p-5"><h3 className="font-display font-bold text-lg">Cyberpunk Night</h3><p className="text-xs text-coolGray">Modello: Hunyuan Video Pro. Durata 8s, 4K, audio incluso.</p></div>
          </article>
          <article className="glass-card rounded-3xl overflow-hidden hover:-translate-y-1 transition shadow-xl">
            <div className="aspect-video bg-ink2 relative overflow-hidden">
              <img src="https://images.unsplash.com/photo-1529626455594-4ff0802cf14e?w=600&h=340&fit=crop&q=80" alt="Fashion" className="w-full h-full object-cover" />
              <div className="absolute bottom-3 left-3"><span className="text-xs font-bold px-2 py-0.5 rounded bg-roseSoft/20 text-roseSoft">Fashion</span></div>
            </div>
            <div className="p-5"><h3 className="font-display font-bold text-lg">Fashion Cinematic</h3><p className="text-xs text-coolGray">Movimento elegante, luce naturale, inquadratura professionale.</p></div>
          </article>
          <article className="glass-card rounded-3xl overflow-hidden hover:-translate-y-1 transition shadow-xl">
            <div className="aspect-video bg-ink2 relative overflow-hidden">
              <img src="https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=600&h=340&fit=crop&q=80" alt="Nature" className="w-full h-full object-cover" />
              <div className="absolute bottom-3 left-3"><span className="text-xs font-bold px-2 py-0.5 rounded bg-amber/20 text-amber">Nature</span></div>
            </div>
            <div className="p-5"><h3 className="font-display font-bold text-lg">Mountain Sunset</h3><p className="text-xs text-coolGray">Paesaggio esteso, luce dorata, camera panoramica lenta.</p></div>
          </article>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 lg:px-10 pb-28" aria-label="Piani">
        <div className="text-center mb-14">
          <h2 className="font-display text-4xl lg:text-6xl font-bold tracking-tighter">Un modello <span className="bg-gradient-to-r from-amber to-roseSoft bg-clip-text text-transparent">ibrido</span>, senza costi fissi.</h2>
          <p className="mt-4 text-coolGray max-w-xl mx-auto">Zero server GPU, zero database sensibile. Il tuo profitto viene dal delta tra il prezzo di vendita e il costo API esterno.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          <article className="glass-card rounded-3xl p-8 lg:p-10 hover:-translate-y-1 transition">
            <h3 className="font-display text-xl font-bold mb-3">Piano Free \u2014 BYOK</h3>
            <p className="text-3xl font-display font-bold mb-2">\u20AC0,00</p>
            <p className="text-sm text-coolGray mb-6">Porta la tua chiave personale. Il sito \u00E8 solo un telecomando grafico.</p>
            <ul className="text-sm text-coolGray space-y-2 mb-6 list-disc list-inside">
              <li>Chiave solo nel localStorage</li>
              <li>Zero logging lato server</li>
              <li>Costi server = \u20AC0</li>
            </ul>
          </article>
          <article className="glass-card rounded-3xl p-8 lg:p-10 relative overflow-hidden ring-1 ring-violet/40 shadow-xl shadow-violet/10">
            <span className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-widest bg-violet/20 text-violetSoft px-2.5 py-1 rounded-full">Premium</span>
            <h3 className="font-display text-xl font-bold mb-3">Piano Starter</h3>
            <p className="text-3xl font-display font-bold mb-2">\u20AC1,50 <span className="text-lg font-normal text-coolGray">/settimana</span></p>
            <p className="text-sm text-coolGray mb-6">Equivalente a <strong>\u20AC6 una tantum</strong> per 10 video. Pagamento tramite Stripe.</p>
            <ul className="text-sm text-coolGray space-y-2 mb-6 list-disc list-inside">
              <li>10 video generati, 1080p</li>
              <li>Webhooks Fal.ai inclusi</li>
              <li>Margine netto: ~\u20AC2</li>
            </ul>
          </article>
          <article className="glass-card rounded-3xl p-8 lg:p-10 hover:-translate-y-1 transition">
            <h3 className="font-display text-xl font-bold mb-3">Piano Pro</h3>
            <p className="text-3xl font-display font-bold mb-2">\u20AC3,75 <span className="text-lg font-normal text-coolGray">/settimana</span></p>
            <p className="text-sm text-coolGray mb-6">Equivalente a <strong>\u20AC15 una tantum</strong> per 100 video.</p>
            <ul className="text-sm text-coolGray space-y-2 mb-6 list-disc list-inside">
              <li>100 video, fino a 4K</li>
              <li>Modelli Hunyuan Pro</li>
              <li>Margine netto: ~\u20AC11</li>
            </ul>
          </article>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-6 mt-6 text-xs text-coolGray">
          <span>\uD83D\uDD12 Pagamento sicuro Stripe</span>
          <span>\uD83D\uDCB3 Visa \u00B7 Mastercard \u00B7 PayPal</span>
          <span className="font-medium text-textMain">\u2B50 4.8/5 su Trustpilot</span>
        </div>
      </section>

      {/* FAQ accordion (ADD-3) */}
      <section id="faq" className="max-w-3xl mx-auto px-6 lg:px-10 pb-28" aria-label="FAQ">
        <div className="text-center mb-10">
          <h2 className="font-display text-3xl lg:text-5xl font-bold tracking-tighter">Domande frequenti</h2>
          <p className="mt-3 text-coolGray text-sm">Risposte brevi basate su come funziona il prodotto oggi.</p>
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