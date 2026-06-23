import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { TransactionCard } from "@/components/TransactionCard";
import { useListTransactions } from "@workspace/api-client-react";

export default function TransactionsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  const { data, isLoading, refetch, isRefetching } = useListTransactions(
    { query: { refetchInterval: 5000 } },
  );

  const transactions = data?.transactions ?? [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: topInset + 12,
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <Feather name="zap" size={20} color={colors.primary} />
          <Text style={[styles.title, { color: colors.foreground }]}>Action Log</Text>
          <View style={[styles.countBadge, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.countText, { color: colors.mutedForeground }]}>{transactions.length}</Text>
          </View>
        </View>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Review, approve, and manage file transactions
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : transactions.length === 0 ? (
        <View style={styles.center}>
          <Feather name="zap" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No actions yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
            Use the AI command bar on the Files tab to perform operations
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
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: (Platform.OS === "web" ? 84 : insets.bottom + 60) + 12,
          }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          ListHeaderComponent={
            <View style={[styles.legendRow]}>
              <View style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: colors.success }]} />
                <Text style={[styles.legendText, { color: colors.mutedForeground }]}>Completed</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: colors.warning }]} />
                <Text style={[styles.legendText, { color: colors.mutedForeground }]}>Pending</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: colors.danger }]} />
                <Text style={[styles.legendText, { color: colors.mutedForeground }]}>Rejected</Text>
              </View>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  countText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  subtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginLeft: 30,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  legendRow: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
});
