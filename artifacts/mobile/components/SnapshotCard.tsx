import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface SnapshotCardProps {
  id: string;
  timestamp: string;
  transactionId: string;
  affectedFiles: string[];
  location: string;
  sizeMb: number;
  restorable: boolean;
  onRestore?: () => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SnapshotCard({
  id,
  timestamp,
  transactionId,
  affectedFiles,
  location,
  sizeMb,
  restorable,
  onRestore,
}: SnapshotCardProps) {
  const colors = useColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.row}>
        <View style={[styles.iconBox, { backgroundColor: colors.primary + "22" }]}>
          <Feather name="archive" size={18} color={colors.primary} />
        </View>
        <View style={styles.info}>
          <Text style={[styles.date, { color: colors.foreground }]}>{formatDate(timestamp)}</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            {affectedFiles.length} file{affectedFiles.length !== 1 ? "s" : ""} · {sizeMb.toFixed(2)} MB · {location}
          </Text>
        </View>
        {restorable && (
          <TouchableOpacity
            style={[styles.restoreBtn, { backgroundColor: colors.primary }]}
            onPress={onRestore}
            activeOpacity={0.8}
          >
            <Feather name="rotate-ccw" size={14} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={styles.files}>
        {affectedFiles.slice(0, 3).map((f, i) => (
          <Text key={i} style={[styles.file, { color: colors.mutedForeground }]} numberOfLines={1}>
            <Feather name="file" size={10} color={colors.mutedForeground} /> {f}
          </Text>
        ))}
        {affectedFiles.length > 3 && (
          <Text style={[styles.file, { color: colors.mutedForeground }]}>
            +{affectedFiles.length - 3} more files
          </Text>
        )}
      </View>

      <Text style={[styles.idText, { color: colors.mutedForeground }]}>#{id.slice(0, 10)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    gap: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    flex: 1,
    gap: 3,
  },
  date: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  sub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  restoreBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  divider: {
    height: 1,
  },
  files: {
    gap: 4,
  },
  file: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  idText: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    textAlign: "right",
  },
});
