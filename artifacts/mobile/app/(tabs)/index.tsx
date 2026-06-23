import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator, FlatList, Platform, StyleSheet,
  Text, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useFileManager } from "@/context/FileManagerContext";
import { FileItem } from "@/components/FileItem";
import { FileContextMenu } from "@/components/FileContextMenu";

interface MenuFile {
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
  const {
    currentPath, files, isLoading, error, permissionStatus,
    navigateTo, goBack, canGoBack, refresh, requestPermission, storageRoot,
  } = useFileManager();

  const topInset = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const [menuFile, setMenuFile] = useState<MenuFile | null>(null);

  const isRoot = currentPath === storageRoot;
  const displayPath = isRoot
    ? "/"
    : (currentPath.startsWith(storageRoot)
        ? currentPath.slice(storageRoot.length) || "/"
        : currentPath);

  const handleFilePress = useCallback(
    (item: { path: string; isDirectory: boolean }) => {
      if (item.isDirectory) {
        Haptics.selectionAsync();
        navigateTo(item.path);
      }
    },
    [navigateTo],
  );

  const handleMenuPress = useCallback((file: MenuFile) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMenuFile(file);
  }, []);

  const handleOpenAction = useCallback(
    (prefill?: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (prefill) {
        router.push({ pathname: "/action-modal", params: { prefill } });
      } else {
        router.push("/action-modal");
      }
    },
    [router],
  );

  const tabBarHeight = Platform.OS === "web" ? 84 : insets.bottom + 64;

  if (permissionStatus === "checking") {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={[styles.centerText, { color: colors.mutedForeground }]}>
          Checking storage access…
        </Text>
      </View>
    );
  }

  if (permissionStatus === "denied" || permissionStatus === "undetermined") {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topInset + 10, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <View style={styles.headerTop}>
            <View style={[styles.logoWrap, { backgroundColor: colors.primary + "22" }]}>
              <MaterialIcons name="folder" size={20} color={colors.primary} />
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>AI File Manager</Text>
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.push("/settings")}>
              <MaterialIcons name="settings" size={24} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={[styles.center, { flex: 1 }]}>
          <View style={[styles.permIcon, { backgroundColor: colors.warning + "22" }]}>
            <MaterialIcons name="lock" size={52} color={colors.warning} />
          </View>
          <Text style={[styles.permTitle, { color: colors.foreground }]}>
            Storage Access Required
          </Text>
          <Text style={[styles.permBody, { color: colors.mutedForeground }]}>
            {"This app needs access to your device storage to browse and manage files.\n\n"}
            {Platform.OS === "android" && parseInt(Platform.Version.toString(), 10) >= 30
              ? 'On Android 11+: tap "Grant Storage Access" to open Android Settings, then enable "Allow access to manage all files".'
              : "Tap below to grant storage permission."}
          </Text>
          <TouchableOpacity
            style={[styles.permBtn, { backgroundColor: colors.primary }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              requestPermission();
            }}
          >
            <MaterialIcons name="security" size={20} color="#fff" />
            <Text style={styles.permBtnText}>Grant Storage Access</Text>
          </TouchableOpacity>
          {Platform.OS === "web" && (
            <View style={[styles.webNote, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <MaterialIcons name="android" size={16} color={colors.primary} />
              <Text style={[styles.webNoteText, { color: colors.mutedForeground }]}>
                Build and sideload the APK on an Android device to browse local files.
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topInset + 10, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerTop}>
          {canGoBack ? (
            <TouchableOpacity
              onPress={() => { Haptics.selectionAsync(); goBack(); }}
              style={styles.iconBtn}
            >
              <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
            </TouchableOpacity>
          ) : (
            <View style={[styles.logoWrap, { backgroundColor: colors.primary + "22" }]}>
              <MaterialIcons name="folder" size={20} color={colors.primary} />
            </View>
          )}
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
            {isRoot ? "AI File Manager" : (currentPath.split("/").filter(Boolean).pop() ?? "Files")}
          </Text>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push("/settings")}>
            <MaterialIcons name="settings" size={24} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
        <Text style={[styles.pathText, { color: colors.mutedForeground }]} numberOfLines={1}>
          {displayPath}
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.centerText, { color: colors.mutedForeground }]}>Loading…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <MaterialIcons name="error-outline" size={56} color={colors.danger} />
          <Text style={[styles.centerText, { color: colors.mutedForeground }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
            onPress={refresh}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : files.length === 0 ? (
        <View style={styles.center}>
          <MaterialIcons name="folder-open" size={56} color={colors.mutedForeground} />
          <Text style={[styles.centerText, { color: colors.mutedForeground }]}>Empty directory</Text>
        </View>
      ) : (
        <FlatList
          data={files}
          keyExtractor={(item) => item.path}
          renderItem={({ item }) => (
            <FileItem
              name={item.name}
              type={item.isDirectory ? "directory" : "file"}
              size={item.size}
              modifiedAt={item.mtime.toISOString()}
              mimeType={item.mimeType}
              onPress={() => handleFilePress(item)}
              onMenuPress={
                !item.isDirectory
                  ? () =>
                      handleMenuPress({
                        name: item.name,
                        path: item.path,
                        size: item.size,
                        modifiedAt: item.mtime.toISOString(),
                        mimeType: item.mimeType,
                      })
                  : undefined
              }
            />
          )}
          ItemSeparatorComponent={() => (
            <View style={[styles.sep, { backgroundColor: colors.border }]} />
          )}
          contentContainerStyle={{ paddingBottom: tabBarHeight + 80 }}
          onRefresh={refresh}
          refreshing={isLoading}
        />
      )}

      <TouchableOpacity
        style={[
          styles.commandBar,
          {
            backgroundColor: colors.surface,
            borderColor: colors.primary + "55",
            bottom: tabBarHeight + 12,
          },
        ]}
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
  header: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 3,
  },
  headerTop: { flexDirection: "row", alignItems: "center", gap: 6 },
  logoWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { flex: 1, fontSize: 18, fontFamily: "Inter_700Bold" },
  pathText: { fontSize: 11, fontFamily: "Inter_400Regular", marginLeft: 4 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 32,
  },
  centerText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: 68 },
  commandBar: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    shadowColor: "#6200EE",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  commandIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  commandPlaceholder: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  permIcon: {
    width: 88,
    height: 88,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  permTitle: { fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center" },
  permBody: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 300,
  },
  permBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  permBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  webNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    maxWidth: 300,
    marginTop: 4,
  },
  webNoteText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  retryText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
