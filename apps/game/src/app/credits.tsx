import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/lib/i18n';

const REMIX_URL =
  'https://soundcloud.com/tomaly-546558255/chirac-je-serai-le-president-de-tous-les-francais-thomaslyy-house-remix';
const ORIGINAL_URL = 'https://www.youtube.com/watch?v=K8uo_SJ_PKA';
const SUPPORT_EMAIL = 'support@cestdegaucheoudedroite.com';

function LinkRow({
  icon,
  label,
  url,
  testID,
}: Readonly<{
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  url: string;
  testID?: string;
}>) {
  const theme = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={() => void Linking.openURL(url)}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: theme.backgroundElement,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View style={styles.rowContent}>
        <Ionicons name={icon} size={18} color={theme.text} />
        <ThemedText type="small" style={styles.rowLabel}>
          {label}
        </ThemedText>
        <Ionicons name="open-outline" size={16} color={theme.textSecondary} />
      </View>
    </Pressable>
  );
}

export default function CreditsScreen() {
  const { t } = useT();
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Game & images — AI generated */}
          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {t('credits.aiTitle')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('credits.aiBody')}
            </ThemedText>
          </View>

          {/* Music */}
          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {t('credits.musicTitle')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('credits.musicBody')}
            </ThemedText>
            <LinkRow
              testID="credits-remix-link"
              icon="musical-notes"
              label={t('credits.musicRemixLink')}
              url={REMIX_URL}
            />
            <LinkRow
              testID="credits-original-link"
              icon="logo-youtube"
              label={t('credits.musicOriginalLink')}
              url={ORIGINAL_URL}
            />
          </View>

          {/* Privacy */}
          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {t('credits.privacyTitle')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('credits.privacyBody')}
            </ThemedText>
          </View>

          {/* Contact */}
          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {t('credits.contactTitle')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('credits.contactBody')}
            </ThemedText>
            <LinkRow
              testID="credits-contact-link"
              icon="mail"
              label={SUPPORT_EMAIL}
              url={`mailto:${SUPPORT_EMAIL}`}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  scroll: {
    padding: Spacing.four,
    gap: Spacing.five,
  },
  section: {
    gap: Spacing.two,
  },
  row: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rowLabel: {
    flex: 1,
  },
});
