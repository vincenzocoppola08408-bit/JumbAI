import { useRouter } from 'next/router';
import { useState, useRef } from 'react';

export default function VideoStudioPage() {
  const router = useRouter();
  const videoUrl = typeof router.query.url === 'string' ? router.query.url : '';
  const [clips, setClips] = useState<string[]>([]);
  const [textOverlay, setTextOverlay] = useState('');

  return (
    <div className="min-h-screen bg-ink text-textMain p-6">
      <h1 className="font-display text-3xl font-bold mb-6">Video Studio</h1>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-3xl p-5 space-y-4">
          <h2 className="font-display text-xl font-semibold">Anteprima</h2>
          <video src={videoUrl} controls playsInline className="w-full rounded-xl bg-black" />
        </div>
        <div className="glass-card rounded-3xl p-5 space-y-4">
          <h2 className="font-display text-xl font-semibold">Strumenti</h2>
          <input
            type="text"
            value={textOverlay}
            onChange={(e) => setTextOverlay(e.target.value)}
            placeholder="Testo overlay..."
            className="w-full input-jumbai"
          />
          <button
            onClick={() => setClips((prev) => [...prev, `clip-${prev.length}`])}
            className="w-full rounded-xl bg-violet text-white font-semibold py-3 hover:bg-violet/90 transition"
          >
            Unisci clip
          </button>
          <div className="text-sm text-coolGray">Clips: {clips.length}</div>
        </div>
      </div>
    </div>
  );
}
