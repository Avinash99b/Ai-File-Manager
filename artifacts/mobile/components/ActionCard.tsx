import { MaterialIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import type { ParsedAction } from "@/context/TransactionContext";

interface ActionCardProps {
  action: ParsedAction;
  preview?: { before?: string; after?: string; error?: string };
}

type MIcon = React.ComponentProps<typeof MaterialIcons>["name"];

const ACTION_ICONS: Record<string, MIcon> = {
  rename: "drive-file-rename-outline",
  delete: "delete",
  move: "drive-file-move",
  copy: "content-copy",
  create: "add-circle-outline",
  code_execute: "terminal",
};

function getActionColor(action: ParsedAction, colors: ReturnType<typeof useColors>) {
  if (action.action === "delete") return colors.danger;
  if (!action.isSafe) return colors.warning;
  return colors.success;
}

function getLabel(action: ParsedAction): string {
  switch (action.action) {
    case "rename": return `Rename → ${action.params.replacement ?? "?"}`;
    case "delete": return `Delete file`;
    case "move": return `Move → ${action.params.dest ?? "?"}`;
    case "copy": return `Copy → ${action.params.dest ?? "?"}`;
    case "create": return `Create ${action.target}`;
    case "code_execute": return "Execute generated code";
    default: return action.action;
  }
}

export function ActionCard({ action, preview }: ActionCardProps) {
  const colors = useColors();
  const accentColor = getActionColor(action, colors);
  const icon = ACTION_ICONS[action.action] ?? "auto-fix-high";

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceElevated, borderColor: accentColor + "55" }]}>
      <View style={[styles.iconWrap, { backgroundColor: accentColor + "22" }]}>
        <MaterialIcons name={icon} size={18} color={accentColor} />
      </View>
      <View style={styles.content}>
        <View style={styles.row}>
          <Text style={[styles.label, { color: colors.foreground }]} numberOfLines={1}>{getLabel(action)}</Text>
          <View style={[styles.badge, { backgroundColor: action.isSafe ? colors.success + "22" : accentColor + "22" }]}>
            <Text style={[styles.badgeText, { color: action.isSafe ? colors.success : accentColor }]}>
              {action.isSafe ? "SAFE" : "RISKY"}
            </Text>
          </View>
        </View>
        <Text style={[styles.target, { color: colors.mutedForeground }]} numberOfLines={1}>{action.target}</Text>
        {preview?.before && preview?.after && (
          <View style={styles.previewRow}>
            <Text style={[styles.previewText, { color: colors.mutedForeground }]} numberOfLines={1}>{preview.before}</Text>
            <MaterialIcons name="arrow-forward" size={11} color={colors.mutedForeground} />
            <Text style={[styles.previewText, { color: colors.primary }]} numberOfLines={1}>{preview.after}</Text>
          </View>
        )}
        {preview?.error && (
          <View style={styles.errorRow}>
            <MaterialIcons name="error-outline" size={12} color={colors.danger} />
            <Text style={[styles.errorText, { color: colors.danger }]}>{preview.error}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", borderRadius: 10, borderWidth: 1, padding: 12, gap: 10, marginBottom: 8 },
  iconWrap: { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  content: { flex: 1, gap: 4 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeText: { fontSize: 9, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8 },
  target: { fontSize: 11, fontFamily: "Inter_400Regular" },
  previewRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  previewText: { fontSize: 11, fontFamily: "Inter_400Regular", flex: 1 },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  errorText: { fontSize: 11, fontFamily: "Inter_400Regular", flex: 1 },
});
