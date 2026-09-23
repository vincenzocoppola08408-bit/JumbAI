import type { AppProps } from 'next/app';
import Head from 'next/head';
import Script from 'next/script';
import '../styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <title>JumbAI — AI Video Generator</title>
        <meta name="description" content="Genera video professionali con AI. Piano Free BYOK e Premium a margine zero." />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Space+Grotesk:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>
      {/* ADD-10: Vercel Web Analytics — pageviews automatici, no cookie terze parti */}
      <Script src="/_vercel/insights/script.js" strategy="afterInteractive" />
      <Component {...pageProps} />
    </>
  );
}