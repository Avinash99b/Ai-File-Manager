import { MaterialIcons } from "@expo/vector-icons";
import React from "react";
import {
  Modal, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { useColors } from "@/hooks/useColors";

interface FileContextMenuProps {
  visible: boolean;
  fileName: string;
  filePath: string;
  fileSize: number;
  modifiedAt: string;
  mimeType?: string;
  onClose: () => void;
  /** Pre-fills the AI command bar with a command and opens the action modal */
  onPrefillCommand: (command: string) => void;
}

type MIcon = React.ComponentProps<typeof MaterialIcons>["name"];

interface MenuOption {
  icon: MIcon;
  label: string;
  description: string;
  color?: string;
  command: (fileName: string) => string;
}

const MENU_OPTIONS: MenuOption[] = [
  {
    icon: "drive_file_rename_outline",
    label: "Rename",
    description: "Give this file a new name",
    command: (n) => `Rename ${n} to `,
  },
  {
    icon: "content_copy",
    label: "Copy",
    description: "Duplicate to another location",
    command: (n) => `Copy ${n} to `,
  },
  {
    icon: "drive_file_move",
    label: "Move",
    description: "Move to a different folder",
    command: (n) => `Move ${n} to `,
  },
  {
    icon: "delete_outline",
    label: "Delete",
    description: "Permanently remove this file",
    color: "#CF6679",
    command: (n) => `Delete ${n}`,
  },
];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function FileContextMenu({
  visible, fileName, filePath, fileSize, modifiedAt, mimeType,
  onClose, onPrefillCommand,
}: FileContextMenuProps) {
  const colors = useColors();

  const handleOption = (opt: MenuOption) => {
    onClose();
    onPrefillCommand(opt.command(fileName));
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onClose} />

      <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {/* File identity header */}
        <View style={[styles.fileHeader, { borderBottomColor: colors.border }]}>
          <View style={[styles.fileIconWrap, { backgroundColor: colors.primary + "18" }]}>
            <MaterialIcons name="insert-drive-file" size={28} color={colors.primary} />
          </View>
          <View style={styles.fileInfo}>
            <Text style={[styles.fileName, { color: colors.foreground }]} numberOfLines={1}>{fileName}</Text>
            <Text style={[styles.fileMeta, { color: colors.mutedForeground }]}>
              {formatSize(fileSize)} · {mimeType ?? "file"} · {formatDate(modifiedAt)}
            </Text>
            <Text style={[styles.filePath, { color: colors.mutedForeground }]} numberOfLines={1}>{filePath}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <MaterialIcons name="close" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Hint: all actions go through the AI transaction system */}
        <View style={[styles.hintRow, { backgroundColor: colors.primary + "0D" }]}>
          <MaterialIcons name="auto-awesome" size={13} color={colors.primary} />
          <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
            Actions open the AI command bar — review before committing
          </Text>
        </View>

        {/* Action options */}
        <View style={styles.options}>
          {MENU_OPTIONS.map((opt, i) => {
            const optColor = opt.color ?? colors.foreground;
            const isLast = i === MENU_OPTIONS.length - 1;
            return (
              <TouchableOpacity
                key={opt.label}
                style={[
                  styles.option,
                  !isLast && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
                ]}
                onPress={() => handleOption(opt)}
                activeOpacity={0.7}
              >
                <View style={[styles.optIcon, { backgroundColor: (opt.color ?? colors.primary) + "18" }]}>
                  <MaterialIcons name={opt.icon} size={20} color={opt.color ?? colors.primary} />
                </View>
                <View style={styles.optText}>
                  <Text style={[styles.optLabel, { color: optColor }]}>{opt.label}</Text>
                  <Text style={[styles.optDesc, { color: colors.mutedForeground }]}>{opt.description}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            );
          })}
        </View>

        {Platform.OS !== "web" && <View style={styles.safeBottom} />}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  fileHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  fileIconWrap: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  fileInfo: { flex: 1, gap: 2 },
  fileName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  fileMeta: { fontSize: 11, fontFamily: "Inter_400Regular" },
  filePath: { fontSize: 10, fontFamily: "Inter_400Regular" },
  closeBtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  hintText: { fontSize: 11, fontFamily: "Inter_400Regular", flex: 1 },
  options: {},
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  optIcon: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  optText: { flex: 1 },
  optLabel: { fontSize: 14, fontFamily: "Inter_500Medium" },
  optDesc: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  safeBottom: { height: 24 },
});
