import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useTransaction, type ParsedAction, type ActionPlan } from "@/context/TransactionContext";
import { useSettings } from "@/context/SettingsContext";
import { ActionCard } from "@/components/ActionCard";
import { useParseAction } from "@workspace/api-client-react";

const EXAMPLES = [
  "Rename all vol-*.log files to event-*.log",
  "Move all CSV files to an archive folder",
  "Delete all backup files matching *.bak",
  "Copy config.json to config.backup.json",
  "Create a new file called index.md",
  "Rename notes.txt to meeting-notes.txt",
];

export default function ActionModal() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { setPendingPlan } = useTransaction();
  const { getLLMConfigForRequest, apiKey, settings } = useSettings();
  const topInset = Platform.OS === "web" ? Math.max(insets.top, 20) : insets.top;

  // Accept an optional prefill param from the file context menu
  const { prefill } = useLocalSearchParams<{ prefill?: string }>();

  const [command, setCommand] = useState(prefill ?? "");
  const [parsedPlan, setParsedPlan] = useState<ActionPlan | null>(null);
  const inputRef = useRef<TextInput>(null);

  // When a prefill is provided, focus the input so the user can finish the command
  useEffect(() => {
    if (prefill) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [prefill]);

  const parseMutation = useParseAction({
    mutation: {
      onSuccess: (data) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setParsedPlan(data as ActionPlan);
      },
    },
  });

  const handleParse = () => {
    if (!command.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const llmConfig = getLLMConfigForRequest();
    parseMutation.mutate({
      data: {
        command: command.trim(),
        ...(llmConfig ? { llmConfig } : {}),
      },
    });
  };

  const handleProceed = () => {
    if (!parsedPlan) return;
    setPendingPlan(parsedPlan);
    router.replace("/approval");
  };

  const isUsingLLM = !!apiKey;

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={[styles.header, { paddingTop: topInset + 8, borderBottomColor: colors.border }]}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        <View style={styles.headerRow}>
          <View style={[styles.iconBox, { backgroundColor: colors.primary + "22" }]}>
            <MaterialIcons name="auto-awesome" size={20} color={colors.primary} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.foreground }]}>AI Command</Text>
            <View style={styles.aiTag}>
              <MaterialIcons name={isUsingLLM ? "auto-awesome" : "rule"} size={10} color={isUsingLLM ? colors.secondary : colors.mutedForeground} />
              <Text style={[styles.aiTagText, { color: isUsingLLM ? colors.secondary : colors.mutedForeground }]}>
                {isUsingLLM ? `${settings.llm.provider} · ${settings.llm.model}` : "Rule-based parser"}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <MaterialIcons name="close" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <View style={[styles.inputWrap, { backgroundColor: colors.surface, borderColor: parsedPlan ? colors.secondary : (prefill && !parsedPlan ? colors.primary : colors.border) }]}>
            <TextInput
              ref={inputRef}
              style={[styles.input, { color: colors.foreground }]}
              placeholder="e.g. Rename all vol-*.log files to event-*.log"
              placeholderTextColor={colors.mutedForeground}
              value={command}
              onChangeText={(v) => { setCommand(v); if (parsedPlan) setParsedPlan(null); }}
              multiline
              numberOfLines={3}
              autoCapitalize="sentences"
            />
          </View>

          {prefill && !parsedPlan && (
            <View style={[styles.hintBox, { backgroundColor: colors.primary + "11", borderColor: colors.primary + "33" }]}>
              <MaterialIcons name="edit" size={14} color={colors.primary} />
              <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
                Complete the command above, then tap Parse to generate an action plan.
              </Text>
            </View>
          )}

          {!isUsingLLM && !prefill && (
            <View style={[styles.hintBox, { backgroundColor: colors.warning + "11", borderColor: colors.warning + "33" }]}>
              <MaterialIcons name="lightbulb-outline" size={14} color={colors.warning} />
              <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
                Add an API key in Settings to use real AI parsing for complex commands
              </Text>
              <TouchableOpacity onPress={() => router.push("/settings")}>
                <Text style={[styles.hintLink, { color: colors.primary }]}>Settings →</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={[styles.parseBtn, { backgroundColor: command.trim() ? colors.primary : colors.muted, opacity: command.trim() ? 1 : 0.6 }]}
            onPress={handleParse}
            disabled={!command.trim() || parseMutation.isPending}
          >
            {parseMutation.isPending
              ? <ActivityIndicator color="#fff" />
              : <>
                <MaterialIcons name={isUsingLLM ? "auto-awesome" : "play-arrow"} size={18} color="#fff" />
                <Text style={styles.parseBtnText}>{isUsingLLM ? "Parse with AI" : "Parse Command"}</Text>
              </>
            }
          </TouchableOpacity>

          {parseMutation.isError && (
            <View style={[styles.errorBox, { backgroundColor: colors.danger + "18", borderColor: colors.danger + "33" }]}>
              <MaterialIcons name="error-outline" size={15} color={colors.danger} />
              <Text style={[styles.errorText, { color: colors.danger }]}>Failed to parse command. Check your connection or API key.</Text>
            </View>
          )}
        </View>

        {parsedPlan && (
          <View style={styles.section}>
            <View style={[styles.planCard, { backgroundColor: colors.surface, borderColor: colors.secondary + "44" }]}>
              <View style={styles.planTop}>
                <MaterialIcons name="check-circle" size={18} color={colors.success} />
                <Text style={[styles.planTitle, { color: colors.foreground }]}>Action Plan Ready</Text>
              </View>
              <Text style={[styles.planSummary, { color: colors.mutedForeground }]}>{parsedPlan.actionsSummary}</Text>
              <View style={styles.planMeta}>
                {[
                  { icon: "bolt" as const, text: `${parsedPlan.actions.length} action${parsedPlan.actions.length !== 1 ? "s" : ""}`, color: colors.mutedForeground },
                  parsedPlan.hasRiskyActions ? { icon: "warning" as const, text: "Needs approval", color: colors.warning } : null,
                  parsedPlan.requiresCode ? { icon: "terminal" as const, text: "Code execution", color: colors.primary } : null,
                ].filter(Boolean).map((m, i) => m && (
                  <View key={i} style={styles.planMetaItem}>
                    <MaterialIcons name={m.icon} size={12} color={m.color} />
                    <Text style={[styles.planMetaText, { color: m.color }]}>{m.text}</Text>
                  </View>
                ))}
              </View>
            </View>

            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ACTIONS</Text>
            {parsedPlan.actions.map((action) => <ActionCard key={action.id} action={action as ParsedAction} />)}

            <TouchableOpacity
              style={[styles.proceedBtn, { backgroundColor: parsedPlan.hasRiskyActions ? colors.warning : colors.success }]}
              onPress={handleProceed}
            >
              <MaterialIcons name={parsedPlan.hasRiskyActions ? "security" : "check"} size={18} color={parsedPlan.hasRiskyActions ? "#000" : "#fff"} />
              <Text style={[styles.proceedBtnText, { color: parsedPlan.hasRiskyActions ? "#000" : "#fff" }]}>
                {parsedPlan.hasRiskyActions ? "Review & Approve" : "Preview & Execute"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {!parsedPlan && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>EXAMPLE COMMANDS</Text>
            <View style={[styles.examplesCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {EXAMPLES.map((ex, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.exampleRow, i < EXAMPLES.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}
                  onPress={() => setCommand(ex)}
                >
                  <MaterialIcons name="subdirectory-arrow-right" size={14} color={colors.primary} />
                  <Text style={[styles.exampleText, { color: colors.foreground }]}>{ex}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: insets.bottom + 32 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, gap: 10, alignItems: "center" },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center" },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, width: "100%" },
  iconBox: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  headerText: { flex: 1, gap: 3 },
  title: { fontSize: 17, fontFamily: "Inter_700Bold" },
  aiTag: { flexDirection: "row", alignItems: "center", gap: 4 },
  aiTagText: { fontSize: 10, fontFamily: "Inter_500Medium" },
  closeBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  scroll: { flex: 1 },
  section: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  sectionLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 1 },
  inputWrap: { borderRadius: 12, borderWidth: 1.5, padding: 14 },
  input: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22, minHeight: 72, textAlignVertical: "top" },
  hintBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 10, borderRadius: 8, borderWidth: 1, flexWrap: "wrap" },
  hintText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  hintLink: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  parseBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, paddingVertical: 14 },
  parseBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
  errorBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 8, borderWidth: 1, padding: 10 },
  errorText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular" },
  planCard: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 6 },
  planTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  planTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  planSummary: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  planMeta: { flexDirection: "row", gap: 12, marginTop: 4, flexWrap: "wrap" },
  planMetaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  planMetaText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  proceedBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, paddingVertical: 14 },
  proceedBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  examplesCard: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  exampleRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  exampleText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
});
