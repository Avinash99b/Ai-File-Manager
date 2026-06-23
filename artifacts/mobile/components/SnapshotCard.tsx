import { MaterialIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
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
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function SnapshotCard({ id, timestamp, transactionId, affectedFiles, location, sizeMb, restorable, onRestore }: SnapshotCardProps) {
  const colors = useColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.row}>
        <View style={[styles.iconBox, { backgroundColor: colors.secondary + "22" }]}>
          <MaterialIcons name="backup" size={22} color={colors.secondary} />
        </View>
        <View style={styles.info}>
          <Text style={[styles.date, { color: colors.foreground }]}>{formatDate(timestamp)}</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            {affectedFiles.length} file{affectedFiles.length !== 1 ? "s" : ""} · {sizeMb.toFixed(2)} MB · {location}
          </Text>
        </View>
        {restorable && (
          <TouchableOpacity style={[styles.restoreBtn, { backgroundColor: colors.secondary }]} onPress={onRestore} activeOpacity={0.8}>
            <MaterialIcons name="restore" size={18} color="#000" />
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={styles.files}>
        {affectedFiles.slice(0, 3).map((f, i) => (
          <View key={i} style={styles.fileRow}>
            <MaterialIcons name="insert-drive-file" size={11} color={colors.mutedForeground} />
            <Text style={[styles.file, { color: colors.mutedForeground }]} numberOfLines={1}>{f}</Text>
          </View>
        ))}
        {affectedFiles.length > 3 && (
          <Text style={[styles.file, { color: colors.mutedForeground }]}>+{affectedFiles.length - 3} more files</Text>
        )}
      </View>

      <Text style={[styles.idText, { color: colors.border }]}>#{id.slice(0, 10)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 10, borderWidth: 1, padding: 14, marginBottom: 10, gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconBox: { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  info: { flex: 1, gap: 3 },
  date: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  sub: { fontSize: 11, fontFamily: "Inter_400Regular" },
  restoreBtn: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  divider: { height: StyleSheet.hairlineWidth },
  files: { gap: 4 },
  fileRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  file: { fontSize: 11, fontFamily: "Inter_400Regular", flex: 1 },
  idText: { fontSize: 9, fontFamily: "Inter_400Regular", textAlign: "right" },
});
