import { Link } from 'expo-router';
import Head from 'expo-router/head';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useT } from '@/lib/i18n';

/**
 * Exported as dist/404.html, the page the Worker answers unknown URLs with. It
 * boots the app, so a link to a real screen the export doesn't know of (an item
 * approved after the last build) still routes client-side.
 */
export default function NotFoundScreen() {
  const { t } = useT();
  return (
    <ThemedView style={styles.container}>
      <Head>
        <title>{`${t('notFound.title')} — ${t('menu.title')}`}</title>
        <meta name="robots" content="noindex" />
      </Head>
      <View style={styles.content}>
        <ThemedText type="pageTitle" heading={1}>
          {t('notFound.title')}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.body}>
          {t('notFound.body')}
        </ThemedText>
        <Link href={'/solo' as never}>
          <ThemedText type="small" style={styles.inlineLink}>
            {t('item.playCta')}
          </ThemedText>
        </Link>
        <Link href={'/items' as never}>
          <ThemedText type="small" style={styles.inlineLink}>
            {t('item.browseAll')}
          </ThemedText>
        </Link>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  body: {
    textAlign: 'center',
  },
  inlineLink: {
    textDecorationLine: 'underline',
    opacity: 0.9,
  },
});
