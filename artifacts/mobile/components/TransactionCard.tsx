import { MaterialIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface TransactionCardProps {
  id: string;
  command: string;
  actionsSummary: string;
  status: string;
  createdAt: string;
  actionsCount: number;
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
  };
  return map[status] ?? { color: colors.mutedForeground, icon: "circle", label: status.toUpperCase() };
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function TransactionCard({ id, command, actionsSummary, status, createdAt, actionsCount, onPress }: TransactionCardProps) {
  const colors = useColors();
  const sc = useStatusConfig(status, colors);

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
        <Text style={[styles.idText, { color: colors.mutedForeground }]}>#{id.slice(0, 8)}</Text>
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
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 2 },
  footerItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  footerText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  idText: { fontSize: 10, fontFamily: "Inter_400Regular" },
});
