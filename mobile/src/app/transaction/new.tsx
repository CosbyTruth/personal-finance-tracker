import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Screen } from '@/components/screen'
import { Card, IconButton, PrimaryButton } from '@/components/ui'
import { radius, spacing } from '@/constants/theme'
import { useAuth } from '@/context/auth-context'
import { useTheme } from '@/context/theme-context'
import { api } from '@/lib/api'
import type { Account, Category, Transaction, TransactionsResponse } from '@/types/api'

type TransactionType = Transaction['transaction_type']

function Choice({ selected, label, detail, onPress }: { selected: boolean; label: string; detail?: string; onPress: () => void }) {
  const { colors } = useTheme()
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.choice, { backgroundColor: selected ? colors.primarySoft : colors.surface, borderColor: selected ? colors.primary : colors.border, opacity: pressed ? 0.75 : 1 }]}>
      <View style={[styles.radio, { borderColor: selected ? colors.primary : colors.textMuted }]}>{selected ? <View style={[styles.radioDot, { backgroundColor: colors.primary }]} /> : null}</View>
      <View style={styles.choiceCopy}><Text style={[styles.choiceLabel, { color: colors.text }]}>{label}</Text>{detail ? <Text style={[styles.choiceDetail, { color: colors.textMuted }]}>{detail}</Text> : null}</View>
    </Pressable>
  )
}

