import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import type { ParsedAction } from "@/context/TransactionContext";

interface ActionCardProps {
  action: ParsedAction;
  preview?: { before?: string; after?: string; error?: string };
}

function getActionColor(action: ParsedAction, colors: ReturnType<typeof useColors>) {
  if (!action.isSafe) {
    if (action.action === "delete") return colors.danger;
    if (action.action === "rename" || action.action === "move") return colors.warning;
    return colors.warning;
  }
  return colors.success;
}

function getActionIcon(action: string) {
  switch (action) {
    case "rename": return "edit-2";
    case "delete": return "trash-2";
    case "move": return "move";
    case "copy": return "copy";
    case "create": return "plus";
    case "code_execute": return "terminal";
    default: return "zap";
  }
}

function getActionLabel(action: ParsedAction): string {
  switch (action.action) {
    case "rename": return `Rename → ${action.params.replacement ?? "?"}`;
    case "delete": return `Delete ${action.target}`;
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

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: accentColor + "44" }]}>
      <View style={[styles.iconWrap, { backgroundColor: accentColor + "22" }]}>
        <Feather name={getActionIcon(action.action) as any} size={16} color={accentColor} />
      </View>

      <View style={styles.content}>
        <View style={styles.row}>
          <Text style={[styles.label, { color: colors.foreground }]} numberOfLines={1}>
            {getActionLabel(action)}
          </Text>
          <View style={[styles.badge, { backgroundColor: action.isSafe ? colors.success + "22" : accentColor + "22" }]}>
            <Text style={[styles.badgeText, { color: action.isSafe ? colors.success : accentColor }]}>
              {action.isSafe ? "safe" : "risky"}
            </Text>
          </View>
        </View>

        <Text style={[styles.target, { color: colors.mutedForeground }]} numberOfLines={1}>
          {action.target}
        </Text>

        {preview?.before && preview?.after && (
          <View style={styles.previewRow}>
            <Text style={[styles.previewText, { color: colors.mutedForeground }]} numberOfLines={1}>
              {preview.before}
            </Text>
            <Feather name="arrow-right" size={10} color={colors.mutedForeground} />
            <Text style={[styles.previewText, { color: colors.primary }]} numberOfLines={1}>
              {preview.after}
            </Text>
          </View>
        )}

        {preview?.error && (
          <Text style={[styles.errorText, { color: colors.danger }]}>{preview.error}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    gap: 10,
    marginBottom: 8,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "space-between",
  },
  label: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  target: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  previewText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  errorText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
});
