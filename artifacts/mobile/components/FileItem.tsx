import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Feather, MaterialIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface FileItemProps {
  name: string;
  type: "file" | "directory";
  size: number;
  modifiedAt: string;
  mimeType?: string;
  isIndexed?: boolean;
  isSelected?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}

function getFileIcon(name: string, mimeType?: string, color = "#8b949e") {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const iconSize = 20;

  if (ext === "md") return <Feather name="file-text" size={iconSize} color="#58a6ff" />;
  if (ext === "json") return <MaterialIcons name="data-object" size={iconSize} color="#ffa657" />;
  if (ext === "js" || ext === "ts") return <MaterialIcons name="code" size={iconSize} color="#f0db4f" />;
  if (ext === "csv") return <MaterialIcons name="table-chart" size={iconSize} color="#3fb950" />;
  if (ext === "log") return <Feather name="terminal" size={iconSize} color="#8b949e" />;
  if (ext === "txt") return <Feather name="file-text" size={iconSize} color="#c9d1d9" />;
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext))
    return <Feather name="image" size={iconSize} color="#58a6ff" />;
  if (ext === "pdf") return <MaterialIcons name="picture-as-pdf" size={iconSize} color="#f85149" />;
  if (["zip", "tar", "gz"].includes(ext)) return <MaterialIcons name="folder-zip" size={iconSize} color="#8b949e" />;

  return <Feather name="file" size={iconSize} color={color} />;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function FileItem({
  name,
  type,
  size,
  modifiedAt,
  mimeType,
  isIndexed,
  isSelected,
  onPress,
  onLongPress,
}: FileItemProps) {
  const colors = useColors();

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: isSelected ? colors.accent + "22" : "transparent",
          borderColor: isSelected ? colors.accent : "transparent",
        },
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      <View style={styles.iconWrap}>
        {type === "directory" ? (
          <Feather name="folder" size={22} color="#d29922" />
        ) : (
          getFileIcon(name, mimeType, colors.mutedForeground)
        )}
      </View>

      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.meta}>
          {type === "file" && (
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{formatSize(size)}</Text>
          )}
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{formatDate(modifiedAt)}</Text>
          {isIndexed && (
            <View style={[styles.indexedBadge, { backgroundColor: colors.success + "22" }]}>
              <Text style={[styles.indexedText, { color: colors.success }]}>indexed</Text>
            </View>
          )}
        </View>
      </View>

      <Feather
        name={type === "directory" ? "chevron-right" : "more-horizontal"}
        size={16}
        color={colors.mutedForeground}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 0,
  },
  iconWrap: {
    width: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    flex: 1,
    marginLeft: 4,
    gap: 3,
  },
  name: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  indexedBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  indexedText: {
    fontSize: 9,
    fontFamily: "Inter_500Medium",
  },
});
