import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Platform,
  Alert,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { SnapshotCard } from "@/components/SnapshotCard";
import { useListSnapshots, useRestoreSnapshot } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export default function SnapshotsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const topInset = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  const { data, isLoading, refetch, isRefetching } = useListSnapshots(
    { query: { refetchInterval: 10000 } },
  );

  const restoreMutation = useRestoreSnapshot({
    mutation: {
      onSuccess: (result, variables) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Restored", `${result.filesRestored} file(s) restored successfully`);
        queryClient.invalidateQueries({ queryKey: ["/api/files/list"] });
      },
      onError: () => {
        Alert.alert("Error", "Failed to restore snapshot");
      },
    },
  });

  const snapshots = data?.snapshots ?? [];

  const handleRestore = (id: string) => {
    Alert.alert(
      "Restore Snapshot",
      "This will overwrite the affected files with the snapshot versions. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore",
          style: "destructive",
          onPress: () => restoreMutation.mutate({ id }),
        },
      ],
    );
  };

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
          <Feather name="archive" size={20} color={colors.primary} />
          <Text style={[styles.title, { color: colors.foreground }]}>Snapshots</Text>
          <View style={[styles.countBadge, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.countText, { color: colors.mutedForeground }]}>{snapshots.length}</Text>
          </View>
        </View>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Auto-created before each approved transaction
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : snapshots.length === 0 ? (
        <View style={styles.center}>
          <Feather name="archive" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No snapshots yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
            Snapshots are automatically created when you approve a transaction
          </Text>
          <View style={[styles.infoBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="shield" size={15} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
              Each snapshot preserves affected files before changes, allowing one-click rollback
            </Text>
          </View>
        </View>
      ) : (
        <FlatList
          data={snapshots}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <SnapshotCard
              id={item.id}
              timestamp={item.timestamp}
              transactionId={item.transactionId}
              affectedFiles={item.affectedFiles}
              location={item.location}
              sizeMb={item.sizeMb}
              restorable={item.restorable}
              onRestore={() => handleRestore(item.id)}
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
            <View style={[styles.storageRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="hard-drive" size={14} color={colors.mutedForeground} />
              <Text style={[styles.storageText, { color: colors.mutedForeground }]}>
                {snapshots.length} local snapshot{snapshots.length !== 1 ? "s" : ""} · Google Drive sync ready
              </Text>
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
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    maxWidth: 300,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  storageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  storageText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
});
