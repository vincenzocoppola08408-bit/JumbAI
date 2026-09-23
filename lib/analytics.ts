// Privacy-friendly analytics via Vercel Web Analytics (first-party on deploy).
// No third-party cookies. Custom events only when window.va is present.
declare global {
  interface Window {
    va?: (event: 'event', payload: { name: string; data?: Record<string, string | number | boolean> }) => void;
  }
}

export function track(name: string, data?: Record<string, string | number | boolean>) {
  if (typeof window === 'undefined') return;
  try {
    window.va?.('event', data ? { name, data } : { name });
  } catch {
    // ignore
  }
}

export function trackGenera(kind: 'free' | 'premium') {
  track('Genera', { kind });
}

export function trackCheckout(plan: string) {
  track('Checkout', { plan });
}
