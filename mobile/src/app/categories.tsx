import { Ionicons } from '@expo/vector-icons'
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native'
import { Screen } from '@/components/screen'
import { Card, EmptyState, ErrorState, IconButton, LoadingState, PrimaryButton, SectionTitle } from '@/components/ui'
import { radius, spacing } from '@/constants/theme'
import { useAuth } from '@/context/auth-context'
import { useTheme } from '@/context/theme-context'
import { api } from '@/lib/api'
import type { Category } from '@/types/api'

export default function CategoriesScreen() {
  const { token } = useAuth()
  const { colors } = useTheme()
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryType, setCategoryType] = useState<'Expense' | 'Income'>('Expense')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true)
    try { setError(''); setCategories((await api<{ categories: Category[] }>('/api/finance/categories', { token })).categories) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load your categories.') }
    finally { setLoading(false); setRefreshing(false) }
  }, [token])
  useFocusEffect(useCallback(() => { void load() }, [load]))

  async function create() {
    const cleanName = name.trim().replace(/\s+/g, ' ')
    if (!cleanName || cleanName.length > 80) return setError('Enter a category name between 1 and 80 characters.')
    setSaving(true); setError('')
    try {
      await api('/api/finance/categories', { method: 'POST', token, body: JSON.stringify({ name: cleanName, categoryType }) })
      setName(''); await load()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not create this category.') }
    finally { setSaving(false) }
  }

  function remove(item: Category) {
    Alert.alert(`Delete ${item.name}?`, 'Only unused custom categories can be deleted. Financial history will never be removed.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => {
      try { await api(`/api/finance/categories/${item.id}`, { method: 'DELETE', token }); await load() }
      catch (reason) { Alert.alert('Category kept', reason instanceof Error ? reason.message : 'Could not delete this category.') }
    } }])
  }

  const expense = categories.filter((item) => item.category_type === 'Expense')
  const income = categories.filter((item) => item.category_type === 'Income')
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <Screen edges={['top', 'left', 'right', 'bottom']} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}>
      <View style={styles.header}><View style={styles.headerCopy}><Text style={[styles.eyebrow, { color: colors.primary }]}>CATEGORIES</Text><Text style={[styles.title, { color: colors.text }]}>Name the flow.</Text><Text style={[styles.intro, { color: colors.textMuted }]}>Custom categories make budgets, reports and insights more useful.</Text></View><IconButton icon="close" label="Close categories" onPress={() => router.back()} /></View>
      <Card><View style={[styles.segment, { backgroundColor: colors.surfaceMuted }]}>{(['Expense', 'Income'] as const).map((item) => <Pressable key={item} onPress={() => setCategoryType(item)} style={[styles.segmentItem, categoryType === item && { backgroundColor: colors.surface }]}><Ionicons name={item === 'Expense' ? 'arrow-up-outline' : 'arrow-down-outline'} size={17} color={categoryType === item ? colors.primary : colors.textMuted} /><Text style={[styles.segmentText, { color: categoryType === item ? colors.text : colors.textMuted }]}>{item}</Text></Pressable>)}</View><Text style={[styles.label, { color: colors.text }]}>New {categoryType.toLowerCase()} category</Text><TextInput value={name} onChangeText={setName} maxLength={80} placeholder={categoryType === 'Expense' ? 'e.g. Childcare' : 'e.g. Freelance'} placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]} />{error ? <View style={[styles.errorBox, { backgroundColor: colors.surfaceMuted }]}><Ionicons name="alert-circle-outline" size={19} color={colors.negative} /><Text style={[styles.errorText, { color: colors.negative }]}>{error}</Text></View> : null}<View style={styles.create}><PrimaryButton label="Add category" icon="add-circle-outline" loading={saving} onPress={() => void create()} /></View></Card>
      {loading ? <LoadingState /> : <><CategoryList title="Expense categories" items={expense} remove={remove} /><CategoryList title="Income categories" items={income} remove={remove} />{!categories.length ? <EmptyState icon="pricetags-outline" title="No categories" message="Add your first category above." /> : null}</>}
    </Screen>
  </KeyboardAvoidingView>
}

function CategoryList({ title, items, remove }: { title: string; items: Category[]; remove: (item: Category) => void }) {
  const { colors } = useTheme()
  if (!items.length) return null
  return <><SectionTitle detail={`${items.length}`}>{title}</SectionTitle><Card>{items.map((item, index) => <View key={item.id} style={[styles.categoryRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}><View style={[styles.categoryIcon, { backgroundColor: colors.surfaceMuted }]}><Ionicons name={item.category_type === 'Expense' ? 'arrow-up-outline' : 'arrow-down-outline'} size={17} color={item.category_type === 'Expense' ? colors.negative : colors.positive} /></View><Text style={[styles.categoryName, { color: colors.text }]}>{item.name}</Text>{item.is_default ? <Text style={[styles.defaultBadge, { color: colors.textMuted, backgroundColor: colors.surfaceMuted }]}>Default</Text> : <Pressable accessibilityLabel={`Delete ${item.name}`} hitSlop={10} onPress={() => remove(item)}><Ionicons name="trash-outline" size={19} color={colors.negative} /></Pressable>}</View>)}</Card></>
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.lg }, headerCopy: { flex: 1 }, eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginBottom: 5 }, title: { fontSize: 30, lineHeight: 36, fontWeight: '900', letterSpacing: -1 }, intro: { fontSize: 14, lineHeight: 21, marginTop: spacing.xs }, segment: { flexDirection: 'row', padding: 4, borderRadius: radius.md }, segmentItem: { flex: 1, minHeight: 42, borderRadius: 12, flexDirection: 'row', gap: spacing.xs, alignItems: 'center', justifyContent: 'center' }, segmentText: { fontSize: 13, fontWeight: '800' }, label: { fontSize: 13, fontWeight: '800', marginTop: spacing.md, marginBottom: spacing.sm }, input: { height: 52, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: 15 }, create: { marginTop: spacing.sm }, errorBox: { flexDirection: 'row', gap: spacing.xs, padding: spacing.sm, borderRadius: radius.sm, marginTop: spacing.sm }, errorText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '700' }, categoryRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, categoryIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, categoryName: { flex: 1, fontSize: 14, fontWeight: '800' }, defaultBadge: { fontSize: 10, fontWeight: '800', paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: radius.pill },
})
