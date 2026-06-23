import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator, FlatList, Platform, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useFileManager } from "@/context/FileManagerContext";
import { DeviceFileService, type DeviceFile } from "@/services/DeviceFileService";

type SearchScope = "current" | "all";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type MIcon = React.ComponentProps<typeof MaterialIcons>["name"];

function getFileIcon(name: string): { icon: MIcon; color: string } {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["md", "txt"].includes(ext)) return { icon: "description", color: "#B0B0B0" };
  if (ext === "json") return { icon: "data-object", color: "#FF9800" };
  if (["js", "ts", "jsx", "tsx"].includes(ext)) return { icon: "code", color: "#BB86FC" };
  if (ext === "csv") return { icon: "table-chart", color: "#4CAF50" };
  if (ext === "log") return { icon: "terminal", color: "#B0B0B0" };
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return { icon: "image", color: "#03DAC6" };
  if (ext === "pdf") return { icon: "picture-as-pdf", color: "#CF6679" };
  if (["zip", "tar", "gz"].includes(ext)) return { icon: "folder-zip", color: "#B0B0B0" };
  return { icon: "insert-drive-file", color: "#888" };
}

export default function SearchScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentPath, storageRoot, permissionStatus } = useFileManager();
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<SearchScope>("all");
  const [results, setResults] = useState<DeviceFile[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);
  const topInset = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const abortRef = useRef(false);

  const handleSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    if (permissionStatus !== "granted") {
      setSearchError("Storage permission not granted. Go to Files tab and grant access.");
      setHasSearched(true);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsSearching(true);
    setSearchError(null);
    setHasSearched(true);
    abortRef.current = false;

    try {
      const root = scope === "current" ? currentPath : storageRoot;
      const found = await DeviceFileService.searchByName(root, q, scope === "all" ? 5 : 3, 200);
      if (!abortRef.current) {
        setResults(found);
      }
    } catch (err: unknown) {
      if (!abortRef.current) {
        setSearchError(err instanceof Error ? err.message : "Search failed");
        setResults([]);
      }
    } finally {
      if (!abortRef.current) setIsSearching(false);
    }
  }, [query, scope, currentPath, storageRoot, permissionStatus]);

  const handleClear = () => {
    abortRef.current = true;
    setQuery("");
    setHasSearched(false);
    setResults([]);
    setSearchError(null);
  };

  const SCOPES: { key: SearchScope; label: string; icon: MIcon }[] = [
    { key: "all", label: "All Storage", icon: "storage" },
    { key: "current", label: "Current Folder", icon: "folder" },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topInset + 10, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.screenTitle, { color: colors.foreground }]}>Search</Text>
        <View style={styles.searchRow}>
          <View style={[styles.searchBox, { backgroundColor: colors.input, borderColor: colors.border }]}>
            <MaterialIcons name="search" size={20} color={colors.mutedForeground} />
            <TextInput
              ref={inputRef}
              style={[styles.searchInput, { color: colors.foreground }]}
              placeholder="Search by filename…"
              placeholderTextColor={colors.mutedForeground}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={handleClear}>
                <MaterialIcons name="close" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[styles.searchBtn, { backgroundColor: colors.primary, opacity: (!query.trim() || isSearching) ? 0.5 : 1 }]}
            onPress={handleSearch}
            disabled={isSearching || !query.trim()}
          >
            {isSearching
              ? <ActivityIndicator size="small" color="#fff" />
              : <MaterialIcons name="search" size={20} color="#fff" />
            }
          </TouchableOpacity>
        </View>
        <View style={styles.scopeRow}>
          {SCOPES.map((s) => (
            <TouchableOpacity
              key={s.key}
              style={[
                styles.scopeBtn,
                {
                  backgroundColor: scope === s.key ? colors.primary : colors.input,
                  borderColor: scope === s.key ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setScope(s.key)}
            >
              <MaterialIcons
                name={s.icon}
                size={13}
                color={scope === s.key ? "#fff" : colors.mutedForeground}
              />
              <Text style={[styles.scopeBtnText, { color: scope === s.key ? "#fff" : colors.mutedForeground }]}>
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {!hasSearched ? (
        <View style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.primary + "18" }]}>
            <MaterialIcons name="travel-explore" size={48} color={colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Search your files</Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
            Find files by name across all storage or just the current folder.
          </Text>
          <View style={[styles.tip, { backgroundColor: colors.surface, borderColor: colors.primary + "33" }]}>
            <MaterialIcons name="lightbulb-outline" size={15} color={colors.secondary} />
            <Text style={[styles.tipText, { color: colors.mutedForeground }]}>
              Try: ".json", "readme", "config", "log"
            </Text>
          </View>
        </View>
      ) : isSearching ? (
        <View style={styles.empty}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
            Searching device storage…
          </Text>
        </View>
      ) : searchError ? (
        <View style={styles.empty}>
          <MaterialIcons name="error-outline" size={56} color={colors.danger} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Search failed</Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>{searchError}</Text>
        </View>
      ) : results.length === 0 ? (
        <View style={styles.empty}>
          <MaterialIcons name="search-off" size={56} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No results</Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
            No files matching "{query}" found
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.path}
          renderItem={({ item }) => {
            const { icon, color } = item.isDirectory
              ? { icon: "folder" as MIcon, color: "#BB86FC" }
              : getFileIcon(item.name);
            return (
              <View style={[styles.resultItem, { borderBottomColor: colors.border }]}>
                <View style={styles.resultTop}>
                  <View style={[styles.resultIcon, { backgroundColor: color + "22" }]}>
                    <MaterialIcons name={icon} size={18} color={color} />
                  </View>
                  <View style={styles.resultInfo}>
                    <Text style={[styles.resultName, { color: colors.foreground }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={[styles.resultPath, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {item.path}
                    </Text>
                    <Text style={[styles.resultMeta, { color: colors.mutedForeground }]}>
                      {!item.isDirectory && `${formatSize(item.size)} · `}{formatDate(item.mtime)}
                    </Text>
                  </View>
                </View>
              </View>
            );
          }}
          ListHeaderComponent={
            <Text style={[styles.resultCount, { color: colors.mutedForeground }]}>
              {results.length} result{results.length !== 1 ? "s" : ""} for "{query}"
            </Text>
          }
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  screenTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  searchRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  searchBox: {
    flex: 1, flexDirection: "row", alignItems: "center",
    borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", padding: 0 },
  searchBtn: { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  scopeRow: { flexDirection: "row", gap: 6 },
  scopeBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: 7, borderWidth: 1,
  },
  scopeBtnText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 32 },
  emptyIcon: { width: 88, height: 88, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptySubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  tip: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    borderRadius: 10, borderWidth: 1, padding: 12, maxWidth: 320,
  },
  tipText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  resultItem: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  resultTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  resultIcon: { width: 36, height: 36, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  resultInfo: { flex: 1, gap: 2 },
  resultName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  resultPath: { fontSize: 10, fontFamily: "Inter_400Regular" },
  resultMeta: { fontSize: 10, fontFamily: "Inter_400Regular" },
  resultCount: { fontSize: 12, fontFamily: "Inter_400Regular", paddingHorizontal: 16, paddingVertical: 10 },
});
