import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Screen } from '@/components/screen'
import { BrandMark, IconButton, PrimaryButton } from '@/components/ui'
import { radius, spacing } from '@/constants/theme'
import { useAuth } from '@/context/auth-context'
import { useTheme } from '@/context/theme-context'

export default function SignUp() {
  const { register } = useAuth()
  const { colors, isDark, toggleTheme } = useTheme()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    const cleanName = name.trim().replace(/\s+/g, ' ')
    const cleanEmail = email.trim().toLowerCase()
    if (cleanName.length < 2 || cleanName.length > 80) return setError('Enter your name using 2 to 80 characters.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return setError('Enter a valid email address.')
    if (password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) return setError('Use at least 12 characters with uppercase, lowercase, a number and a symbol.')
    if (password !== confirmPassword) return setError('The two passwords do not match.')
    setLoading(true); setError('')
    try {
      await register({ name: cleanName, email: cleanEmail, password })
      router.replace('/(tabs)')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not create your account.') }
    finally { setLoading(false) }
  }

  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <Screen edges={['top', 'left', 'right', 'bottom']} keyboardShouldPersistTaps="handled">
      <View style={styles.top}><BrandMark /><IconButton icon={isDark ? 'sunny-outline' : 'moon-outline'} label="Change color theme" onPress={toggleTheme} /></View>
      <View style={styles.hero}><Text style={[styles.eyebrow, { color: colors.primary }]}>START CLEAR</Text><Text style={[styles.title, { color: colors.text }]}>Your money has a home.</Text><Text style={[styles.subtitle, { color: colors.textMuted }]}>Create a private Kora workspace with secure defaults and ready-made categories.</Text></View>
      <View style={[styles.form, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.text }]}>Your name</Text><TextInput autoComplete="name" value={name} onChangeText={setName} maxLength={80} placeholder="How Kora should greet you" placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]} />
        <Text style={[styles.label, { color: colors.text }]}>Email address</Text><TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]} />
        <Text style={[styles.label, { color: colors.text }]}>Password</Text><PasswordField value={password} onChangeText={setPassword} show={showPassword} toggle={() => setShowPassword((value) => !value)} />
        <Text style={[styles.passwordHint, { color: colors.textMuted }]}>12+ characters with uppercase, lowercase, a number and a symbol.</Text>
        <Text style={[styles.label, { color: colors.text }]}>Confirm password</Text><PasswordField value={confirmPassword} onChangeText={setConfirmPassword} show={showPassword} toggle={() => setShowPassword((value) => !value)} submit={submit} />
        {error ? <View style={[styles.errorBox, { backgroundColor: colors.surfaceMuted }]}><Ionicons name="alert-circle-outline" size={20} color={colors.negative} /><Text accessibilityLiveRegion="polite" style={[styles.error, { color: colors.negative }]}>{error}</Text></View> : null}
        <PrimaryButton label="Create my workspace" onPress={() => void submit()} loading={loading} icon="shield-checkmark-outline" />
        <View style={styles.signInRow}><Text style={[styles.prompt, { color: colors.textMuted }]}>Already have an account?</Text><Pressable onPress={() => router.back()}><Text style={[styles.link, { color: colors.primary }]}>Sign in</Text></Pressable></View>
      </View>
    </Screen>
  </KeyboardAvoidingView>
}

function PasswordField({ value, onChangeText, show, toggle, submit }: { value: string; onChangeText: (value: string) => void; show: boolean; toggle: () => void; submit?: () => void }) {
  const { colors } = useTheme()
  return <View style={[styles.passwordWrap, { backgroundColor: colors.background, borderColor: colors.border }]}><TextInput autoCapitalize="none" autoComplete="new-password" secureTextEntry={!show} value={value} onChangeText={onChangeText} placeholder="Create a strong password" placeholderTextColor={colors.textMuted} style={[styles.passwordInput, { color: colors.text }]} onSubmitEditing={submit} /><Pressable onPress={toggle} hitSlop={12}><Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={21} color={colors.textMuted} /></Pressable></View>
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, hero: { marginTop: spacing.xl, marginBottom: spacing.lg }, eyebrow: { fontSize: 12, fontWeight: '900', letterSpacing: 1.4, marginBottom: spacing.sm }, title: { fontSize: 36, lineHeight: 41, fontWeight: '900', letterSpacing: -1.3 }, subtitle: { fontSize: 15, lineHeight: 22, marginTop: spacing.sm }, form: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm }, label: { fontSize: 14, fontWeight: '800', marginTop: spacing.xs }, input: { height: 54, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: 16 }, passwordWrap: { height: 54, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center' }, passwordInput: { flex: 1, fontSize: 16 }, passwordHint: { fontSize: 11, lineHeight: 16 }, errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderRadius: radius.sm, padding: spacing.sm }, error: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '700' }, signInRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.xs }, prompt: { fontSize: 13 }, link: { fontSize: 13, fontWeight: '900' },
})
