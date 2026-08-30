import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Screen } from '@/components/screen'
import { IconButton, PrimaryButton } from '@/components/ui'
import { radius, spacing } from '@/constants/theme'
import { useAuth } from '@/context/auth-context'
import { useTheme } from '@/context/theme-context'
import { api } from '@/lib/api'
import type { Goal } from '@/types/api'

type EntryType = 'Contribution' | 'Withdrawal'

export default function GoalEntryScreen() {
  const params = useLocalSearchParams<{ id: string; entryId?: string; name?: string; currency?: string; mode?: EntryType; amount?: string; date?: string; notes?: string }>()
  const { token } = useAuth()
  const { colors } = useTheme()
  const [entryType, setEntryType] = useState<EntryType>(params.mode === 'Withdrawal' ? 'Withdrawal' : 'Contribution')
  const editing = Boolean(params.entryId)
  const [amount, setAmount] = useState(params.amount || '')
  const [date, setDate] = useState(params.date || new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState(params.notes || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const currency = params.currency || 'GHS'

  async function save() {
    const cleanAmount = amount.trim().replace(',', '.')
    if (!/^\d{1,15}(\.\d{1,2})?$/.test(cleanAmount) || Number(cleanAmount) <= 0) return setError('Enter an amount greater than zero with no more than two decimal places.')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError('Enter the date as YYYY-MM-DD.')
    setSaving(true); setError('')
    try {
      await api<{ goal: Goal }>(editing ? `/api/finance/goals/${params.id}/entries/${params.entryId}` : `/api/finance/goals/${params.id}/entries`, { method: editing ? 'PUT' : 'POST', token, body: JSON.stringify({ entryType, amount: cleanAmount, contributionDate: date, notes: notes.trim() }) })
      Alert.alert(editing ? 'Progress entry updated' : 'Progress updated', entryType === 'Contribution' ? 'Your goal progress is up to date.' : 'The withdrawal was recorded.', [{ text: 'Done', onPress: () => router.back() }])
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update this goal.') }
    finally { setSaving(false) }
  }

  function remove() {
    Alert.alert('Delete this progress entry?', 'Kora will keep the goal allocation from going below zero.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete entry', style: 'destructive', onPress: async () => {
      setSaving(true); setError('')
      try { await api(`/api/finance/goals/${params.id}/entries/${params.entryId}`, { method: 'DELETE', token }); router.back() }
      catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not delete this progress entry.') }
      finally { setSaving(false) }
    } }])
  }

  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <Screen edges={['top', 'left', 'right', 'bottom']} keyboardShouldPersistTaps="handled">
      <View style={styles.header}><View style={styles.headerCopy}><Text style={[styles.eyebrow, { color: colors.primary }]}>{editing ? 'EDIT GOAL PROGRESS' : 'GOAL PROGRESS'}</Text><Text numberOfLines={2} style={[styles.title, { color: colors.text }]}>{params.name || 'Savings goal'}</Text></View><IconButton icon="close" label="Close" onPress={() => router.back()} /></View>
      <View style={[styles.segment, { backgroundColor: colors.surfaceMuted }]}>{(['Contribution', 'Withdrawal'] as EntryType[]).map((item) => <Pressable key={item} onPress={() => { setEntryType(item); setError('') }} style={[styles.segmentItem, entryType === item && { backgroundColor: colors.surface }]}><Ionicons name={item === 'Contribution' ? 'add-circle-outline' : 'remove-circle-outline'} size={18} color={entryType === item ? colors.primary : colors.textMuted} /><Text style={[styles.segmentText, { color: entryType === item ? colors.text : colors.textMuted }]}>{item}</Text></Pressable>)}</View>
      <Text style={[styles.label, { color: colors.text }]}>{entryType === 'Contribution' ? 'Amount added' : 'Amount withdrawn'}</Text><View style={[styles.amountField, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.currency, { color: colors.primary }]}>{currency}</Text><TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.textMuted} style={[styles.amountInput, { color: colors.text }]} /></View>
      <Text style={[styles.label, { color: colors.text }]}>Date</Text><TextInput value={date} onChangeText={setDate} maxLength={10} keyboardType="numbers-and-punctuation" placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} />
      <Text style={[styles.label, { color: colors.text }]}>Note <Text style={{ color: colors.textMuted, fontWeight: '500' }}>(optional)</Text></Text><TextInput value={notes} onChangeText={setNotes} maxLength={300} placeholder="e.g. Monthly savings" placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} />
      <View style={[styles.info, { backgroundColor: colors.primarySoft }]}><Ionicons name="information-circle-outline" size={20} color={colors.primary} /><Text style={[styles.infoText, { color: colors.text }]}>Goal progress is a planning allocation. It does not change any account balance or create a cash transaction.</Text></View>
      {error ? <View style={[styles.errorBox, { backgroundColor: colors.surfaceMuted }]}><Ionicons name="alert-circle-outline" size={20} color={colors.negative} /><Text style={[styles.error, { color: colors.negative }]}>{error}</Text></View> : null}
      <View style={styles.save}><PrimaryButton label={editing ? 'Save progress entry' : entryType === 'Contribution' ? 'Add to goal' : 'Record withdrawal'} onPress={() => void save()} loading={saving} icon={entryType === 'Contribution' ? 'add-circle-outline' : 'remove-circle-outline'} /></View>
      {editing ? <Pressable disabled={saving} onPress={remove} style={({ pressed }) => [styles.deleteButton, { borderColor: colors.border, opacity: pressed ? 0.72 : 1 }]}><Ionicons name="trash-outline" size={18} color={colors.negative} /><Text style={[styles.deleteText, { color: colors.negative }]}>Delete progress entry</Text></Pressable> : null}
    </Screen>
  </KeyboardAvoidingView>
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.xl }, headerCopy: { flex: 1 }, eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginBottom: 4 }, title: { fontSize: 28, lineHeight: 34, fontWeight: '900', letterSpacing: -0.8 }, segment: { flexDirection: 'row', borderRadius: radius.md, padding: 4 }, segmentItem: { flex: 1, minHeight: 46, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs }, segmentText: { fontSize: 13, fontWeight: '800' },
  label: { fontSize: 14, fontWeight: '800', marginTop: spacing.lg, marginBottom: spacing.sm }, amountField: { minHeight: 76, borderWidth: 1, borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md }, currency: { fontSize: 15, fontWeight: '900', marginRight: spacing.sm }, amountInput: { flex: 1, fontSize: 36, fontWeight: '900', letterSpacing: -1 }, input: { minHeight: 54, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: 16 },
  info: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.lg }, infoText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '600' }, errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderRadius: radius.sm, padding: spacing.sm, marginTop: spacing.md }, error: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '700' }, save: { marginTop: spacing.lg }, deleteButton: { minHeight: 50, borderWidth: 1, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.sm }, deleteText: { fontSize: 13, fontWeight: '900' },
})
