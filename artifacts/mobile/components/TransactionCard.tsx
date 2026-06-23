import { MaterialIcons } from "@expo/vector-icons";
import React, { useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useQueryClient } from "@tanstack/react-query";
import { getListTransactionsQueryKey } from "@workspace/api-client-react";

interface TransactionCardProps {
  id: string;
  command: string;
  actionsSummary: string;
  status: string;
  createdAt: string;
  actionsCount: number;
  /** Present when the transaction has been committed — enables the Revert button */
  snapshotId?: string;
  onPress?: () => void;
}

type MIcon = React.ComponentProps<typeof MaterialIcons>["name"];

interface StatusConfig { color: string; icon: MIcon; label: string }

function useStatusConfig(status: string, colors: ReturnType<typeof useColors>): StatusConfig {
  const map: Record<string, StatusConfig> = {
    completed: { color: colors.success, icon: "check-circle", label: "COMPLETED" },
    pending: { color: colors.primary, icon: "schedule", label: "PENDING" },
    previewed: { color: colors.warning, icon: "visibility", label: "PREVIEWED" },
    approved: { color: colors.success, icon: "check", label: "APPROVED" },
    rejected: { color: colors.danger, icon: "cancel", label: "REJECTED" },
    failed: { color: colors.danger, icon: "error", label: "FAILED" },
    reverted: { color: colors.mutedForeground, icon: "history", label: "REVERTED" },
  };
  return map[status] ?? { color: colors.mutedForeground, icon: "circle", label: status.toUpperCase() };
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function TransactionCard({
  id, command, actionsSummary, status, createdAt, actionsCount, snapshotId, onPress,
}: TransactionCardProps) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const sc = useStatusConfig(status, colors);
  const [reverting, setReverting] = useState(false);

  /** Restore files from the linked snapshot and mark the transaction as reverted */
  const handleRevert = () => {
    Alert.alert(
      "Undo Transaction",
      `Restore the files affected by "${command}" from the saved snapshot?\n\nThis cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Revert",
          style: "destructive",
          onPress: async () => {
            setReverting(true);
            try {
              const res = await fetch(`/api/transactions/${id}/revert`, { method: "POST" });
              const body = await res.json() as { status?: string; filesRestored?: number; error?: string };
              if (!res.ok) throw new Error(body.error ?? "Revert failed");
              Alert.alert(
                "Reverted",
                `${body.filesRestored ?? 0} file${(body.filesRestored ?? 0) !== 1 ? "s" : ""} restored from snapshot.`,
              );
              // Refresh the transaction list so the status updates immediately
              await queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
            } catch (err) {
              Alert.alert("Revert Failed", String(err));
            } finally {
              setReverting(false);
            }
          },
        },
      ],
    );
  };

  const canRevert = status === "completed" && !!snapshotId;

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: sc.color, borderLeftWidth: 3 }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.header}>
        <View style={[styles.statusBadge, { backgroundColor: sc.color + "22" }]}>
          <MaterialIcons name={sc.icon} size={11} color={sc.color} />
          <Text style={[styles.statusText, { color: sc.color }]}>{sc.label}</Text>
        </View>
        <Text style={[styles.date, { color: colors.mutedForeground }]}>{formatDate(createdAt)}</Text>
      </View>
      <Text style={[styles.command, { color: colors.foreground }]} numberOfLines={1}>{command}</Text>
      <Text style={[styles.summary, { color: colors.mutedForeground }]} numberOfLines={2}>{actionsSummary}</Text>
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <View style={styles.footerItem}>
          <MaterialIcons name="bolt" size={12} color={colors.mutedForeground} />
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>{actionsCount} action{actionsCount !== 1 ? "s" : ""}</Text>
        </View>
        <View style={styles.footerRight}>
          {/* Revert button — only for completed transactions that have a snapshot */}
          {canRevert && (
            <TouchableOpacity
              style={[styles.revertBtn, { backgroundColor: colors.warning + "22", borderColor: colors.warning + "55" }]}
              onPress={handleRevert}
              disabled={reverting}
              activeOpacity={0.7}
            >
              {reverting ? (
                <ActivityIndicator size="small" color={colors.warning} />
              ) : (
                <>
                  <MaterialIcons name="undo" size={12} color={colors.warning} />
                  <Text style={[styles.revertText, { color: colors.warning }]}>Revert</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          <Text style={[styles.idText, { color: colors.mutedForeground }]}>#{id.slice(0, 8)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 10, borderWidth: 1, padding: 14, gap: 8, marginBottom: 10 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5 },
  statusText: { fontSize: 9, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8 },
  date: { fontSize: 11, fontFamily: "Inter_400Regular" },
  command: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  summary: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 2,
  },
  footerItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  footerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  revertBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  revertText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  idText: { fontSize: 10, fontFamily: "Inter_400Regular" },
});
