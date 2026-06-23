import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useSearchFiles } from "@workspace/api-client-react";

type SearchMode = "both" | "semantic" | "filename";

interface SearchResult {
  file: {
    name: string;
    path: string;
    type: string;
    size: number;
    modifiedAt: string;
    mimeType?: string;
  };
  score: number;
  matchType: "semantic" | "filename" | "both";
  snippet?: string;
}

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <View style={styles.scoreBarBg}>
      <View style={[styles.scoreBarFill, { width: `${Math.min(score * 100, 100)}%` as any, backgroundColor: color }]} />
    </View>
  );
}

export default function SearchScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SearchMode>("both");
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const searchMutation = useSearchFiles({
    mutation: {
      onSuccess: () => {
        setHasSearched(true);
      },
    },
  });

  const handleSearch = useCallback(() => {
    if (!query.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    searchMutation.mutate({ data: { query: query.trim(), mode, limit: 30 } });
  }, [query, mode, searchMutation]);

  const results: SearchResult[] = (searchMutation.data?.results ?? []) as SearchResult[];
  const topInset = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  const MODES: { key: SearchMode; label: string; icon: string }[] = [
    { key: "both", label: "Both", icon: "layers" },
    { key: "semantic", label: "Semantic", icon: "cpu" },
    { key: "filename", label: "Filename", icon: "file" },
  ];

  const matchTypeColor = (type: string) => {
    if (type === "both") return colors.primary;
    if (type === "semantic") return colors.success;
    return colors.warning;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topInset + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.searchRow}>
          <View style={[styles.searchBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Feather name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              ref={inputRef}
              style={[styles.searchInput, { color: colors.foreground }]}
              placeholder="Search files by name or content..."
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
                <Feather name="x" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[styles.searchBtn, { backgroundColor: colors.primary }]}
            onPress={handleSearch}
            disabled={searchMutation.isPending || !query.trim()}
            activeOpacity={0.8}
          >
            {searchMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Feather name="search" size={16} color="#fff" />
            )}
          </TouchableOpacity>
        </View>

        {/* Mode selector */}
        <View style={styles.modeRow}>
          {MODES.map((m) => (
            <TouchableOpacity
              key={m.key}
              style={[
                styles.modeBtn,
                {
                  backgroundColor: mode === m.key ? colors.primary : colors.secondary,
                  borderColor: mode === m.key ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setMode(m.key)}
            >
              <Feather name={m.icon as any} size={11} color={mode === m.key ? "#fff" : colors.mutedForeground} />
              <Text style={[styles.modeBtnText, { color: mode === m.key ? "#fff" : colors.mutedForeground }]}>
                {m.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Results */}
      {!hasSearched ? (
        <View style={styles.empty}>
          <Feather name="search" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Search your files</Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
            Find files by name (exact/regex) or semantic meaning
          </Text>
          <View style={[styles.tip, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="info" size={13} color={colors.primary} />
            <Text style={[styles.tipText, { color: colors.mutedForeground }]}>
              Index your files first (tap the database icon) to enable semantic search
            </Text>
          </View>
        </View>
      ) : results.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="file-x" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No results</Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
            Try a different query or search mode
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.file.path}
          renderItem={({ item }) => (
            <View style={[styles.resultItem, { borderBottomColor: colors.border }]}>
              <View style={styles.resultTop}>
                <Feather name="file" size={15} color={matchTypeColor(item.matchType)} />
                <Text style={[styles.resultName, { color: colors.foreground }]} numberOfLines={1}>
                  {item.file.name}
                </Text>
                <View style={[styles.matchBadge, { backgroundColor: matchTypeColor(item.matchType) + "22" }]}>
                  <Text style={[styles.matchBadgeText, { color: matchTypeColor(item.matchType) }]}>
                    {item.matchType}
                  </Text>
                </View>
              </View>
              <Text style={[styles.resultPath, { color: colors.mutedForeground }]} numberOfLines={1}>
                {item.file.path}
              </Text>
              {item.snippet ? (
                <Text style={[styles.snippet, { color: colors.mutedForeground }]} numberOfLines={2}>
                  {item.snippet}
                </Text>
              ) : null}
              <View style={styles.scoreRow}>
                <ScoreBar score={item.score} color={matchTypeColor(item.matchType)} />
                <Text style={[styles.scoreText, { color: colors.mutedForeground }]}>
                  {(item.score * 100).toFixed(0)}%
                </Text>
              </View>
            </View>
          )}
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
          ListHeaderComponent={
            <Text style={[styles.resultCount, { color: colors.mutedForeground }]}>
              {results.length} result{results.length !== 1 ? "s" : ""} for "{query}"
            </Text>
          }
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
    borderBottomWidth: 1,
    gap: 10,
  },
  searchRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    padding: 0,
  },
  searchBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  modeRow: {
    flexDirection: "row",
    gap: 6,
  },
  modeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  modeBtnText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  tip: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    marginTop: 8,
    maxWidth: 320,
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  resultItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 5,
  },
  resultTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  resultName: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  matchBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  matchBadgeText: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  resultPath: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginLeft: 23,
  },
  snippet: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
    marginLeft: 23,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: 23,
    marginTop: 2,
  },
  scoreBarBg: {
    flex: 1,
    height: 3,
    backgroundColor: "#21262d",
    borderRadius: 2,
    overflow: "hidden",
  },
  scoreBarFill: {
    height: 3,
    borderRadius: 2,
  },
  scoreText: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    width: 32,
    textAlign: "right",
  },
  resultCount: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
});
