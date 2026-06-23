import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useFileManager } from "@/context/FileManagerContext";
import { FileItem } from "@/components/FileItem";
import { FileContextMenu } from "@/components/FileContextMenu";
import { useListFiles, useIndexDirectory } from "@workspace/api-client-react";

interface SelectedFile {
  name: string;
  path: string;
  size: number;
  modifiedAt: string;
  mimeType?: string;
}

export default function FilesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currentPath, navigateTo, goBack, isIndexed, setIsIndexed } = useFileManager();
  const topInset = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  const [menuFile, setMenuFile] = useState<SelectedFile | null>(null);

  const { data, isLoading, refetch } = useListFiles(
    { path: currentPath },
    { query: { refetchOnWindowFocus: false } },
  );

  const indexMutation = useIndexDirectory({
    mutation: {
      onSuccess: () => {
        setIsIndexed(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
    },
  });

  const handleFilePress = useCallback(
    (file: { name: string; path: string; type: string }) => {
      if (file.type === "directory") navigateTo(`/${file.path}`);
    },
    [navigateTo],
  );

  const handleOpenAction = (prefill?: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (prefill) {
      router.push({ pathname: "/action-modal", params: { prefill } });
    } else {
      router.push("/action-modal");
    }
  };

  const handleMenuPress = useCallback((file: SelectedFile) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMenuFile(file);
  }, []);

  const isRoot = currentPath === "/" || currentPath === "";
  const files = data?.files ?? [];
  const tabBarHeight = Platform.OS === "web" ? 84 : insets.bottom + 64;

  // Display the current path in a user-friendly way.
  // Server stores files under filesDir internally — we show just the logical path.
  const displayPath = isRoot ? "/" : currentPath;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topInset + 10, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerTop}>
          {!isRoot ? (
            <TouchableOpacity onPress={goBack} style={styles.iconBtn}>
              <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
            </TouchableOpacity>
          ) : (
            <View style={[styles.logoWrap, { backgroundColor: colors.primary + "22" }]}>
              <MaterialIcons name="auto-awesome" size={20} color={colors.primary} />
            </View>
          )}
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
            {isRoot ? "AI File Manager" : currentPath.split("/").filter(Boolean).pop()}
          </Text>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: isIndexed ? colors.success + "22" : "transparent" }]}
            onPress={() => indexMutation.mutate({ data: { path: currentPath } })}
          >
            {indexMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <MaterialIcons name="storage" size={24} color={isIndexed ? colors.success : colors.mutedForeground} />
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push("/settings")}>
            <MaterialIcons name="settings" size={24} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
        <Text style={[styles.pathText, { color: colors.mutedForeground }]}>{displayPath}</Text>
      </View>

      {/* File list */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Loading files…</Text>
        </View>
      ) : files.length === 0 ? (
        <View style={styles.center}>
          <MaterialIcons name="folder-open" size={56} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Empty directory</Text>
        </View>
      ) : (
        <FlatList
          data={files}
          keyExtractor={(item) => item.path}
          renderItem={({ item }) => (
            <FileItem
              name={item.name}
              type={item.type as "file" | "directory"}
              size={item.size}
              modifiedAt={item.modifiedAt}
              mimeType={item.mimeType}
              isIndexed={item.isIndexed}
              onPress={() => handleFilePress(item)}
              onMenuPress={item.type === "file"
                ? () => handleMenuPress({
                    name: item.name,
                    path: item.path,
                    size: item.size,
                    modifiedAt: item.modifiedAt,
                    mimeType: item.mimeType,
                  })
                : undefined}
            />
          )}
          ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: colors.border }]} />}
          contentContainerStyle={{ paddingBottom: tabBarHeight + 80 }}
          onRefresh={refetch}
          refreshing={isLoading}
        />
      )}

      {/* AI command bar */}
      <TouchableOpacity
        style={[styles.commandBar, { backgroundColor: colors.surface, borderColor: colors.primary + "55", bottom: tabBarHeight + 12 }]}
        onPress={() => handleOpenAction()}
        activeOpacity={0.9}
      >
        <View style={[styles.commandIcon, { backgroundColor: colors.primary }]}>
          <MaterialIcons name="auto-awesome" size={18} color="#fff" />
        </View>
        <Text style={[styles.commandPlaceholder, { color: colors.mutedForeground }]}>
          Describe what to do with your files…
        </Text>
        <View style={[styles.sendBtn, { backgroundColor: colors.primary + "22" }]}>
          <MaterialIcons name="send" size={18} color={colors.primary} />
        </View>
      </TouchableOpacity>

      {/* File context menu */}
      {menuFile && (
        <FileContextMenu
          visible={!!menuFile}
          fileName={menuFile.name}
          filePath={menuFile.path}
          fileSize={menuFile.size}
          modifiedAt={menuFile.modifiedAt}
          mimeType={menuFile.mimeType}
          onClose={() => setMenuFile(null)}
          onPrefillCommand={(command) => {
            setMenuFile(null);
            handleOpenAction(command);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 12, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, gap: 3 },
  headerTop: { flexDirection: "row", alignItems: "center", gap: 6 },
  logoWrap: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  iconBtn: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontSize: 18, fontFamily: "Inter_700Bold" },
  pathText: { fontSize: 11, fontFamily: "Inter_400Regular", marginLeft: 4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: 68 },
  commandBar: {
    position: "absolute", left: 16, right: 16, flexDirection: "row", alignItems: "center",
    borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 10,
    shadowColor: "#6200EE", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  commandIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  commandPlaceholder: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  sendBtn: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});
