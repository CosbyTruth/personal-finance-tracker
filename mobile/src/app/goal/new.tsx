import { Ionicons } from '@expo/vector-icons'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useState } from 'react'
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Screen } from '@/components/screen'
import { Card, IconButton, PrimaryButton, SectionTitle } from '@/components/ui'
import { radius, spacing } from '@/constants/theme'
import { useAuth } from '@/context/auth-context'
import { useTheme } from '@/context/theme-context'
import { api } from '@/lib/api'
import type { Goal, GoalsResponse } from '@/types/api'

const GOAL_TYPES = ['Emergency Fund', 'Purchase', 'Travel', 'Business', 'Investment', 'Education', 'Other']
const CURRENCIES = ['GHS', 'USD', 'EUR', 'GBP']
const PRIORITIES = ['Low', 'Medium', 'High'] as const

export default function NewGoalScreen() {
  const params = useLocalSearchParams<{ id?: string }>()
  const { token } = useAuth()
  const { colors } = useTheme()
  const editing = Boolean(params.id)
  const [goal, setGoal] = useState<Goal | null>(null)
  const [name, setName] = useState('')
  const [goalType, setGoalType] = useState('Emergency Fund')
  const [currency, setCurrency] = useState('GHS')
  const [targetAmount, setTargetAmount] = useState('')
  const [startingAmount, setStartingAmount] = useState('0')
  const [targetDate, setTargetDate] = useState('')
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High'>('Medium')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(editing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useFocusEffect(useCallback(() => {
    if (!editing) return
    setLoading(true)
    api<GoalsResponse>('/api/finance/goals?includeArchived=true', { token }).then((data) => {
      const found = data.goals.find((item) => String(item.id) === String(params.id))
      if (!found) throw new Error('This savings goal could not be found.')
      setGoal(found); setName(found.name); setGoalType(found.goal_type); setCurrency(found.currency); setTargetAmount(found.target_amount); setStartingAmount(found.starting_amount); setTargetDate(found.target_date ? String(found.target_date).slice(0, 10) : ''); setPriority(found.priority); setNotes((found as Goal & { notes?: string }).notes || '')
    }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not prepare this goal.')).finally(() => setLoading(false))
  }, [editing, params.id, token]))

  async function save() {
    const cleanName = name.trim().replace(/\s+/g, ' ')
    const cleanTarget = targetAmount.trim().replace(',', '.')
    const cleanStarting = startingAmount.trim().replace(',', '.') || '0'
    if (!cleanName || cleanName.length > 120) return setError('Enter a goal name between 1 and 120 characters.')
    if (!/^\d{1,15}(\.\d{1,2})?$/.test(cleanTarget) || Number(cleanTarget) <= 0) return setError('Enter a target amount greater than zero.')
    if (!/^\d{1,15}(\.\d{1,2})?$/.test(cleanStarting)) return setError('Enter a valid starting amount of zero or more.')
    if (targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) return setError('Enter the target date as YYYY-MM-DD, or leave it empty.')

    setSaving(true)
    setError('')
    try {
      await api<{ goal: Goal }>(editing ? `/api/finance/goals/${params.id}` : '/api/finance/goals', {
        method: editing ? 'PUT' : 'POST', token,
        body: JSON.stringify({ name: cleanName, goalType, currency, targetAmount: cleanTarget, startingAmount: cleanStarting, targetDate: targetDate || null, priority, notes: notes.trim() }),
      })
      Alert.alert(editing ? 'Goal updated' : 'Goal created', editing ? `${cleanName} is up to date.` : `${cleanName} is ready for your first contribution.`, [{ text: 'Done', onPress: () => router.back() }])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create this goal.')
    } finally { setSaving(false) }
  }

  function changeArchiveState() {
    if (!goal) return
    const restoring = goal.is_archived
    Alert.alert(restoring ? `Restore ${goal.name}?` : `Archive ${goal.name}?`, restoring ? 'You can add progress entries again.' : 'Its progress history will remain available.', [{ text: 'Cancel', style: 'cancel' }, { text: restoring ? 'Restore' : 'Archive', style: restoring ? 'default' : 'destructive', onPress: async () => {
      try { await api(`/api/finance/goals/${goal.id}/${restoring ? 'restore' : 'archive'}`, { method: 'POST', token }); router.back() }
      catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update this goal.') }
    } }])
  }

  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <Screen edges={['top', 'left', 'right', 'bottom']} keyboardShouldPersistTaps="handled">
      <View style={styles.header}><View><Text style={[styles.eyebrow, { color: colors.primary }]}>{editing ? 'EDIT SAVINGS GOAL' : 'NEW SAVINGS GOAL'}</Text><Text style={[styles.title, { color: colors.text }]}>{editing ? 'Refine the destination' : 'Name the destination'}</Text></View><IconButton icon="close" label="Close" onPress={() => router.back()} /></View>
      <Text style={[styles.intro, { color: colors.textMuted }]}>Define what you are building toward and make the progress visible.</Text>

      {loading ? <View style={styles.loading}><ActivityIndicator size="large" color={colors.primary} /></View> : <>

      <Text style={[styles.label, { color: colors.text }]}>Goal name</Text><TextInput value={name} onChangeText={setName} maxLength={120} placeholder="e.g. Emergency fund" placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} />
      <Text style={[styles.label, { color: colors.text }]}>Goal type</Text><View style={styles.chips}>{GOAL_TYPES.map((item) => <Pressable key={item} onPress={() => setGoalType(item)} style={[styles.chip, { backgroundColor: goalType === item ? colors.primarySoft : colors.surface, borderColor: goalType === item ? colors.primary : colors.border }]}><Text style={[styles.chipText, { color: colors.text }]}>{item}</Text></Pressable>)}</View>
      <Text style={[styles.label, { color: colors.text }]}>Target amount</Text><View style={[styles.amountField, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.currency, { color: colors.primary }]}>{currency}</Text><TextInput value={targetAmount} onChangeText={setTargetAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.textMuted} style={[styles.amountInput, { color: colors.text }]} /></View>
      <Text style={[styles.label, { color: colors.text }]}>Currency</Text><View style={styles.chips}>{Array.from(new Set([...CURRENCIES, currency])).map((item) => <Pressable key={item} onPress={() => setCurrency(item)} style={[styles.chip, { backgroundColor: currency === item ? colors.primarySoft : colors.surface, borderColor: currency === item ? colors.primary : colors.border }]}><Text style={[styles.chipText, { color: colors.text }]}>{item}</Text></Pressable>)}</View>
      <Text style={[styles.label, { color: colors.text }]}>Already saved</Text><TextInput value={startingAmount} onChangeText={setStartingAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} />
      <Text style={[styles.label, { color: colors.text }]}>Target date <Text style={{ color: colors.textMuted, fontWeight: '500' }}>(optional)</Text></Text><TextInput value={targetDate} onChangeText={setTargetDate} maxLength={10} keyboardType="numbers-and-punctuation" placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} />
      <Text style={[styles.label, { color: colors.text }]}>Priority</Text><View style={[styles.segment, { backgroundColor: colors.surfaceMuted }]}>{PRIORITIES.map((item) => <Pressable key={item} onPress={() => setPriority(item)} style={[styles.segmentItem, priority === item && { backgroundColor: colors.surface }]}><Text style={[styles.segmentText, { color: priority === item ? colors.text : colors.textMuted }]}>{item}</Text></Pressable>)}</View>
      <Text style={[styles.label, { color: colors.text }]}>Notes <Text style={{ color: colors.textMuted, fontWeight: '500' }}>(optional)</Text></Text><TextInput value={notes} onChangeText={setNotes} maxLength={2000} multiline placeholder="Why this goal matters" placeholderTextColor={colors.textMuted} style={[styles.input, styles.notes, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} />
      {error ? <View style={[styles.errorBox, { backgroundColor: colors.surfaceMuted }]}><Ionicons name="alert-circle-outline" size={20} color={colors.negative} /><Text style={[styles.error, { color: colors.negative }]}>{error}</Text></View> : null}
      <View style={styles.save}><PrimaryButton label={editing ? 'Save goal' : 'Create savings goal'} onPress={() => void save()} loading={saving} icon="flag-outline" /></View>
      {editing && goal ? <><Pressable onPress={changeArchiveState} style={({ pressed }) => [styles.archive, { borderColor: colors.border, opacity: pressed ? 0.72 : 1 }]}><Ionicons name={goal.is_archived ? 'refresh-outline' : 'archive-outline'} size={19} color={goal.is_archived ? colors.primary : colors.negative} /><Text style={[styles.archiveText, { color: goal.is_archived ? colors.primary : colors.negative }]}>{goal.is_archived ? 'Restore goal' : 'Archive goal'}</Text></Pressable>{goal.entries.length ? <><SectionTitle detail={`${goal.entries.length}`}>Progress history</SectionTitle><Card>{goal.entries.slice().reverse().map((entry, index) => <Pressable key={entry.id} onPress={() => router.push({ pathname: '/goal/entry', params: { id: String(goal.id), entryId: String(entry.id), name: goal.name, currency: goal.currency, mode: entry.entry_type, amount: entry.amount, date: String(entry.contribution_date).slice(0, 10), notes: entry.notes || '' } })} style={[styles.entryRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}><View style={[styles.entryIcon, { backgroundColor: colors.surfaceMuted }]}><Ionicons name={entry.entry_type === 'Contribution' ? 'add-outline' : 'remove-outline'} size={17} color={entry.entry_type === 'Contribution' ? colors.positive : colors.negative} /></View><View style={styles.entryCopy}><Text style={[styles.entryType, { color: colors.text }]}>{entry.entry_type}</Text><Text style={[styles.entryDate, { color: colors.textMuted }]}>{String(entry.contribution_date).slice(0, 10)}</Text></View><Text style={[styles.entryAmount, { color: entry.entry_type === 'Contribution' ? colors.positive : colors.negative }]}>{entry.entry_type === 'Contribution' ? '+' : '−'}{goal.currency} {Number(entry.amount).toFixed(2)}</Text><Ionicons name="chevron-forward" size={17} color={colors.textMuted} /></Pressable>)}</Card></> : null}</> : null}
      </>}
    </Screen>
  </KeyboardAvoidingView>
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginBottom: 4 }, title: { fontSize: 28, lineHeight: 34, fontWeight: '900', letterSpacing: -0.8 }, intro: { fontSize: 15, lineHeight: 22, marginTop: spacing.sm, marginBottom: spacing.md }, label: { fontSize: 14, fontWeight: '800', marginTop: spacing.md, marginBottom: spacing.sm }, input: { minHeight: 54, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: 16 }, notes: { minHeight: 90, paddingTop: spacing.md, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, chip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, chipText: { fontSize: 13, fontWeight: '700' }, amountField: { minHeight: 72, borderWidth: 1, borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md }, currency: { fontSize: 15, fontWeight: '900', marginRight: spacing.sm }, amountInput: { flex: 1, fontSize: 34, fontWeight: '900', letterSpacing: -1 },
  loading: { minHeight: 320, alignItems: 'center', justifyContent: 'center' }, segment: { flexDirection: 'row', padding: 4, borderRadius: radius.md }, segmentItem: { flex: 1, minHeight: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, segmentText: { fontSize: 13, fontWeight: '800' }, errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderRadius: radius.sm, padding: spacing.sm, marginTop: spacing.md }, error: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '700' }, save: { marginTop: spacing.lg }, archive: { minHeight: 50, borderWidth: 1, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.sm }, archiveText: { fontSize: 13, fontWeight: '900' }, entryRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, entryIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, entryCopy: { flex: 1 }, entryType: { fontSize: 13, fontWeight: '800' }, entryDate: { fontSize: 11, marginTop: 2 }, entryAmount: { maxWidth: '36%', fontSize: 12, fontWeight: '900' },
})
