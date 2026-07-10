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
