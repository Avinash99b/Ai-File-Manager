import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useFileManager } from "@/context/FileManagerContext";
import { useTransaction } from "@/context/TransactionContext";
import { FileItem } from "@/components/FileItem";
import {
  useListFiles,
  useIndexDirectory,
} from "@workspace/api-client-react";

export default function FilesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currentPath, navigateTo, goBack, isIndexed, setIsIndexed } = useFileManager();
  const { setPendingPlan, setIsApprovalVisible } = useTransaction();
  const [command, setCommand] = useState("");

  const { data, isLoading, refetch } = useListFiles(
    { path: currentPath },
    { query: { refetchOnWindowFocus: false } },
  );

  const indexMutation = useIndexDirectory({
    mutation: {
      onSuccess: (result) => {
        setIsIndexed(true);
        Alert.alert("Indexed", `${result.filesIndexed} files indexed for search`);
      },
    },
  });

  const handleFilePress = useCallback(
    (file: { name: string; path: string; type: string }) => {
      if (file.type === "directory") {
        navigateTo(`/${file.path}`);
      }
    },
    [navigateTo],
  );

  const handleOpenAction = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/action-modal");
  };

  const isRoot = currentPath === "/" || currentPath === "";
  const files = data?.files ?? [];
  const topInset = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topInset + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.headerTop}>
          {!isRoot ? (
            <TouchableOpacity onPress={goBack} style={styles.backBtn}>
              <Feather name="arrow-left" size={20} color={colors.primary} />
            </TouchableOpacity>
          ) : (
            <View style={styles.logoWrap}>
              <Feather name="cpu" size={18} color={colors.primary} />
            </View>
          )}
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
            {isRoot ? "AI File Manager" : currentPath.split("/").filter(Boolean).pop()}
          </Text>
          <TouchableOpacity
            style={[styles.indexBtn, { backgroundColor: isIndexed ? colors.success + "22" : colors.secondary }]}
            onPress={() => indexMutation.mutate({ data: { path: currentPath } })}
          >
            {indexMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Feather name="database" size={16} color={isIndexed ? colors.success : colors.mutedForeground} />
            )}
          </TouchableOpacity>
        </View>
        <Text style={[styles.pathText, { color: colors.mutedForeground }]}>
          {currentPath === "/" ? "/files" : `/files${currentPath}`}
        </Text>
      </View>

      {/* File list */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : files.length === 0 ? (
        <View style={styles.center}>
          <Feather name="folder" size={48} color={colors.mutedForeground} />
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
            />
          )}
          ItemSeparatorComponent={() => (
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
          )}
          contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
          onRefresh={refetch}
          refreshing={isLoading}
          scrollEnabled={!!files.length}
        />
      )}

      {/* AI Command bar */}
      <View
        style={[
          styles.commandBar,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            bottom: (Platform.OS === "web" ? 84 : insets.bottom + 64) + 12,
          },
        ]}
      >
        <Feather name="terminal" size={16} color={colors.primary} />
        <TouchableOpacity style={styles.commandInput} onPress={handleOpenAction} activeOpacity={0.8}>
          <Text style={[styles.commandPlaceholder, { color: colors.mutedForeground }]}>
            Describe what to do with your files...
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: colors.primary }]}
          onPress={handleOpenAction}
          activeOpacity={0.8}
        >
          <Feather name="zap" size={15} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 4,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  logoWrap: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  indexBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  pathText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginLeft: 42,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 56,
  },
  commandBar: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  commandInput: {
    flex: 1,
  },
  commandPlaceholder: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});
