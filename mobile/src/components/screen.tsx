import { PropsWithChildren } from 'react'
import { ScrollView, ScrollViewProps, StyleSheet, View } from 'react-native'
import { Edge, SafeAreaView } from 'react-native-safe-area-context'
import { spacing } from '@/constants/theme'
import { useTheme } from '@/context/theme-context'

type Props = PropsWithChildren<ScrollViewProps & { scroll?: boolean; edges?: Edge[] }>

export function Screen({ children, scroll = true, edges = ['top', 'left', 'right'], contentContainerStyle, ...props }: Props) {
  const { colors } = useTheme()
  if (!scroll) {
    return <SafeAreaView edges={edges} style={[styles.safe, { backgroundColor: colors.background }]}><View style={styles.content}>{children}</View></SafeAreaView>
  }
  return (
    <SafeAreaView edges={edges} style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.content, contentContainerStyle]} showsVerticalScrollIndicator={false} {...props}>
        {children}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({ safe: { flex: 1 }, content: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xxl } })
