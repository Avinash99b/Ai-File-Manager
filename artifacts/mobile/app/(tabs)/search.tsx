import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator, FlatList, Platform, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useSearchFiles } from "@workspace/api-client-react";

type SearchMode = "both" | "semantic" | "filename";

interface SearchResult {
  file: { name: string; path: string; type: string; size: number; modifiedAt: string; mimeType?: string };
  score: number; matchType: "semantic" | "filename" | "both"; snippet?: string;
}

function ScoreBar({ score, color }: { score: number; color: string }) {
  const colors = useColors();
  return (
    <View style={[bar.bg, { backgroundColor: colors.surfaceElevated }]}>
      <View style={[bar.fill, { width: `${Math.min(score * 100, 100)}%` as any, backgroundColor: color }]} />
    </View>
  );
}
const bar = StyleSheet.create({
  bg: { flex: 1, height: 3, borderRadius: 2, overflow: "hidden" },
  fill: { height: 3, borderRadius: 2 },
});

export default function SearchScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SearchMode>("both");
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const topInset = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  const searchMutation = useSearchFiles({ mutation: { onSuccess: () => setHasSearched(true) } });

  const handleSearch = useCallback(() => {
    if (!query.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    searchMutation.mutate({ data: { query: query.trim(), mode, limit: 30 } });
  }, [query, mode]);

  const results: SearchResult[] = (searchMutation.data?.results ?? []) as SearchResult[];

  const matchColor = (t: string) => t === "both" ? colors.secondary : t === "semantic" ? colors.success : colors.warning;

  const MODES = [
    { key: "both" as const, label: "Both", icon: "layers" as const },
    { key: "semantic" as const, label: "Semantic", icon: "auto-awesome" as const },
    { key: "filename" as const, label: "Filename", icon: "text-fields" as const },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topInset + 10, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.searchRow}>
          <View style={[styles.searchBox, { backgroundColor: colors.input, borderColor: colors.border }]}>
            <MaterialIcons name="search" size={20} color={colors.mutedForeground} />
            <TextInput
              ref={inputRef}
              style={[styles.searchInput, { color: colors.foreground }]}
              placeholder="Search files by name or content…"
              placeholderTextColor={colors.mutedForeground}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => { setQuery(""); setHasSearched(false); }}>
                <MaterialIcons name="close" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[styles.searchBtn, { backgroundColor: colors.primary }]}
            onPress={handleSearch}
            disabled={searchMutation.isPending || !query.trim()}
          >
            {searchMutation.isPending
              ? <ActivityIndicator size="small" color="#fff" />
              : <MaterialIcons name="search" size={20} color="#fff" />
            }
          </TouchableOpacity>
        </View>
        <View style={styles.modeRow}>
          {MODES.map((m) => (
            <TouchableOpacity
              key={m.key}
              style={[styles.modeBtn, { backgroundColor: mode === m.key ? colors.primary : colors.input, borderColor: mode === m.key ? colors.primary : colors.border }]}
              onPress={() => setMode(m.key)}
            >
              <MaterialIcons name={m.icon} size={13} color={mode === m.key ? "#fff" : colors.mutedForeground} />
              <Text style={[styles.modeBtnText, { color: mode === m.key ? "#fff" : colors.mutedForeground }]}>{m.label}</Text>
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
            Find files by semantic meaning or filename. Index your files first for semantic search.
          </Text>
          <View style={[styles.tip, { backgroundColor: colors.surface, borderColor: colors.primary + "33" }]}>
            <MaterialIcons name="lightbulb-outline" size={15} color={colors.secondary} />
            <Text style={[styles.tipText, { color: colors.mutedForeground }]}>
              Try: "meeting notes", "configuration files", "log from January"
            </Text>
          </View>
        </View>
      ) : results.length === 0 ? (
        <View style={styles.empty}>
          <MaterialIcons name="search-off" size={56} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No results</Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>Try a different query or index your files first</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.file.path}
          renderItem={({ item }) => {
            const mc = matchColor(item.matchType);
            return (
              <View style={[styles.resultItem, { borderBottomColor: colors.border }]}>
                <View style={styles.resultTop}>
                  <View style={[styles.resultIcon, { backgroundColor: mc + "22" }]}>
                    <MaterialIcons name="insert-drive-file" size={16} color={mc} />
                  </View>
                  <Text style={[styles.resultName, { color: colors.foreground }]} numberOfLines={1}>{item.file.name}</Text>
                  <View style={[styles.matchBadge, { backgroundColor: mc + "22" }]}>
                    <Text style={[styles.matchBadgeText, { color: mc }]}>{item.matchType.toUpperCase()}</Text>
                  </View>
                </View>
                <Text style={[styles.resultPath, { color: colors.mutedForeground }]} numberOfLines={1}>{item.file.path}</Text>
                {item.snippet ? (
                  <Text style={[styles.snippet, { color: colors.mutedForeground }]} numberOfLines={2}>{item.snippet}</Text>
                ) : null}
                <View style={styles.scoreRow}>
                  <ScoreBar score={item.score} color={mc} />
                  <Text style={[styles.scoreText, { color: colors.mutedForeground }]}>{(item.score * 100).toFixed(0)}%</Text>
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
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 10 },
  searchRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  searchBox: { flex: 1, flexDirection: "row", alignItems: "center", borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", padding: 0 },
  searchBtn: { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  modeRow: { flexDirection: "row", gap: 6 },
  modeBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 7, borderWidth: 1 },
  modeBtnText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 32 },
  emptyIcon: { width: 88, height: 88, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptySubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  tip: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 10, borderWidth: 1, padding: 12, maxWidth: 320 },
  tipText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  resultItem: { paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, gap: 5 },
  resultTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  resultIcon: { width: 30, height: 30, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  resultName: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  matchBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  matchBadgeText: { fontSize: 8, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8 },
  resultPath: { fontSize: 11, fontFamily: "Inter_400Regular", marginLeft: 38 },
  snippet: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17, marginLeft: 38 },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 38, marginTop: 2 },
  scoreText: { fontSize: 10, fontFamily: "Inter_400Regular", width: 32, textAlign: "right" },
  resultCount: { fontSize: 12, fontFamily: "Inter_400Regular", paddingHorizontal: 16, paddingVertical: 10 },
});
