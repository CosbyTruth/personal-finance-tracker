import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Screen } from '@/components/screen'
import { IconButton, PrimaryButton } from '@/components/ui'
import { radius, spacing } from '@/constants/theme'
import { useAuth } from '@/context/auth-context'
import { useTheme } from '@/context/theme-context'
import { api } from '@/lib/api'
import type { RecurringItem, RecurringResponse } from '@/types/api'

const TYPES = ['Expense', 'Income'] as const
const FREQUENCIES = ['Weekly', 'Biweekly', 'Monthly', 'Quarterly', 'Yearly'] as const

export default function RecurringEditorScreen() {
  const params = useLocalSearchParams<{ id?: string }>()
  const { token } = useAuth()
  const { colors } = useTheme()
  const editing = Boolean(params.id)
  const [source, setSource] = useState<RecurringResponse | null>(null)
  const [transactionType, setTransactionType] = useState<'Income' | 'Expense'>('Expense')
  const [name, setName] = useState('')
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState('')
  const [frequency, setFrequency] = useState<RecurringItem['frequency']>('Monthly')
  const [nextDueDate, setNextDueDate] = useState(new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api<RecurringResponse>('/api/finance/recurring?includeInactive=true', { token }).then((result) => {
      setSource(result)
      const item = result.items.find((candidate) => String(candidate.id) === String(params.id))
      if (editing && !item) throw new Error('This recurring schedule could not be found.')
      if (item) {
        setTransactionType(item.transaction_type)
        setName(item.name)
        setAccountId(String(item.account_id))
        setCategoryId(String(item.category_id))
        setAmount(item.amount)
        setFrequency(item.frequency)
        setNextDueDate(String(item.next_due_date).slice(0, 10))
        setEndDate(item.end_date ? String(item.end_date).slice(0, 10) : '')
        setNotes(item.notes || '')
      } else {
        const account = result.accounts.find((candidate) => !candidate.is_archived)
        if (account) setAccountId(String(account.id))
        const category = result.categories.find((candidate) => candidate.category_type === 'Expense')
        if (category) setCategoryId(String(category.id))
      }
    }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not prepare this schedule.')).finally(() => setLoading(false))
  }, [editing, params.id, token])

  const accounts = useMemo(() => source?.accounts.filter((account) => !account.is_archived || String(account.id) === accountId) || [], [accountId, source])
  const categories = useMemo(() => source?.categories.filter((category) => category.category_type === transactionType) || [], [source, transactionType])
  const account = accounts.find((candidate) => String(candidate.id) === accountId)

  function chooseType(next: 'Income' | 'Expense') {
    setTransactionType(next)
    const first = source?.categories.find((category) => category.category_type === next)
    setCategoryId(first ? String(first.id) : '')
  }

  async function save() {
    const cleanName = name.trim().replace(/\s+/g, ' ')
    const cleanAmount = amount.trim().replace(',', '.')
    if (!cleanName || cleanName.length > 120) return setError('Enter a schedule name between 1 and 120 characters.')
    if (!accountId) return setError('Choose the account that receives or pays this money.')
    if (!categoryId) return setError(`Choose an ${transactionType.toLowerCase()} category.`)
    if (!/^\d{1,15}(\.\d{1,2})?$/.test(cleanAmount) || Number(cleanAmount) <= 0) return setError('Enter an amount greater than zero with no more than two decimal places.')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDueDate)) return setError('Enter the next due date as YYYY-MM-DD.')
    if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return setError('Enter the end date as YYYY-MM-DD, or leave it empty.')
    if (endDate && endDate < nextDueDate) return setError('The end date cannot be before the next due date.')

    setSaving(true)
    setError('')
    try {
      await api<{ item: RecurringItem }>(editing ? `/api/finance/recurring/${params.id}` : '/api/finance/recurring', {
        method: editing ? 'PUT' : 'POST',
        token,
        body: JSON.stringify({ name: cleanName, transactionType, accountId, categoryId, amount: cleanAmount, frequency, nextDueDate, endDate: endDate || null, notes: notes.trim() }),
      })
      Alert.alert(editing ? 'Schedule updated' : 'Schedule created', `${cleanName} is now part of your cash-flow plan.`, [{ text: 'Done', onPress: () => router.back() }])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save this schedule.')
    } finally { setSaving(false) }
  }

  function remove() {
    Alert.alert('Delete this schedule?', 'Only schedules without occurrence history can be deleted. Otherwise, pause the schedule from the Plan screen.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete schedule', style: 'destructive', onPress: async () => {
      setSaving(true); setError('')
      try { await api(`/api/finance/recurring/${params.id}`, { method: 'DELETE', token }); router.back() }
      catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not delete this schedule.') }
      finally { setSaving(false) }
    } }])
  }

  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <Screen edges={['top', 'left', 'right', 'bottom']} keyboardShouldPersistTaps="handled">
      <View style={styles.header}><View style={styles.headerCopy}><Text style={[styles.eyebrow, { color: colors.primary }]}>{editing ? 'EDIT RECURRING' : 'NEW RECURRING'}</Text><Text style={[styles.title, { color: colors.text }]}>{editing ? 'Tune the rhythm' : 'Plan it once'}</Text></View><IconButton icon="close" label="Close" onPress={() => router.back()} /></View>
      <Text style={[styles.intro, { color: colors.textMuted }]}>Kora will keep the due date moving. You stay in control of when each occurrence is posted.</Text>
      {loading ? <View style={styles.loading}><ActivityIndicator size="large" color={colors.primary} /></View> : <>
        <Text style={[styles.label, { color: colors.text }]}>Money direction</Text>
        <View style={[styles.segment, { backgroundColor: colors.surfaceMuted }]}>{TYPES.map((item) => <Pressable key={item} onPress={() => chooseType(item)} style={[styles.segmentItem, transactionType === item && { backgroundColor: colors.surface }]}><Ionicons name={item === 'Income' ? 'arrow-down-outline' : 'arrow-up-outline'} size={17} color={transactionType === item ? colors.primary : colors.textMuted} /><Text style={[styles.segmentText, { color: transactionType === item ? colors.text : colors.textMuted }]}>{item}</Text></Pressable>)}</View>

        <Text style={[styles.label, { color: colors.text }]}>Schedule name</Text><TextInput value={name} onChangeText={setName} maxLength={120} placeholder={transactionType === 'Expense' ? 'e.g. Internet bill' : 'e.g. Monthly salary'} placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} />
        <Text style={[styles.label, { color: colors.text }]}>Amount</Text><View style={[styles.amountField, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.currency, { color: colors.primary }]}>{account?.currency || '—'}</Text><TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.textMuted} style={[styles.amountInput, { color: colors.text }]} /></View>

        <Text style={[styles.label, { color: colors.text }]}>Account</Text><View style={styles.chips}>{accounts.map((item) => <Pressable key={item.id} onPress={() => setAccountId(String(item.id))} style={[styles.chip, { backgroundColor: accountId === String(item.id) ? colors.primarySoft : colors.surface, borderColor: accountId === String(item.id) ? colors.primary : colors.border }]}><Text style={[styles.chipText, { color: colors.text }]}>{item.name} · {item.currency}</Text></Pressable>)}</View>
        {!accounts.length ? <Text style={[styles.helper, { color: colors.warning }]}>Create an account before adding a recurring schedule.</Text> : null}

        <Text style={[styles.label, { color: colors.text }]}>Category</Text><View style={styles.chips}>{categories.map((item) => <Pressable key={item.id} onPress={() => setCategoryId(String(item.id))} style={[styles.chip, { backgroundColor: categoryId === String(item.id) ? colors.primarySoft : colors.surface, borderColor: categoryId === String(item.id) ? colors.primary : colors.border }]}><Text style={[styles.chipText, { color: colors.text }]}>{item.name}</Text></Pressable>)}</View>
        {!categories.length ? <Text style={[styles.helper, { color: colors.warning }]}>Create a matching category on the web app first.</Text> : null}

        <Text style={[styles.label, { color: colors.text }]}>Repeats</Text><View style={styles.chips}>{FREQUENCIES.map((item) => <Pressable key={item} onPress={() => setFrequency(item)} style={[styles.chip, { backgroundColor: frequency === item ? colors.primarySoft : colors.surface, borderColor: frequency === item ? colors.primary : colors.border }]}><Text style={[styles.chipText, { color: colors.text }]}>{item}</Text></Pressable>)}</View>
        <Text style={[styles.label, { color: colors.text }]}>Next due date</Text><TextInput value={nextDueDate} onChangeText={setNextDueDate} maxLength={10} keyboardType="numbers-and-punctuation" placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} />
        <Text style={[styles.label, { color: colors.text }]}>End date <Text style={{ color: colors.textMuted, fontWeight: '500' }}>(optional)</Text></Text><TextInput value={endDate} onChangeText={setEndDate} maxLength={10} keyboardType="numbers-and-punctuation" placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} />
        <Text style={[styles.label, { color: colors.text }]}>Notes <Text style={{ color: colors.textMuted, fontWeight: '500' }}>(optional)</Text></Text><TextInput value={notes} onChangeText={setNotes} maxLength={2000} multiline placeholder="Anything worth remembering" placeholderTextColor={colors.textMuted} style={[styles.input, styles.notes, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} />
        {error ? <View style={[styles.errorBox, { backgroundColor: colors.surfaceMuted }]}><Ionicons name="alert-circle-outline" size={20} color={colors.negative} /><Text style={[styles.error, { color: colors.negative }]}>{error}</Text></View> : null}
        <View style={styles.save}><PrimaryButton label={editing ? 'Save schedule' : 'Create schedule'} onPress={() => void save()} loading={saving} icon="repeat-outline" /></View>
        {editing ? <Pressable disabled={saving} onPress={remove} style={({ pressed }) => [styles.deleteButton, { borderColor: colors.border, opacity: pressed ? 0.72 : 1 }]}><Ionicons name="trash-outline" size={18} color={colors.negative} /><Text style={[styles.deleteText, { color: colors.negative }]}>Delete unused schedule</Text></Pressable> : null}
      </>}
    </Screen>
  </KeyboardAvoidingView>
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md }, headerCopy: { flex: 1 }, eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginBottom: 4 }, title: { fontSize: 28, lineHeight: 34, fontWeight: '900', letterSpacing: -0.8 }, intro: { fontSize: 15, lineHeight: 22, marginTop: spacing.sm, marginBottom: spacing.md }, loading: { minHeight: 300, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 14, fontWeight: '800', marginTop: spacing.md, marginBottom: spacing.sm }, input: { minHeight: 54, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: 16 }, notes: { minHeight: 90, paddingTop: spacing.md, textAlignVertical: 'top' },
  segment: { flexDirection: 'row', padding: 4, borderRadius: radius.md }, segmentItem: { flex: 1, minHeight: 44, borderRadius: 12, flexDirection: 'row', gap: spacing.xs, alignItems: 'center', justifyContent: 'center' }, segmentText: { fontSize: 13, fontWeight: '800' }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, chip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, chipText: { fontSize: 13, fontWeight: '700' },
  amountField: { minHeight: 72, borderWidth: 1, borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md }, currency: { fontSize: 15, fontWeight: '900', marginRight: spacing.sm }, amountInput: { flex: 1, fontSize: 34, fontWeight: '900', letterSpacing: -1 }, helper: { fontSize: 13, lineHeight: 20 }, errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderRadius: radius.sm, padding: spacing.sm, marginTop: spacing.md }, error: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '700' }, save: { marginTop: spacing.lg }, deleteButton: { minHeight: 50, borderWidth: 1, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.sm }, deleteText: { fontSize: 13, fontWeight: '900' },
})
