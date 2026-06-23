import { MaterialIcons } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator, FlatList, Platform, RefreshControl,
  StyleSheet, Text, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { TransactionCard } from "@/components/TransactionCard";
import { useListTransactions } from "@workspace/api-client-react";

export default function TransactionsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  const { data, isLoading, refetch, isRefetching } = useListTransactions({ query: { refetchInterval: 6000 } });
  const transactions = data?.transactions ?? [];

  const LEGEND = [
    { color: colors.success, label: "Completed" },
    { color: colors.primary, label: "Pending" },
    { color: colors.warning, label: "Previewed" },
    { color: colors.danger, label: "Rejected" },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topInset + 10, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerRow}>
          <View style={[styles.iconBox, { backgroundColor: colors.primary + "22" }]}>
            <MaterialIcons name="bolt" size={22} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>Action Log</Text>
          <View style={[styles.badge, { backgroundColor: colors.primary + "22" }]}>
            <Text style={[styles.badgeText, { color: colors.primary }]}>{transactions.length}</Text>
          </View>
        </View>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Review, approve, and track all file operations
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : transactions.length === 0 ? (
        <View style={styles.center}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.primary + "18" }]}>
            <MaterialIcons name="bolt" size={48} color={colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No actions yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
            Use the AI command bar on the Files tab to perform file operations
          </Text>
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TransactionCard
              id={item.id}
              command={item.command}
              actionsSummary={item.actionsSummary}
              status={item.status}
              createdAt={item.createdAt}
              actionsCount={item.actions.length}
            />
          )}
          ListHeaderComponent={
            <View style={styles.legendRow}>
              {LEGEND.map((l) => (
                <View key={l.label} style={styles.legendItem}>
                  <View style={[styles.dot, { backgroundColor: l.color }]} />
                  <Text style={[styles.legendText, { color: colors.mutedForeground }]}>{l.label}</Text>
                </View>
              ))}
            </View>
          }
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: (Platform.OS === "web" ? 84 : insets.bottom + 60) + 12 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 4 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBox: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontSize: 20, fontFamily: "Inter_700Bold" },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginLeft: 48 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 32 },
  emptyIcon: { width: 88, height: 88, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptySubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginBottom: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontFamily: "Inter_400Regular" },
});
