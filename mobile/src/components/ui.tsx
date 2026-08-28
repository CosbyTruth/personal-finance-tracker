import { Ionicons } from '@expo/vector-icons'
import { PropsWithChildren } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { radius, spacing } from '@/constants/theme'
import { useTheme } from '@/context/theme-context'

export function BrandMark({ compact = false }: { compact?: boolean }) {
  const { colors } = useTheme()
  return (
    <View style={styles.brandRow}>
      <View style={[styles.brandIcon, { backgroundColor: colors.primary }]}><Text style={styles.brandLetter}>K</Text></View>
      {!compact && <Text style={[styles.brandName, { color: colors.text }]}>Kora Money</Text>}
    </View>
  )
}

export function PageHeading({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: string; subtitle?: string; action?: React.ReactNode }) {
  const { colors } = useTheme()
  return (
    <View style={styles.headingRow}>
      <View style={styles.headingCopy}>
        {eyebrow ? <Text style={[styles.eyebrow, { color: colors.primary }]}>{eyebrow}</Text> : null}
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  )
}

export function Card({ children, tone = 'default' }: PropsWithChildren<{ tone?: 'default' | 'green' }>) {
  const { colors } = useTheme()
  const green = tone === 'green'
  return <View style={[styles.card, { backgroundColor: green ? colors.primary : colors.surface, borderColor: green ? colors.primary : colors.border }]}>{children}</View>
}

export function SectionTitle({ children, detail }: PropsWithChildren<{ detail?: string }>) {
  const { colors } = useTheme()
  return (
    <View style={styles.sectionRow}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{children}</Text>
      {detail ? <Text style={[styles.sectionDetail, { color: colors.textMuted }]}>{detail}</Text> : null}
    </View>
  )
}

export function PrimaryButton({ label, onPress, loading = false, icon }: { label: string; onPress: () => void; loading?: boolean; icon?: keyof typeof Ionicons.glyphMap }) {
  const { colors } = useTheme()
  return (
    <Pressable disabled={loading} onPress={onPress} style={({ pressed }) => [styles.button, { backgroundColor: pressed ? colors.primaryPressed : colors.primary, opacity: loading ? 0.75 : 1 }]}>
      {loading ? <ActivityIndicator color={colors.white} /> : <>{icon ? <Ionicons name={icon} color={colors.white} size={18} /> : null}<Text style={styles.buttonText}>{label}</Text></>}
    </Pressable>
  )
}

export function IconButton({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  const { colors } = useTheme()
  return (
    <Pressable accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.iconButton, { backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.7 : 1 }]}>
      <Ionicons name={icon} size={20} color={colors.text} />
    </Pressable>
  )
}

export function LoadingState() {
  const { colors } = useTheme()
  return <View style={styles.state}><ActivityIndicator size="large" color={colors.primary} /><Text style={[styles.stateText, { color: colors.textMuted }]}>Loading your money picture…</Text></View>
}

export function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  const { colors } = useTheme()
  return (
    <Card><View style={styles.state}><Ionicons name="cloud-offline-outline" size={30} color={colors.negative} /><Text style={[styles.stateTitle, { color: colors.text }]}>We couldn’t load this</Text><Text style={[styles.stateText, { color: colors.textMuted }]}>{message}</Text><Pressable onPress={retry}><Text style={[styles.retry, { color: colors.primary }]}>Try again</Text></Pressable></View></Card>
  )
}

export function EmptyState({ icon, title, message }: { icon: keyof typeof Ionicons.glyphMap; title: string; message: string }) {
  const { colors } = useTheme()
  return <Card><View style={styles.state}><Ionicons name={icon} size={32} color={colors.primary} /><Text style={[styles.stateTitle, { color: colors.text }]}>{title}</Text><Text style={[styles.stateText, { color: colors.textMuted }]}>{message}</Text></View></Card>
}

const styles = StyleSheet.create({
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  brandIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  brandLetter: { color: '#FFFFFF', fontSize: 21, fontWeight: '900' },
  brandName: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  headingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.lg },
  headingCopy: { flex: 1 }, eyebrow: { fontSize: 13, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 5 },
  title: { fontSize: 30, lineHeight: 36, fontWeight: '900', letterSpacing: -1 },
  subtitle: { fontSize: 15, lineHeight: 22, marginTop: 6 },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: spacing.xl, marginBottom: spacing.sm },
  sectionTitle: { fontSize: 19, fontWeight: '800', letterSpacing: -0.3 }, sectionDetail: { fontSize: 13 },
  button: { minHeight: 54, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  iconButton: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  state: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.lg, gap: spacing.sm },
  stateTitle: { fontSize: 17, fontWeight: '800', textAlign: 'center' }, stateText: { fontSize: 14, lineHeight: 21, textAlign: 'center' }, retry: { fontSize: 15, fontWeight: '800', marginTop: spacing.xs },
})
