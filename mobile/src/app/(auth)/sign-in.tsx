import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Screen } from '@/components/screen'
import { BrandMark, IconButton, PrimaryButton } from '@/components/ui'
import { radius, spacing } from '@/constants/theme'
import { useAuth } from '@/context/auth-context'
import { useTheme } from '@/context/theme-context'
import { API_URL } from '@/lib/api'

export default function SignIn() {
  const { signIn } = useAuth()
  const { colors, isDark, toggleTheme } = useTheme()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!email.trim() || !password) return setError('Enter your email and password.')
    setLoading(true)
    setError('')
    try {
      await signIn({ email: email.trim(), password })
      router.replace('/(tabs)')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not sign in.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
        <View style={styles.top}><BrandMark /><IconButton icon={isDark ? 'sunny-outline' : 'moon-outline'} label="Change color theme" onPress={toggleTheme} /></View>
        <View style={styles.hero}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>YOUR MONEY, CLEARLY</Text>
          <Text style={[styles.title, { color: colors.text }]}>Welcome back.</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>A calmer way to see your accounts, spending and plans.</Text>
        </View>
        <View style={[styles.form, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.text }]}>Email address</Text>
          <TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]} />
          <Text style={[styles.label, { color: colors.text }]}>Password</Text>
          <View style={[styles.passwordWrap, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <TextInput autoCapitalize="none" autoComplete="password" secureTextEntry={!showPassword} value={password} onChangeText={setPassword} placeholder="Your password" placeholderTextColor={colors.textMuted} style={[styles.passwordInput, { color: colors.text }]} onSubmitEditing={submit} />
            <Pressable onPress={() => setShowPassword((value) => !value)} hitSlop={12}><Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={21} color={colors.textMuted} /></Pressable>
          </View>
          {error ? <Text accessibilityLiveRegion="polite" style={[styles.error, { color: colors.negative }]}>{error}</Text> : null}
          <PrimaryButton label="Sign in securely" onPress={submit} loading={loading} icon="lock-closed-outline" />
          <Text style={[styles.apiHint, { color: colors.textMuted }]}>Connected to {API_URL}</Text>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  screen: { justifyContent: 'space-between' }, top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hero: { marginVertical: spacing.xxl }, eyebrow: { fontSize: 12, fontWeight: '900', letterSpacing: 1.4, marginBottom: spacing.sm }, title: { fontSize: 43, lineHeight: 48, fontWeight: '900', letterSpacing: -1.7 }, subtitle: { fontSize: 17, lineHeight: 25, marginTop: spacing.sm, maxWidth: 340 },
  form: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm }, label: { fontSize: 14, fontWeight: '800', marginTop: spacing.xs },
  input: { height: 54, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: 16 }, passwordWrap: { height: 54, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center' }, passwordInput: { flex: 1, fontSize: 16 },
  error: { fontSize: 14, lineHeight: 20, fontWeight: '600', marginVertical: spacing.xs }, apiHint: { fontSize: 11, textAlign: 'center', marginTop: spacing.xs },
})
