import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useTransaction } from "@/context/TransactionContext";
import { ActionCard } from "@/components/ActionCard";
import { useParseAction } from "@workspace/api-client-react";
import type { ParsedAction, ActionPlan } from "@/context/TransactionContext";

const EXAMPLE_COMMANDS = [
  "Rename all vol-*.log files to just *.log",
  "Move all CSV files to an archive folder",
  "Delete files older than 30 days",
  "Copy config.json to config.backup.json",
  "Create a new file called index.md",
];

export default function ActionModal() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { setPendingPlan, setIsApprovalVisible } = useTransaction();
  const [command, setCommand] = useState("");
  const [parsedPlan, setParsedPlan] = useState<ActionPlan | null>(null);
  const inputRef = useRef<TextInput>(null);

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
    parseMutation.mutate({ data: { command: command.trim() } });
  };

  const handleProceed = () => {
    if (!parsedPlan) return;
    setPendingPlan(parsedPlan);
    router.replace("/approval");
  };

  const topInset = Platform.OS === "web" ? Math.max(insets.top, 20) : insets.top;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Handle + header */}
      <View style={[styles.header, { paddingTop: topInset + 12, borderBottomColor: colors.border }]}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        <View style={styles.headerRow}>
          <View style={[styles.iconBox, { backgroundColor: colors.primary + "22" }]}>
            <Feather name="terminal" size={18} color={colors.primary} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.foreground }]}>AI Command</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Describe what to do with your files
            </Text>
          </View>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Feather name="x" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Input */}
        <View style={styles.section}>
          <View style={[styles.inputContainer, { backgroundColor: colors.card, borderColor: parsedPlan ? colors.primary : colors.border }]}>
            <TextInput
              ref={inputRef}
              style={[styles.input, { color: colors.foreground }]}
              placeholder="e.g. Rename all vol-XX.txt files to XX.txt"
              placeholderTextColor={colors.mutedForeground}
              value={command}
              onChangeText={(v) => { setCommand(v); if (parsedPlan) setParsedPlan(null); }}
              multiline
              numberOfLines={3}
              returnKeyType="done"
              autoCapitalize="sentences"
            />
          </View>

          <TouchableOpacity
            style={[
              styles.parseBtn,
              {
                backgroundColor: command.trim() ? colors.primary : colors.secondary,
                opacity: command.trim() ? 1 : 0.5,
              },
            ]}
            onPress={handleParse}
            disabled={!command.trim() || parseMutation.isPending}
            activeOpacity={0.8}
          >
            {parseMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="cpu" size={16} color="#fff" />
                <Text style={styles.parseBtnText}>Parse Command</Text>
              </>
            )}
          </TouchableOpacity>

          {parseMutation.isError && (
            <View style={[styles.errorBox, { backgroundColor: colors.danger + "22", borderColor: colors.danger + "44" }]}>
              <Feather name="alert-circle" size={14} color={colors.danger} />
              <Text style={[styles.errorText, { color: colors.danger }]}>
                Failed to parse command. Check your connection and try again.
              </Text>
            </View>
          )}
        </View>

        {/* Parsed plan */}
        {parsedPlan && (
          <View style={styles.section}>
            <View style={[styles.planHeader, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.planHeaderRow}>
                <Feather name="check-circle" size={16} color={colors.success} />
                <Text style={[styles.planTitle, { color: colors.foreground }]}>Action Plan Ready</Text>
              </View>
              <Text style={[styles.planSummary, { color: colors.mutedForeground }]}>
                {parsedPlan.actionsSummary}
              </Text>
              <View style={styles.planMeta}>
                <View style={styles.planMetaItem}>
                  <Feather name="zap" size={11} color={colors.mutedForeground} />
                  <Text style={[styles.planMetaText, { color: colors.mutedForeground }]}>
                    {parsedPlan.actions.length} action{parsedPlan.actions.length !== 1 ? "s" : ""}
                  </Text>
                </View>
                {parsedPlan.hasRiskyActions && (
                  <View style={styles.planMetaItem}>
                    <Feather name="alert-triangle" size={11} color={colors.warning} />
                    <Text style={[styles.planMetaText, { color: colors.warning }]}>Needs approval</Text>
                  </View>
                )}
                {parsedPlan.requiresCode && (
                  <View style={styles.planMetaItem}>
                    <Feather name="code" size={11} color={colors.primary} />
                    <Text style={[styles.planMetaText, { color: colors.primary }]}>Code execution</Text>
                  </View>
                )}
              </View>
            </View>

            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ACTIONS</Text>
            {parsedPlan.actions.map((action) => (
              <ActionCard key={action.id} action={action as ParsedAction} />
            ))}

            <TouchableOpacity
              style={[styles.proceedBtn, { backgroundColor: parsedPlan.hasRiskyActions ? colors.warning : colors.success }]}
              onPress={handleProceed}
              activeOpacity={0.8}
            >
              <Feather
                name={parsedPlan.hasRiskyActions ? "shield" : "check"}
                size={16}
                color="#fff"
              />
              <Text style={styles.proceedBtnText}>
                {parsedPlan.hasRiskyActions ? "Review & Approve" : "Preview & Execute"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Examples */}
        {!parsedPlan && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>EXAMPLE COMMANDS</Text>
            <View style={[styles.examplesContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {EXAMPLE_COMMANDS.map((example, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.exampleRow, i < EXAMPLE_COMMANDS.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}
                  onPress={() => setCommand(example)}
                  activeOpacity={0.7}
                >
                  <Feather name="corner-down-right" size={12} color={colors.primary} />
                  <Text style={[styles.exampleText, { color: colors.foreground }]}>{example}</Text>
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
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    gap: 12,
    alignItems: "center",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    width: "100%",
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  subtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { flex: 1 },
  section: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  sectionLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  inputContainer: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 14,
  },
  input: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
    minHeight: 80,
    textAlignVertical: "top",
  },
  parseBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 10,
    paddingVertical: 14,
  },
  parseBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  planHeader: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  planHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  planTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  planSummary: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  planMeta: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  planMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  planMetaText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  proceedBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 10,
    paddingVertical: 14,
    marginTop: 4,
  },
  proceedBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  examplesContainer: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  exampleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  exampleText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
});
