import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';
import { ADSENSE_CLIENT, H5_ADS_ENABLED, H5_ADS_TEST } from '@/ads/network';

/**
 * Minimum average time between two H5 Games Ads (Google's default is 120s).
 * Read once at page load; Google may still override it.
 */
const AD_FREQUENCY_HINT = '60s';

/**
 * Web-only HTML shell for the static export. On H5 Games Ads builds it holds
 * Google's tags (below). Other builds have no ad script here on purpose: Adsterra
 * units load per slot (src/ads/ad-slot.web.tsx), and only after the visitor
 * accepted ad cookies.
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

        {/* AdSense site verification, whatever the ad network: loads nothing. */}
        {ADSENSE_CLIENT && (
          <meta name="google-adsense-account" content={ADSENSE_CLIENT} />
        )}

        {/* Google H5 Games Ads: the AdSense tag plus the init snippet Google
            requires ("otherwise your ads won't work"). On EVERY page, not just
            the game: the site is one client-side session, so the page a player
            lands on is the one that needs the tag, and the tag is also what
            delivers the GDPR consent message (CMP) published in AdSense
            "Privacy & messaging". By itself it renders no ads: those are the
            adBreak() calls in src/ads/ad-break.web.ts. Auto ads must stay off
            in AdSense, or Google would add its own units on these pages. */}
        {H5_ADS_ENABLED && (
          <>
            <script
              async
              src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
              crossOrigin="anonymous"
              data-ad-client={ADSENSE_CLIENT}
              data-ad-frequency-hint={AD_FREQUENCY_HINT}
              data-adbreak-test={H5_ADS_TEST ? 'on' : undefined}
            />
            <script
              dangerouslySetInnerHTML={{
                __html:
                  'window.adsbygoogle=window.adsbygoogle||[];var adBreak=adConfig=function(o){adsbygoogle.push(o);};',
              }}
            />
          </>
        )}

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
      </head>
      <body>{children}</body>
    </html>
  );
}
