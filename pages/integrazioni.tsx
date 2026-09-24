import { useRouter } from 'next/router';

export default function IntegrazioniPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-ink text-textMain p-6">
      <h1 className="font-display text-3xl font-bold mb-6">Integrazioni</h1>
      <div className="glass-card rounded-3xl p-6 space-y-4 max-w-xl">
        <h2 className="font-display text-xl font-semibold">Discord</h2>
        <p className="text-sm text-coolGray">Unisciti alla community JumbAI su Discord.</p>
        <a href="https://discord.gg/qhqjF72tyM" target="_blank" rel="noopener noreferrer" className="inline-block rounded-xl bg-violet text-white font-bold py-3 px-6 hover:bg-violet/90 transition">Discord →</a>
        <h2 className="font-display text-xl font-semibold mt-6">X (Twitter)</h2>
        <p className="text-sm text-coolGray">Seguici su X per novità e aggiornamenti.</p>
        <a href="https://x.com/Jumb018" target="_blank" rel="noopener noreferrer" className="inline-block rounded-xl bg-violet text-white font-bold py-3 px-6 hover:bg-violet/90 transition">X →</a>
      </div>
    </div>
  );
}
