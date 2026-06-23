import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
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

const STATUS_COLORS: Record<string, { bg: string; fg: string; icon: string }> = {
  completed: { bg: "#3fb95022", fg: "#3fb950", icon: "check-circle" },
  pending: { bg: "#2f81f722", fg: "#2f81f7", icon: "clock" },
  previewed: { bg: "#d2992222", fg: "#d29922", icon: "eye" },
  approved: { bg: "#3fb95022", fg: "#3fb950", icon: "check" },
  rejected: { bg: "#f8514922", fg: "#f85149", icon: "x-circle" },
  failed: { bg: "#f8514922", fg: "#f85149", icon: "alert-circle" },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function TransactionCard({
  id,
  command,
  actionsSummary,
  status,
  createdAt,
  actionsCount,
  onPress,
}: TransactionCardProps) {
  const colors = useColors();
  const statusConfig = STATUS_COLORS[status] ?? { bg: "#8b949e22", fg: "#8b949e", icon: "circle" };

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.header}>
        <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
          <Feather name={statusConfig.icon as any} size={11} color={statusConfig.fg} />
          <Text style={[styles.statusText, { color: statusConfig.fg }]}>{status}</Text>
        </View>
        <Text style={[styles.date, { color: colors.mutedForeground }]}>{formatDate(createdAt)}</Text>
      </View>

      <Text style={[styles.command, { color: colors.foreground }]} numberOfLines={1}>
        {command}
      </Text>
      <Text style={[styles.summary, { color: colors.mutedForeground }]} numberOfLines={2}>
        {actionsSummary}
      </Text>

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <View style={styles.footerItem}>
          <Feather name="zap" size={11} color={colors.mutedForeground} />
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>{actionsCount} action{actionsCount !== 1 ? "s" : ""}</Text>
        </View>
        <Text style={[styles.idText, { color: colors.mutedForeground }]}>#{id.slice(0, 8)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    gap: 8,
    marginBottom: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  date: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  command: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  summary: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    marginTop: 2,
  },
  footerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  footerText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  idText: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    fontVariant: ["tabular-nums"],
  },
});