export default function NewTransactionScreen() {
  const params = useLocalSearchParams<{ id?: string }>()
  const { token } = useAuth()
  const { colors } = useTheme()
  const editing = Boolean(params.id)
  const [type, setType] = useState<TransactionType>('Expense')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [transferAccountId, setTransferAccountId] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api<TransactionsResponse>('/api/finance/transactions', { token })
      .then((data) => {
        const transaction = data.transactions.find((item) => String(item.id) === String(params.id))
        if (editing && !transaction) throw new Error('This transaction could not be found.')
        const available = data.accounts.filter((item) => !item.is_archived || String(item.id) === String(transaction?.account_id) || String(item.id) === String(transaction?.transfer_account_id))
        setAccounts(available)
        setCategories(data.categories)
        if (transaction) {
          setType(transaction.transaction_type); setAccountId(String(transaction.account_id)); setCategoryId(transaction.category_id ? String(transaction.category_id) : ''); setTransferAccountId(transaction.transfer_account_id ? String(transaction.transfer_account_id) : ''); setAmount(transaction.amount); setDescription(transaction.description || ''); setNotes(transaction.notes || ''); setTransactionDate(String(transaction.transaction_date).slice(0, 10))
        } else if (available[0]) setAccountId(String(available[0].id))
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not prepare the transaction form.'))
      .finally(() => setLoading(false))
  }, [editing, params.id, token])

  const selectedAccount = accounts.find((item) => String(item.id) === accountId)
  const matchingCategories = useMemo(() => categories.filter((item) => item.category_type === type), [categories, type])
  const transferAccounts = accounts.filter((item) => String(item.id) !== accountId && item.currency === selectedAccount?.currency)

  function changeType(next: TransactionType) {
    setType(next)
    setCategoryId('')
    setTransferAccountId('')
    setError('')
  }

  async function save() {
    const normalizedAmount = amount.trim().replace(',', '.')
    if (!accountId) return setError('Choose the account this transaction belongs to.')
    if (!/^\d{1,15}(\.\d{1,2})?$/.test(normalizedAmount) || Number(normalizedAmount) <= 0) return setError('Enter a valid amount greater than zero, using no more than two decimal places.')
    if (type === 'Transfer' && !transferAccountId) return setError('Choose the account receiving this transfer.')
    if (type !== 'Transfer' && !categoryId) return setError(`Choose an ${type.toLowerCase()} category.`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(transactionDate)) return setError('Enter the date as YYYY-MM-DD.')

    setSaving(true)
    setError('')
    try {
      const idempotencyKey = `mobile:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`
      await api<{ transaction: Transaction }>(editing ? `/api/finance/transactions/${params.id}` : '/api/finance/transactions', {
        method: editing ? 'PUT' : 'POST',
        token,
        headers: editing ? undefined : { 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({
          transactionType: type,
          accountId,
          categoryId: type === 'Transfer' ? null : categoryId,
          transferAccountId: type === 'Transfer' ? transferAccountId : null,
          amount: normalizedAmount,
          description: description.trim(),
          notes: notes.trim(),
          transactionDate,
        }),
      })
      Alert.alert(editing ? 'Transaction corrected' : 'Transaction saved', editing ? 'Kora posted a balanced reversal and replacement, preserving the audit trail.' : 'Your balances and activity have been updated.', [{ text: 'Done', onPress: () => router.back() }])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save this transaction.')
    } finally {
      setSaving(false)
    }
  }

  function remove() {
    Alert.alert('Remove this transaction?', 'Kora will reverse the ledger posting instead of erasing financial history.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Reverse and remove', style: 'destructive', onPress: async () => {
      setSaving(true); setError('')
      try { await api(`/api/finance/transactions/${params.id}`, { method: 'DELETE', token }); Alert.alert('Transaction reversed', 'Balances were corrected and the audit trail was preserved.', [{ text: 'Done', onPress: () => router.back() }]) }
      catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not remove this transaction.') }
      finally { setSaving(false) }
    } }])
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={['top', 'left', 'right', 'bottom']} keyboardShouldPersistTaps="handled">
        <View style={styles.header}><View><Text style={[styles.eyebrow, { color: colors.primary }]}>{editing ? 'CORRECT TRANSACTION' : 'NEW TRANSACTION'}</Text><Text style={[styles.title, { color: colors.text }]}>{editing ? 'Keep the record true' : 'Record money'}</Text></View><IconButton icon="close" label="Close" onPress={() => router.back()} /></View>
        {loading ? <View style={styles.loading}><ActivityIndicator size="large" color={colors.primary} /></View> : <>
          <View style={[styles.segment, { backgroundColor: colors.surfaceMuted }]}>{(['Expense', 'Income', 'Transfer'] as TransactionType[]).map((item) => <Pressable key={item} onPress={() => changeType(item)} style={[styles.segmentItem, type === item && { backgroundColor: colors.surface }]}><Ionicons name={item === 'Expense' ? 'arrow-up-outline' : item === 'Income' ? 'arrow-down-outline' : 'swap-horizontal-outline'} size={17} color={type === item ? colors.primary : colors.textMuted} /><Text style={[styles.segmentText, { color: type === item ? colors.text : colors.textMuted }]}>{item}</Text></Pressable>)}</View>

          <Text style={[styles.fieldLabel, { color: colors.text }]}>Amount</Text>
          <View style={[styles.amountField, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.currency, { color: colors.primary }]}>{selectedAccount?.currency || 'GHS'}</Text><TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.textMuted} style={[styles.amountInput, { color: colors.text }]} /></View>

          <Text style={[styles.fieldLabel, { color: colors.text }]}>From account</Text>
          <View style={styles.choiceList}>{accounts.map((account) => <Choice key={account.id} selected={accountId === String(account.id)} label={account.name} detail={`${account.account_type} · ${account.currency}`} onPress={() => { setAccountId(String(account.id)); setTransferAccountId('') }} />)}</View>

          {type === 'Transfer' ? <><Text style={[styles.fieldLabel, { color: colors.text }]}>To account</Text><View style={styles.choiceList}>{transferAccounts.map((account) => <Choice key={account.id} selected={transferAccountId === String(account.id)} label={account.name} detail={`${account.account_type} · ${account.currency}`} onPress={() => setTransferAccountId(String(account.id))} />)}</View>{!transferAccounts.length ? <Text style={[styles.helper, { color: colors.warning }]}>Add another active {selectedAccount?.currency || ''} account before making a transfer.</Text> : null}</> : <><Text style={[styles.fieldLabel, { color: colors.text }]}>Category</Text><View style={styles.categoryGrid}>{matchingCategories.map((category) => <Pressable key={category.id} onPress={() => setCategoryId(String(category.id))} style={[styles.category, { backgroundColor: categoryId === String(category.id) ? colors.primarySoft : colors.surface, borderColor: categoryId === String(category.id) ? colors.primary : colors.border }]}><Text style={[styles.categoryText, { color: colors.text }]}>{category.name}</Text></Pressable>)}</View></>}

          <Text style={[styles.fieldLabel, { color: colors.text }]}>Description <Text style={{ color: colors.textMuted, fontWeight: '500' }}>(optional)</Text></Text>
          <TextInput value={description} onChangeText={setDescription} maxLength={180} placeholder={type === 'Income' ? 'e.g. August salary' : type === 'Transfer' ? 'e.g. Move to savings' : 'e.g. Weekly groceries'} placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} />

          <Text style={[styles.fieldLabel, { color: colors.text }]}>Date</Text>
          <TextInput value={transactionDate} onChangeText={setTransactionDate} maxLength={10} keyboardType="numbers-and-punctuation" placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} />

          <Text style={[styles.fieldLabel, { color: colors.text }]}>Notes <Text style={{ color: colors.textMuted, fontWeight: '500' }}>(optional)</Text></Text>
          <TextInput value={notes} onChangeText={setNotes} maxLength={2000} multiline placeholder="Extra context for this record" placeholderTextColor={colors.textMuted} style={[styles.input, styles.notes, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} />

          {error ? <View style={[styles.errorBox, { backgroundColor: colors.surfaceMuted }]}><Ionicons name="alert-circle-outline" size={20} color={colors.negative} /><Text style={[styles.error, { color: colors.negative }]}>{error}</Text></View> : null}
          {!accounts.length ? <Card><Text style={[styles.helper, { color: colors.textMuted }]}>Create an account before recording a transaction.</Text></Card> : <><PrimaryButton label={editing ? 'Save correction' : `Save ${type.toLowerCase()}`} onPress={() => void save()} loading={saving} icon="checkmark-circle-outline" />{editing ? <Pressable disabled={saving} onPress={remove} style={({ pressed }) => [styles.deleteButton, { borderColor: colors.border, opacity: pressed ? 0.72 : 1 }]}><Ionicons name="trash-outline" size={18} color={colors.negative} /><Text style={[styles.deleteText, { color: colors.negative }]}>Reverse and remove</Text></Pressable> : null}</>}
        </>}
      </Screen>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }, eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginBottom: 4 }, title: { fontSize: 28, lineHeight: 34, fontWeight: '900', letterSpacing: -0.8 }, loading: { minHeight: 320, alignItems: 'center', justifyContent: 'center' },
  segment: { flexDirection: 'row', borderRadius: radius.md, padding: 4, marginBottom: spacing.lg }, segmentItem: { flex: 1, minHeight: 44, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }, segmentText: { fontSize: 13, fontWeight: '800' },
  fieldLabel: { fontSize: 14, fontWeight: '800', marginTop: spacing.md, marginBottom: spacing.sm }, amountField: { minHeight: 72, borderWidth: 1, borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md }, currency: { fontSize: 15, fontWeight: '900', marginRight: spacing.sm }, amountInput: { flex: 1, fontSize: 34, fontWeight: '900', letterSpacing: -1 },
  choiceList: { gap: spacing.sm }, choice: { minHeight: 62, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, radio: { width: 20, height: 20, borderWidth: 2, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, radioDot: { width: 10, height: 10, borderRadius: 5 }, choiceCopy: { flex: 1 }, choiceLabel: { fontSize: 15, fontWeight: '800' }, choiceDetail: { fontSize: 12, marginTop: 3 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, category: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, categoryText: { fontSize: 13, fontWeight: '700' },
  input: { minHeight: 54, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: 16 }, notes: { minHeight: 86, paddingTop: spacing.md, textAlignVertical: 'top' }, helper: { fontSize: 13, lineHeight: 20, textAlign: 'center' }, errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderRadius: radius.sm, padding: spacing.sm, marginVertical: spacing.md }, error: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '700' }, deleteButton: { minHeight: 50, borderWidth: 1, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.sm }, deleteText: { fontSize: 13, fontWeight: '900' },
})
