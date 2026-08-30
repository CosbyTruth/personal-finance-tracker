import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Screen } from '@/components/screen'
import { IconButton, PrimaryButton } from '@/components/ui'
import { radius, spacing } from '@/constants/theme'
import { useAuth } from '@/context/auth-context'
import { useTheme } from '@/context/theme-context'
import { api, currentMonth } from '@/lib/api'
import type { Budget, BudgetResponse, Category } from '@/types/api'

const CURRENCIES = ['GHS', 'USD', 'EUR', 'GBP']

export default function BudgetEditorScreen() {
  const params = useLocalSearchParams<{ id?: string; month?: string; currency?: string }>()
  const { token } = useAuth()
  const { colors } = useTheme()
  const editing = Boolean(params.id)
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState('')
  const [month, setMonth] = useState(String(params.month || currentMonth()).slice(0, 7))
  const [currency, setCurrency] = useState(String(params.currency || 'GHS').toUpperCase())
  const [customCurrency, setCustomCurrency] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const currencyChoice = CURRENCIES.includes(currency) ? currency : 'OTHER'
  const finalCurrency = currencyChoice === 'OTHER' ? customCurrency.trim().toUpperCase() || currency : currency

  useEffect(() => {
    const categoryRequest = api<{ categories: Category[] }>('/api/finance/categories', { token })
    const budgetRequest = editing
      ? api<BudgetResponse>(`/api/finance/budgets?month=${encodeURIComponent(String(params.month || currentMonth()))}&currency=${encodeURIComponent(String(params.currency || 'GHS'))}`, { token })
      : Promise.resolve(null)
    Promise.all([categoryRequest, budgetRequest]).then(([categoryData, budgetData]) => {
      setCategories(categoryData.categories.filter((item) => item.category_type === 'Expense'))
      if (budgetData) {
        const budget = budgetData.budgets.find((item) => String(item.id) === String(params.id))
        if (!budget) throw new Error('This budget could not be found.')
        setCategoryId(String(budget.category_id))
        setAmount(budget.amount)
        setMonth(String(budget.budget_month).slice(0, 7))
        setCurrency(budget.currency)
        if (!CURRENCIES.includes(budget.currency)) setCustomCurrency(budget.currency)
      }
    }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not prepare the budget form.')).finally(() => setLoading(false))
  }, [editing, params.currency, params.id, params.month, token])

  function chooseCurrency(next: string) {
    setCurrency(next === 'OTHER' ? '' : next)
    if (next !== 'OTHER') setCustomCurrency('')
  }

  async function save() {
    const normalizedAmount = amount.trim().replace(',', '.')
    if (!categoryId) return setError('Choose the expense category this budget controls.')
    if (!/^\d{1,15}(\.\d{1,2})?$/.test(normalizedAmount) || Number(normalizedAmount) <= 0) return setError('Enter a budget amount greater than zero with no more than two decimal places.')
    if (!/^\d{4}-\d{2}$/.test(month)) return setError('Enter the budget month as YYYY-MM.')
    if (!/^[A-Z]{3}$/.test(finalCurrency)) return setError('Enter a valid three-letter currency code.')

    setSaving(true)
    setError('')
    try {
      const path = editing ? `/api/finance/budgets/${params.id}` : '/api/finance/budgets'
      await api<{ budget: Budget }>(path, {
        method: editing ? 'PUT' : 'POST',
        token,
        body: JSON.stringify({ categoryId, amount: normalizedAmount, budgetMonth: month, currency: finalCurrency }),
      })
      Alert.alert(editing ? 'Budget updated' : 'Budget created', 'Your monthly plan is ready.', [{ text: 'Done', onPress: () => router.back() }])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save this budget.')
    } finally {
      setSaving(false)
    }
  }

  function remove() {
    Alert.alert('Delete this budget?', 'This removes the spending plan only. Transactions and ledger history remain untouched.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete budget', style: 'destructive', onPress: async () => {
      setSaving(true); setError('')
      try { await api(`/api/finance/budgets/${params.id}`, { method: 'DELETE', token }); router.back() }
      catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not delete this budget.') }
      finally { setSaving(false) }
    } }])
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={['top', 'left', 'right', 'bottom']} keyboardShouldPersistTaps="handled">
        <View style={styles.header}><View><Text style={[styles.eyebrow, { color: colors.primary }]}>{editing ? 'EDIT BUDGET' : 'NEW BUDGET'}</Text><Text style={[styles.title, { color: colors.text }]}>{editing ? 'Adjust the plan' : 'Plan a category'}</Text></View><IconButton icon="close" label="Close" onPress={() => router.back()} /></View>
        <Text style={[styles.intro, { color: colors.textMuted }]}>Give one expense category a clear spending limit for a specific month.</Text>
        {loading ? <View style={styles.loading}><ActivityIndicator size="large" color={colors.primary} /></View> : <>
          <Text style={[styles.fieldLabel, { color: colors.text }]}>Expense category</Text>
          <View style={styles.categoryGrid}>{categories.map((category) => <Pressable key={category.id} onPress={() => setCategoryId(String(category.id))} style={[styles.category, { backgroundColor: categoryId === String(category.id) ? colors.primarySoft : colors.surface, borderColor: categoryId === String(category.id) ? colors.primary : colors.border }]}><Text style={[styles.categoryText, { color: colors.text }]}>{category.name}</Text></Pressable>)}</View>
          {!categories.length ? <Text style={[styles.helper, { color: colors.warning }]}>Create an expense category on the web app before adding a budget.</Text> : null}

          <Text style={[styles.fieldLabel, { color: colors.text }]}>Monthly limit</Text>
          <View style={[styles.amountField, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.amountCurrency, { color: colors.primary }]}>{finalCurrency || '—'}</Text><TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.textMuted} style={[styles.amountInput, { color: colors.text }]} /></View>

          <Text style={[styles.fieldLabel, { color: colors.text }]}>Month</Text>
          <TextInput value={month} onChangeText={setMonth} maxLength={7} keyboardType="numbers-and-punctuation" placeholder="YYYY-MM" placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} />

          <Text style={[styles.fieldLabel, { color: colors.text }]}>Currency</Text>
          <View style={styles.currencyRow}>{[...CURRENCIES, 'OTHER'].map((item) => <Pressable key={item} onPress={() => chooseCurrency(item)} style={[styles.currencyChip, { backgroundColor: currencyChoice === item ? colors.primarySoft : colors.surface, borderColor: currencyChoice === item ? colors.primary : colors.border }]}><Text style={[styles.currencyText, { color: colors.text }]}>{item === 'OTHER' ? 'Other' : item}</Text></Pressable>)}</View>
          {currencyChoice === 'OTHER' ? <TextInput autoCapitalize="characters" value={customCurrency} onChangeText={(value) => { const next = value.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase(); setCustomCurrency(next); setCurrency(next) }} maxLength={3} placeholder="Three-letter code" placeholderTextColor={colors.textMuted} style={[styles.input, styles.customCurrency, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} /> : null}

          {error ? <View style={[styles.errorBox, { backgroundColor: colors.surfaceMuted }]}><Ionicons name="alert-circle-outline" size={20} color={colors.negative} /><Text style={[styles.error, { color: colors.negative }]}>{error}</Text></View> : null}
          <View style={styles.save}><PrimaryButton label={editing ? 'Save changes' : 'Create budget'} onPress={() => void save()} loading={saving} icon="checkmark-circle-outline" /></View>
          {editing ? <Pressable disabled={saving} onPress={remove} style={({ pressed }) => [styles.deleteButton, { borderColor: colors.border, opacity: pressed ? 0.72 : 1 }]}><Ionicons name="trash-outline" size={18} color={colors.negative} /><Text style={[styles.deleteText, { color: colors.negative }]}>Delete budget</Text></Pressable> : null}
        </>}
      </Screen>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginBottom: 4 }, title: { fontSize: 28, lineHeight: 34, fontWeight: '900', letterSpacing: -0.8 }, intro: { fontSize: 15, lineHeight: 22, marginTop: spacing.sm, marginBottom: spacing.md }, loading: { minHeight: 300, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { fontSize: 14, fontWeight: '800', marginTop: spacing.md, marginBottom: spacing.sm }, categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, category: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, categoryText: { fontSize: 13, fontWeight: '700' },
  amountField: { minHeight: 72, borderWidth: 1, borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md }, amountCurrency: { fontSize: 15, fontWeight: '900', marginRight: spacing.sm }, amountInput: { flex: 1, fontSize: 34, fontWeight: '900', letterSpacing: -1 }, input: { minHeight: 54, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: 16 },
  currencyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, currencyChip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, currencyText: { fontSize: 13, fontWeight: '800' }, customCurrency: { marginTop: spacing.sm, textTransform: 'uppercase' }, helper: { fontSize: 13, lineHeight: 20 },
  errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderRadius: radius.sm, padding: spacing.sm, marginTop: spacing.md }, error: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '700' }, save: { marginTop: spacing.lg }, deleteButton: { minHeight: 50, borderWidth: 1, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.sm }, deleteText: { fontSize: 13, fontWeight: '900' },
})
