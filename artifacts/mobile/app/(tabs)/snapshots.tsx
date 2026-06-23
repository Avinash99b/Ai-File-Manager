import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator, Alert, FlatList, Platform,
  RefreshControl, StyleSheet, Text, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { SnapshotCard } from "@/components/SnapshotCard";
import { useListSnapshots, useRestoreSnapshot } from "@workspace/api-client-react";

export default function SnapshotsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const topInset = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  const { data, isLoading, refetch, isRefetching } = useListSnapshots({ query: { refetchInterval: 10000 } });

  const restoreMutation = useRestoreSnapshot({
    mutation: {
      onSuccess: (result) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Restored", `${result.filesRestored} file(s) restored successfully`);
        queryClient.invalidateQueries({ queryKey: ["/api/files/list"] });
      },
      onError: () => Alert.alert("Error", "Failed to restore snapshot"),
    },
  });

  const snapshots = data?.snapshots ?? [];
  const totalMb = snapshots.reduce((sum, s) => sum + s.sizeMb, 0);

  const handleRestore = (id: string) =>
    Alert.alert(
      "Restore Snapshot",
      "This will overwrite the affected files with the snapshot versions. A new snapshot will be created first.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Restore", style: "destructive", onPress: () => restoreMutation.mutate({ id }) },
      ],
    );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topInset + 10, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerRow}>
          <View style={[styles.iconBox, { backgroundColor: colors.secondary + "22" }]}>
            <MaterialIcons name="backup" size={22} color={colors.secondary} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>Snapshots</Text>
          <View style={[styles.badge, { backgroundColor: colors.secondary + "22" }]}>
            <Text style={[styles.badgeText, { color: colors.secondary }]}>{snapshots.length}</Text>
          </View>
        </View>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Auto-created before every approved transaction
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.secondary} size="large" />
        </View>
      ) : snapshots.length === 0 ? (
        <View style={styles.center}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.secondary + "18" }]}>
            <MaterialIcons name="backup" size={48} color={colors.secondary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No snapshots yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
            Snapshots are created automatically when you approve a transaction
          </Text>
          <View style={[styles.infoBox, { backgroundColor: colors.surface, borderColor: colors.secondary + "33" }]}>
            <MaterialIcons name="security" size={16} color={colors.secondary} />
            <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
              Every snapshot preserves affected files before changes, allowing one-click rollback
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
          ListHeaderComponent={
            <View style={[styles.storageRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <MaterialIcons name="storage" size={15} color={colors.mutedForeground} />
              <Text style={[styles.storageText, { color: colors.mutedForeground }]}>
                {snapshots.length} snapshot{snapshots.length !== 1 ? "s" : ""} · {totalMb.toFixed(1)} MB local
              </Text>
              <View style={[styles.driveTag, { backgroundColor: colors.surfaceElevated }]}>
                <MaterialIcons name="cloud-off" size={12} color={colors.mutedForeground} />
                <Text style={[styles.driveTagText, { color: colors.mutedForeground }]}>Drive sync off</Text>
              </View>
            </View>
          }
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: (Platform.OS === "web" ? 84 : insets.bottom + 60) + 12 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.secondary} />}
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
  infoBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, maxWidth: 300 },
  infoText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  storageRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, borderWidth: 1, marginBottom: 12 },
  storageText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular" },
  driveTag: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5 },
  driveTagText: { fontSize: 10, fontFamily: "Inter_500Medium" },
});
