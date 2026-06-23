import { MaterialIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
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

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>["name"];

function getFileIcon(name: string, color: string): { icon: MaterialIconName; iconColor: string } {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "md" || ext === "txt") return { icon: "description", iconColor: "#B0B0B0" };
  if (ext === "json") return { icon: "data-object", iconColor: "#FF9800" };
  if (ext === "js" || ext === "ts" || ext === "jsx" || ext === "tsx") return { icon: "code", iconColor: "#BB86FC" };
  if (ext === "csv") return { icon: "table-chart", iconColor: "#4CAF50" };
  if (ext === "log") return { icon: "terminal", iconColor: "#B0B0B0" };
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return { icon: "image", iconColor: "#03DAC6" };
  if (ext === "pdf") return { icon: "picture-as-pdf", iconColor: "#CF6679" };
  if (["zip", "tar", "gz", "7z"].includes(ext)) return { icon: "folder-zip", iconColor: "#B0B0B0" };
  if (ext === "yaml" || ext === "yml") return { icon: "settings", iconColor: "#FF9800" };
  if (ext === "html" || ext === "css") return { icon: "web", iconColor: "#03DAC6" };
  return { icon: "insert-drive-file", iconColor: color };
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

export function FileItem({ name, type, size, modifiedAt, mimeType, isIndexed, isSelected, onPress, onLongPress }: FileItemProps) {
  const colors = useColors();
  const { icon, iconColor } = type === "directory"
    ? { icon: "folder" as MaterialIconName, iconColor: "#BB86FC" }
    : getFileIcon(name, colors.mutedForeground);

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: isSelected ? colors.primary + "22" : "transparent", borderColor: isSelected ? colors.primary + "44" : "transparent" }]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconWrap, { backgroundColor: iconColor + "18" }]}>
        <MaterialIcons name={icon} size={22} color={iconColor} />
      </View>
      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>{name}</Text>
        <View style={styles.meta}>
          {type === "file" && (
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{formatSize(size)}</Text>
          )}
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{formatDate(modifiedAt)}</Text>
          {isIndexed && (
            <View style={[styles.badge, { backgroundColor: colors.success + "22" }]}>
              <MaterialIcons name="check-circle" size={9} color={colors.success} />
              <Text style={[styles.badgeText, { color: colors.success }]}>indexed</Text>
            </View>
          )}
        </View>
      </View>
      <MaterialIcons name={type === "directory" ? "chevron-right" : "more-vert"} size={20} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderRadius: 0 },
  iconWrap: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  info: { flex: 1, marginLeft: 12, gap: 3 },
  name: { fontSize: 14, fontFamily: "Inter_500Medium" },
  meta: { flexDirection: "row", alignItems: "center", gap: 8 },
  metaText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  badge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  badgeText: { fontSize: 9, fontFamily: "Inter_500Medium" },
});
