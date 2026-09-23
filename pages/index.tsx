import { useState, useEffect, useCallback } from 'react';

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [galleryItems, setGalleryItems] = useState<number[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('jumbai_byok_key');
    if (saved) setApiKey(saved);
    caricaGalleria();
  }, []);

  function salvaChiave() {
    const v = apiKey.trim();
    if (!v) return alert('Inserisci la chiave');
    localStorage.setItem('jumbai_byok_key', v);
    alert('Chiave memorizzata localmente. Il server non la vede mai.');
  }

  async function eseguiFree() {
    const chiave = localStorage.getItem('jumbai_byok_key');
    if (!chiave) return alert('Inserisci prima la tua API Key nel pannello BYOK.');
    if (!prompt.trim()) return alert('Scrivi un prompt.');
    setLoading(true);
    try {
      const resp = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=' + chiave,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: 'Genera descrizione video basandoti su: ' + prompt }] }] }),
        }
      );
      const data = await resp.json();
      alert('Richiesta completata. Consulta la console per i dati ricevuti (esempio BYOK).');
      console.log(data);
    } catch (e) {
      alert('Errore nella richiesta BYOK. Verifica la chiave e i limiti del fornitore.');
    } finally {
      setLoading(false);
    }
  }

  async function eseguiPremium() {
    if (!prompt.trim()) return alert('Scrivi un prompt.');
    setLoading(true);
    try {
      const resp = await fetch('/api/genera-premium', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'utente-esempio', prompt }),
      });
      const data = await resp.json();
      alert(data.message || 'Richiesta inviata al sistema premium.');
    } catch (e) {
      alert('Errore comunicazione con il backend premium.');
    } finally {
      setLoading(false);
    }
  }

  const caricaGalleria = useCallback(() => {
    const items: number[] = [];
    for (let i = 0; i < 3; i++) items.push(i + 1);
    setGalleryItems(items);
  }, []);

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-16 glass border-b border-white/[0.05] flex items-center justify-between px-6 lg:px-10" aria-label="Principale">
        <a href="#" className="flex items-center gap-2.5 group" aria-label="JumbAI Home">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-violet to-roseSoft text-white font-display font-bold text-sm shadow-lg shadow-violet/20 group-hover:shadow-violet/40 transition">
            J
          </span>
          <span className="font-display text-xl tracking-tight text-textMain leading-none">JumbAI</span>
        </a>
        <div className="flex items-center gap-4 sm:gap-6 text-sm font-medium text-coolGray">
          <a href="#generate" className="hover:text-textMain transition">Genera</a>
          <a href="#gallery" className="hover:text-textMain transition">Galleria</a>
          <a href="#piani" className="hover:text-textMain transition">Piani</a>
        </div>
      </nav>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden pt-32 pb-16 lg:pt-44 lg:pb-24" aria-label="Hero">
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none" aria-hidden="true">
            <div className="absolute -top-20 -left-20 w-[600px] h-[600px] rounded-full bg-violet/20 blur-[120px]"></div>
            <div className="absolute top-40 -right-20 w-[500px] h-[500px] rounded-full bg-roseSoft/20 blur-[120px]"></div>
          </div>

          <div className="relative max-w-6xl mx-auto px-6 lg:px-10 anim-fade">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs font-medium text-violetSoft mb-6 border border-white/[0.08]">
              <span className="w-1.5 h-1.5 rounded-full bg-violet animate-pulse"></span>
              Piano Free BYOK attivo — zero costi server
            </div>

            <h1 className="font-display text-5xl sm:text-6xl lg:text-8xl font-bold tracking-tighter leading-[0.95] text-textMain">
              Genera video<br />
              <span className="gradient-text">professionali</span><br />
              in pochi secondi.
            </h1>

            <p className="mt-6 text-lg sm:text-xl text-coolGray max-w-2xl leading-relaxed">
              Un&apos;architettura serverless disaccoppiata che elimina completamente i costi GPU per te. Piano Free tramite la tua chiave
              personale; Premium a margine netto automatico con Stripe e Fal.ai.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <a
                href="#generate"
                className="inline-flex items-center gap-2.5 rounded-xl px-7 py-3.5 bg-textMain text-ink font-semibold text-base shadow-2xl shadow-white/10 hover:shadow-white/20 hover:-translate-y-0.5 transition"
              >
                Inizia a generare
              </a>
              <a
                href="#piani"
                className="inline-flex items-center gap-2 rounded-xl px-7 py-3.5 glass text-textMain font-medium text-base hover:bg-white/[0.08] transition"
              >
                Scopri i piani
              </a>
            </div>
          </div>
        </section>

        {/* Editor / Console */}
        <section id="generate" className="max-w-5xl mx-auto px-6 lg:px-10 pb-24" aria-label="Generatore">
          <div className="glass-card rounded-3xl p-8 lg:p-10 shadow-2xl">
            <div className="flex items-center gap-3 mb-8">
              <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet to-violetSoft text-white flex items-center justify-center shadow-lg shadow-violet/30">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              </span>
              <div>
                <h2 className="font-display text-2xl lg:text-3xl font-bold tracking-tight">Console Generativa</h2>
                <p className="text-sm text-coolGray">Inserisci il prompt, scegli il piano. Il resto è gestito in asincrono.</p>
              </div>
            </div>

            <div className="grid lg:grid-cols-12 gap-8">
              {/* Prompt */}
              <div className="lg:col-span-7">
                <label htmlFor="prompt" className="block text-sm font-medium text-coolGray mb-2">Descrizione del video</label>
                <textarea
                  id="prompt"
                  rows={4}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Una donna in un abito rosso cammina in una strada stretta illuminata al neon, con pioggia leggera, movimento di camera fluido..."
                  className="w-full rounded-xl bg-ink border border-white/[0.12] text-textMain placeholder:text-white/30 px-5 py-4 text-base leading-relaxed focus:outline-none focus:ring-2 focus:ring-violet/40 focus:border-violet/40 transition resize-y min-h-[120px]"
                ></textarea>
                <div className="flex items-center gap-3 mt-3">
                  <span className="text-xs text-coolGray">L&apos;AI interpreta movimenti, luci, inquadratura e atmosfere.</span>
                </div>
              </div>

              {/* Controls */}
              <div className="lg:col-span-5 space-y-4">
                {/* BYOK */}
                <div className="rounded-2xl bg-ink border border-white/[0.08] p-5">
                  <h3 className="font-display text-base font-semibold mb-1">🔑 Piano Free — BYOK</h3>
                  <p className="text-xs text-coolGray mb-3">La chiave resta solo nel tuo browser (localStorage).</p>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      id="apiKeyInput"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="API Key (Google/Gemini / HuggingFace)"
                      className="flex-1 rounded-lg bg-surface border border-white/[0.10] text-sm px-3 py-2.5 text-textMain placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-violet/30 transition"
                    />
                    <button onClick={salvaChiave} className="rounded-lg bg-violet text-white text-sm font-semibold px-4 py-2.5 hover:bg-violet/90 transition shadow-lg shadow-violet/20">
                      Salva
                    </button>
                  </div>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={eseguiFree}
                    disabled={loading}
                    className="rounded-xl bg-surface2 border border-white/[0.10] text-textMain font-semibold py-3.5 hover:bg-surface3 transition flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span>Genera Gratis</span>
                    <span className="text-xs text-coolGray group-hover:text-textMain transition">BYOK</span>
                  </button>
                  <button
                    onClick={eseguiPremium}
                    disabled={loading}
                    className="rounded-xl bg-gradient-to-r from-violet to-roseSoft text-white font-bold py-3.5 shadow-lg shadow-violet/30 hover:shadow-violet/50 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span>Genera Premium</span>
                    <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded-md">1 Credito</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Status */}
            {loading && (
              <div className="mt-6 rounded-xl bg-violet/10 border border-violet/20 text-violetSoft px-5 py-4 text-sm font-medium flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-violet animate-pulse"></span>
                <span>Architettura asincrona attiva: il video apparirà in galleria tra 30-60 secondi.</span>
              </div>
            )}
          </div>
        </section>

        {/* Gallery */}
        <section id="gallery" className="max-w-6xl mx-auto px-6 lg:px-10 pb-24" aria-label="Galleria video">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-3xl lg:text-4xl font-bold tracking-tight">Galleria generata</h2>
            <button onClick={caricaGalleria} className="text-sm font-medium text-violetSoft hover:text-white transition">Aggiorna</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {galleryItems.map((i) => (
              <article key={i} className="glass-card rounded-2xl overflow-hidden hover:-translate-y-1 transition shadow-xl">
                <div className="relative bg-ink2 aspect-video flex items-center justify-center overflow-hidden">
                  <div className="absolute inset-0 shimmer"></div>
                  <div className="relative z-10 text-center px-4">
                    <span className="inline-block rounded-full bg-violet/20 text-violetSoft text-xs font-bold px-2.5 py-1 mb-2">Video generato</span>
                    <h4 className="font-display font-bold text-lg leading-snug">Generazione esempio {i}</h4>
                  </div>
                </div>
                <div className="p-5">
                  <p className="text-xs text-coolGray mb-3">Prompt: &quot;Cinematic cyberpunk street, neon rain, camera tracking&quot;</p>
                  <div className="flex items-center gap-2 text-xs text-violetSoft font-medium">
                    <span>Guarda il video →</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {galleryItems.length === 0 && (
            <div className="text-coolGray text-sm mt-2">Nessun video disponibile. Genera il primo per vedere il risultato.</div>
          )}
        </section>

        {/* Piani / Business */}
        <section id="piani" className="max-w-6xl mx-auto px-6 lg:px-10 pb-28" aria-label="Piani commerciali">
          <div className="text-center mb-14">
            <h2 className="font-display text-4xl lg:text-6xl font-bold tracking-tighter">
              Un modello <span className="gradient-text">ibrido</span>, senza costi fissi.
            </h2>
            <p className="mt-4 text-coolGray max-w-xl mx-auto">
              Zero server GPU, zero database sensibile, margine automatico. Il tuo profitto viene dal delta tra il prezzo di vendita e il costo API esterno.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <article className="glass-card rounded-3xl p-8 lg:p-10 hover:-translate-y-1 transition">
              <h3 className="font-display text-xl font-bold mb-3">Piano Free — BYOK</h3>
              <p className="text-3xl font-display font-bold mb-2">€0,00</p>
              <p className="text-sm text-coolGray mb-6">Inserisci la tua chiave personale da Google AI Studio o HuggingFace. Il sito è solo un telecomando grafico.</p>
              <ul className="text-sm text-coolGray space-y-2 mb-6 list-disc list-inside">
                <li>Privacy totale: chiave solo in localStorage</li>
                <li>Zero responsabilità legale sui dati sensibili</li>
                <li>Costi server = €0</li>
              </ul>
            </article>

            <article className="glass-card rounded-3xl p-8 lg:p-10 relative overflow-hidden ring-1 ring-violet/40 shadow-xl shadow-violet/10">
              <span className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-widest bg-violet/20 text-violetSoft px-2.5 py-1 rounded-full">Premium</span>
              <h3 className="font-display text-xl font-bold mb-3">Piano Premium</h3>
              <p className="text-3xl font-display font-bold mb-2">€15 / pacchetto</p>
              <p className="text-sm text-coolGray mb-6">100 video. Pagamento tramite Stripe con Merchant of Record automatico (IVA/Sales Tax gestita da Stripe).</p>
              <ul className="text-sm text-coolGray space-y-2 mb-6 list-disc list-inside">
                <li>Generazione asincrona anti-timeout</li>
                <li>Webhooks Fal.ai per consegna video</li>
                <li>Margine netto: ~€11 a pacchetto</li>
              </ul>
            </article>

            <article className="glass-card rounded-3xl p-8 lg:p-10 hover:-translate-y-1 transition">
              <h3 className="font-display text-xl font-bold mb-3">Architettura</h3>
              <p className="text-3xl font-display font-bold mb-2">Serverless</p>
              <p className="text-sm text-coolGray mb-6">Vercel + Supabase + Cloudflare R2 + Fal.ai. Niente calcoli pesanti sul tuo server.</p>
              <ul className="text-sm text-coolGray space-y-2 mb-6 list-disc list-inside">
                <li>DB: 50k utenti / 500MB (free Supabase)</li>
                <li>Storage: 10GB gratuito con egress zero</li>
                <li>Backend: funzioni che si spengono in &lt;1s</li>
              </ul>
            </article>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.08] py-10 text-center text-coolGray text-sm">
        <p>JumbAI — Progetto SaaS AI Video a costo zero. Tutti i diritti riservati.</p>
        <p className="mt-2 text-xs text-white/30">Non è una consulenza fiscale o legale. Verifica le normative locali.</p>
      </footer>
    </div>
  );
}