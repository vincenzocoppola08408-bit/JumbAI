import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase-client';
import LandingPage from './landing';

// ================================================================
// JumbAI — Landing + Smart Router
// - Se autenticato: reindirizza a /app
// - Se non autenticato: mostra la LandingPage
// ================================================================

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [showLanding, setShowLanding] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/app');
      } else {
        setShowLanding(true);
        setChecking(false);
      }
    });
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink">
        <div className="text-center">
          <span className="inline-block w-10 h-10 rounded-full border-2 border-violet border-t-transparent animate-spin"></span>
          <p className="mt-4 text-coolGray text-sm">Caricamento...</p>
        </div>
      </div>
    );
  }

  if (!showLanding) return null;

  return <LandingPage />;
}