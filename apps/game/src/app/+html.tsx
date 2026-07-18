import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * Web-only HTML shell for the static export. The AdSense meta tag lives
 * here so Google's site-verification crawler finds the account without
 * having to execute the app's JavaScript.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/* viewport-fit=cover extends the page under the phone's home
            indicator / gesture nav bar; without it that strip is painted with
            the flat fallback background instead of the gradient. */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta name="google-adsense-account" content="ca-pub-5889686672909524" />
        {/* Global AdSense loader. Loaded on EVERY page (not just ones with ad
            units) because it is also what delivers the GDPR consent message
            (CMP) published in AdSense "Privacy & messaging", and what the
            AdSense site review looks for. By itself it renders no ads — ad
            units are the gated <ins> slots in src/ads/ad-slot.web.tsx, which
            dedupes against this tag by src. */}
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5889686672909524"
          crossOrigin="anonymous"
        />

        {/* Canonical French metadata for link previews and search engines.
            Kept here (not in a route's <Head>) so every scraped URL gets the
            same French card regardless of the visitor's runtime language. */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="C'est de Gauche ou de Droite ?" />
        <meta property="og:locale" content="fr_FR" />
        <meta property="og:url" content="https://cestdegaucheoudedroite.com" />
        <meta
          property="og:title"
          content="C'est de Gauche ou de Droite ?"
        />
        <meta
          property="og:description"
          content="Classe des objets et concepts entre la gauche et la droite."
        />
        <meta
          property="og:image"
          content="https://cestdegaucheoudedroite.com/og-image.png"
        />
        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:title"
          content="C'est de Gauche ou de Droite ?"
        />
        <meta
          name="twitter:description"
          content="Classe des objets et concepts entre la gauche et la droite."
        />
        <meta
          name="twitter:image"
          content="https://cestdegaucheoudedroite.com/og-image.png"
        />

        <ScrollViewStyleReset />
        {/* ScrollViewStyleReset sizes the app with `height:100%`, which mobile
            browsers resolve against the large viewport (URL bar hidden): the
            deck and bottom buttons end up clipped behind the browser chrome.
            `dvh` tracks the *visible* viewport, so this must come after the
            reset to win the cascade. */}
        <style
          dangerouslySetInnerHTML={{
            __html: '@supports(height:100dvh){#root,body,html{height:100dvh}}',
          }}
        />
        {/* AdSense marks a slot it couldn't fill with data-ad-status;
            collapse it so an invisible ad never reserves layout space. */}
        <style
          dangerouslySetInnerHTML={{
            __html:
              'ins.adsbygoogle[data-ad-status="unfilled"]{display:none!important}',
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
