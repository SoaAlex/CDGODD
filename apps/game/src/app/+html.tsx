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
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <meta name="google-adsense-account" content="ca-pub-5889686672909524" />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
