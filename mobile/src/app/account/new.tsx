import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Screen } from '@/components/screen'
import { IconButton, PrimaryButton } from '@/components/ui'
import { radius, spacing } from '@/constants/theme'
import { useAuth } from '@/context/auth-context'
import { useTheme } from '@/context/theme-context'
import { api } from '@/lib/api'
import type { Account, AccountsResponse } from '@/types/api'

const ACCOUNT_TYPES = [
  { name: 'Cash', icon: 'cash-outline' },
  { name: 'Bank', icon: 'business-outline' },
  { name: 'Mobile Money', icon: 'phone-portrait-outline' },
  { name: 'Savings', icon: 'shield-checkmark-outline' },
  { name: 'Investment', icon: 'trending-up-outline' },
  { name: 'Credit', icon: 'card-outline' },
  { name: 'Other', icon: 'wallet-outline' },
] as const

const CURRENCIES = ['GHS', 'USD', 'EUR', 'GBP']

export default function NewAccountScreen() {
  const params = useLocalSearchParams<{ id?: string }>()
  const { token } = useAuth()
  const { colors } = useTheme()
  const editing = Boolean(params.id)
  const [account, setAccount] = useState<Account | null>(null)
  const [name, setName] = useState('')
  const [accountType, setAccountType] = useState('Mobile Money')
  const [currency, setCurrency] = useState('GHS')
  const [customCurrency, setCustomCurrency] = useState('')
  const [openingBalance, setOpeningBalance] = useState('0')
  const [loading, setLoading] = useState(editing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const finalCurrency = currency === 'OTHER' ? customCurrency.trim().toUpperCase() : currency

  useEffect(() => {
    if (!editing) return
    api<AccountsResponse>('/api/finance/accounts', { token }).then((data) => {
      const found = data.accounts.find((item) => String(item.id) === String(params.id))
      if (!found) throw new Error('This account could not be found.')
      setAccount(found); setName(found.name); setAccountType(found.account_type); setOpeningBalance(found.opening_balance)
      if (CURRENCIES.includes(found.currency)) setCurrency(found.currency)
      else { setCurrency('OTHER'); setCustomCurrency(found.currency) }
    }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not prepare this account.')).finally(() => setLoading(false))
  }, [editing, params.id, token])

  async function save() {
    const cleanName = name.trim().replace(/\s+/g, ' ')
    const cleanBalance = openingBalance.trim().replace(',', '.') || '0'
    if (!cleanName || cleanName.length > 80) return setError('Enter an account name between 1 and 80 characters.')
    if (!/^[A-Z]{3}$/.test(finalCurrency)) return setError('Enter a valid three-letter currency code, such as GHS or USD.')
    if (!/^-?\d{1,15}(\.\d{1,2})?$/.test(cleanBalance)) return setError('Enter a valid opening balance with no more than two decimal places.')

    setSaving(true)
    setError('')
    try {
      await api<{ account: Account }>(editing ? `/api/finance/accounts/${params.id}` : '/api/finance/accounts', {
        method: editing ? 'PUT' : 'POST',
        token,
        body: JSON.stringify({ name: cleanName, accountType, currency: finalCurrency, openingBalance: cleanBalance }),
      })
      Alert.alert(editing ? 'Account updated' : 'Account created', editing ? `${cleanName} has been updated without losing its ledger history.` : `${cleanName} is ready to use.`, [{ text: 'Done', onPress: () => router.back() }])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create this account.')
    } finally {
      setSaving(false)
    }
  }

  function changeArchiveState() {
    if (!account) return
    const restoring = account.is_archived
    Alert.alert(restoring ? `Restore ${account.name}?` : `Archive ${account.name}?`, restoring ? 'The account will be available for new transactions again.' : 'The balance remains in reports and net worth. Linked recurring schedules will be paused.', [{ text: 'Cancel', style: 'cancel' }, { text: restoring ? 'Restore' : 'Archive', style: restoring ? 'default' : 'destructive', onPress: async () => {
      try { await api(`/api/finance/accounts/${account.id}/${restoring ? 'restore' : 'archive'}`, { method: 'POST', token }); router.back() }
      catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update this account.') }
    } }])
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={['top', 'left', 'right', 'bottom']} keyboardShouldPersistTaps="handled">
        <View style={styles.header}><View><Text style={[styles.eyebrow, { color: colors.primary }]}>{editing ? 'EDIT ACCOUNT' : 'NEW ACCOUNT'}</Text><Text style={[styles.title, { color: colors.text }]}>{editing ? 'Keep the details clear' : 'Add a money home'}</Text></View><IconButton icon="close" label="Close" onPress={() => router.back()} /></View>
        <Text style={[styles.intro, { color: colors.textMuted }]}>{editing ? 'Changes preserve every ledger posting and historical balance.' : 'Keep cash, bank, mobile money and savings balances clearly separated.'}</Text>

        {loading ? <View style={styles.loading}><ActivityIndicator size="large" color={colors.primary} /></View> : <>

        <Text style={[styles.fieldLabel, { color: colors.text }]}>Account name</Text>
        <TextInput value={name} onChangeText={setName} maxLength={80} placeholder="e.g. MTN MoMo or Main bank" placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} />

        <Text style={[styles.fieldLabel, { color: colors.text }]}>Account type</Text>
        <View style={styles.typeGrid}>{ACCOUNT_TYPES.map((item) => {
          const selected = accountType === item.name
          return <Pressable key={item.name} onPress={() => setAccountType(item.name)} style={({ pressed }) => [styles.typeCard, { backgroundColor: selected ? colors.primarySoft : colors.surface, borderColor: selected ? colors.primary : colors.border, opacity: pressed ? 0.75 : 1 }]}><View style={[styles.typeIcon, { backgroundColor: selected ? colors.primary : colors.surfaceMuted }]}><Ionicons name={item.icon} size={21} color={selected ? colors.white : colors.textMuted} /></View><Text style={[styles.typeText, { color: colors.text }]}>{item.name}</Text></Pressable>
        })}</View>

        <Text style={[styles.fieldLabel, { color: colors.text }]}>Currency</Text>
        <View style={styles.currencyRow}>{[...CURRENCIES, 'OTHER'].map((item) => <Pressable key={item} onPress={() => setCurrency(item)} style={[styles.currencyChip, { backgroundColor: currency === item ? colors.primarySoft : colors.surface, borderColor: currency === item ? colors.primary : colors.border }]}><Text style={[styles.currencyText, { color: colors.text }]}>{item === 'OTHER' ? 'Other' : item}</Text></Pressable>)}</View>
        {currency === 'OTHER' ? <TextInput autoCapitalize="characters" value={customCurrency} onChangeText={(value) => setCustomCurrency(value.replace(/[^a-zA-Z]/g, '').slice(0, 3))} maxLength={3} placeholder="Three-letter code" placeholderTextColor={colors.textMuted} style={[styles.input, styles.customCurrency, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} /> : null}

        <Text style={[styles.fieldLabel, { color: colors.text }]}>Current balance</Text>
        <View style={[styles.balanceField, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.balanceCurrency, { color: colors.primary }]}>{finalCurrency || '—'}</Text><TextInput value={openingBalance} onChangeText={setOpeningBalance} keyboardType="numbers-and-punctuation" placeholder="0.00" placeholderTextColor={colors.textMuted} style={[styles.balanceInput, { color: colors.text }]} /></View>
        <Text style={[styles.helper, { color: colors.textMuted }]}>This becomes the account’s opening ledger balance. You can enter a negative balance for money owed.</Text>

        {error ? <View style={[styles.errorBox, { backgroundColor: colors.surfaceMuted }]}><Ionicons name="alert-circle-outline" size={20} color={colors.negative} /><Text style={[styles.error, { color: colors.negative }]}>{error}</Text></View> : null}
        <View style={styles.save}><PrimaryButton label={editing ? 'Save account' : 'Create account'} onPress={() => void save()} loading={saving} icon={editing ? 'checkmark-circle-outline' : 'add-circle-outline'} /></View>
        {editing && account ? <Pressable onPress={changeArchiveState} style={({ pressed }) => [styles.archive, { borderColor: colors.border, opacity: pressed ? 0.72 : 1 }]}><Ionicons name={account.is_archived ? 'refresh-outline' : 'archive-outline'} size={19} color={account.is_archived ? colors.primary : colors.negative} /><Text style={[styles.archiveText, { color: account.is_archived ? colors.primary : colors.negative }]}>{account.is_archived ? 'Restore account' : 'Archive account'}</Text></Pressable> : null}
        </>}
      </Screen>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginBottom: 4 }, title: { fontSize: 28, lineHeight: 34, fontWeight: '900', letterSpacing: -0.8 }, intro: { fontSize: 15, lineHeight: 22, marginTop: spacing.sm, marginBottom: spacing.md },
  fieldLabel: { fontSize: 14, fontWeight: '800', marginTop: spacing.md, marginBottom: spacing.sm }, input: { minHeight: 54, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: 16 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, typeCard: { width: '48%', minHeight: 72, borderWidth: 1, borderRadius: radius.md, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, typeIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, typeText: { flex: 1, fontSize: 13, fontWeight: '800' },
  currencyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, currencyChip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, currencyText: { fontSize: 13, fontWeight: '800' }, customCurrency: { marginTop: spacing.sm, textTransform: 'uppercase' },
  balanceField: { minHeight: 68, borderWidth: 1, borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md }, balanceCurrency: { fontSize: 15, fontWeight: '900', marginRight: spacing.sm }, balanceInput: { flex: 1, fontSize: 29, fontWeight: '900', letterSpacing: -0.8 }, helper: { fontSize: 12, lineHeight: 18, marginTop: spacing.sm },
  loading: { minHeight: 320, alignItems: 'center', justifyContent: 'center' }, errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderRadius: radius.sm, padding: spacing.sm, marginTop: spacing.md }, error: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '700' }, save: { marginTop: spacing.lg }, archive: { minHeight: 50, borderWidth: 1, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.sm }, archiveText: { fontSize: 13, fontWeight: '900' },
})
