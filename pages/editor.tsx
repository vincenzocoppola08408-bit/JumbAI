/* encoding-safe */
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';

const TIMELINE_STUDIO_URL = 'https://video-editor.ai-creator.top/';

/**
 * Editor bridge: Timeline Studio sets Cross-Origin-Resource-Policy: same-origin
 * (+ COOP/COEP), so a cross-origin iframe is blocked by the browser.
 * This page ALWAYS loads (local player + open Studio in a new tab).
 * Query: ?url=<videoUrl>&id=<videoId>&prompt=<optional>
 */
export default function EditorPage() {
  const router = useRouter();
  const [iframeBlocked, setIframeBlocked] = useState(false);
  const [triedIframe, setTriedIframe] = useState(false);

  const videoUrl = useMemo(() => {
    const u = router.query.url;
    return typeof u === 'string' && u.trim() ? u.trim() : '';
  }, [router.query.url]);

  const videoId = useMemo(() => {
    const id = router.query.id;
    return typeof id === 'string' ? id : '';
  }, [router.query.id]);

  const prompt = useMemo(() => {
    const p = router.query.prompt;
    return typeof p === 'string' ? p : '';
  }, [router.query.prompt]);

  useEffect(() => {
    // Remote Studio cannot be framed (CORP same-origin). Mark blocked after mount.
    const t = setTimeout(() => {
      setTriedIframe(true);
      setIframeBlocked(true);
    }, 1200);
    return () => clearTimeout(t);
  }, []);

  function apriTimelineStudio() {
    window.open(TIMELINE_STUDIO_URL, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="min-h-screen bg-ink text-textMain">
      <header className="sticky top-0 z-40 h-14 glass border-b border-white/[0.06] flex items-center justify-between px-4 md:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="text-sm text-coolGray hover:text-textMain transition"
          >
            Dashboard
          </button>
          <h1 className="font-display text-base md:text-lg font-bold">Editor video</h1>
        </div>
        <button
          type="button"
          onClick={apriTimelineStudio}
          className="rounded-xl bg-gradient-to-r from-violet to-roseSoft text-white text-sm font-semibold px-4 py-2 shadow-lg shadow-violet/20 hover:shadow-violet/40 transition"
        >
          Apri Timeline Studio
        </button>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-8 py-6 space-y-6">
        <div className="glass-card rounded-3xl p-5 md:p-6 space-y-3">
          <h2 className="font-display text-xl font-bold">Anteprima progetto</h2>
          <p className="text-sm text-coolGray">
            Timeline Studio (esterno) non puo essere incorporato in iframe: risponde con
            <code className="mx-1 text-violetSoft">Cross-Origin-Resource-Policy: same-origin</code>
            e COOP/COEP. Qui carichiamo il player JumbAI; usa il bottone per aprire Timeline Studio in una nuova scheda.
          </p>
          {videoId ? (
            <p className="text-xs text-white/40">ID progetto: {videoId}</p>
          ) : null}
          {prompt ? (
            <p className="text-xs text-coolGray line-clamp-2">Prompt: {prompt}</p>
          ) : null}
        </div>

        <div className="glass-card rounded-3xl overflow-hidden">
          {videoUrl ? (
            <video
              key={videoUrl}
              src={videoUrl}
              controls
              playsInline
              className="w-full max-h-[70vh] bg-black"
              preload="metadata"
            />
          ) : (
            <div className="p-12 text-center text-coolGray">
              <p className="mb-4">Nessun video passato. Torna ai Progetti e usa &quot;Apri in Editor&quot;.</p>
              <button
                type="button"
                onClick={() => router.push('/')}
                className="rounded-xl bg-violet text-white font-semibold px-5 py-2.5 hover:bg-violet/90 transition"
              >
                Vai alla Dashboard
              </button>
            </div>
          )}
        </div>

        <div className="glass-card rounded-3xl p-5 md:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-lg font-semibold">Timeline Studio</h3>
            <button
              type="button"
              onClick={apriTimelineStudio}
              className="rounded-xl border border-violet/40 bg-violet/15 text-violetSoft text-sm font-semibold px-4 py-2 hover:bg-violet/25 transition"
            >
              Apri in nuova scheda
            </button>
          </div>
          <p className="text-sm text-coolGray">
            {triedIframe && iframeBlocked
              ? 'Iframe remoto bloccato dal browser (atteso). Usa Apri Timeline Studio qui sopra: l editor esterno si apre correttamente in una nuova scheda.'
              : 'Verifica disponibilita iframe…'}
          </p>
          <iframe
            title="Timeline Studio"
            src={TIMELINE_STUDIO_URL}
            className="w-full h-64 rounded-2xl border border-white/10 bg-ink2 opacity-40"
            referrerPolicy="no-referrer"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            onError={() => setIframeBlocked(true)}
          />
          <ol className="text-sm text-coolGray list-decimal list-inside space-y-1">
            <li>Apri Timeline Studio con il bottone</li>
            <li>Importa il file MP4 scaricato da Progetti (Export MP4)</li>
            <li>Modifica sulla timeline e esporta dal tool esterno</li>
          </ol>
        </div>
      </main>
    </div>
  );
}
