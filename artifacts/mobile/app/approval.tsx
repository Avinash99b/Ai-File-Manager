import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator, Alert, Platform, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useTransaction, type ParsedAction } from "@/context/TransactionContext";
import { ActionCard } from "@/components/ActionCard";
import { usePreviewActions, useApproveTransaction, useRejectTransaction } from "@workspace/api-client-react";

export default function ApprovalScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { pendingPlan, setPendingPlan, setLastApprovedId } = useTransaction();
  const [previewed, setPreviewed] = useState(false);
  const [previewData, setPreviewData] = useState<Array<{ before?: string; after?: string; action: string; error?: string }>>([]);
  const topInset = Platform.OS === "web" ? Math.max(insets.top, 20) : insets.top;

  const previewMutation = usePreviewActions({ mutation: { onSuccess: (d) => { setPreviewed(true); setPreviewData(d.previewFiles); } } });
  const approveMutation = useApproveTransaction({
    mutation: {
      onSuccess: (data, variables) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setLastApprovedId(variables.id);
        setPendingPlan(null);
        queryClient.invalidateQueries({ queryKey: ["/api/files/list"] });
        queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/snapshots"] });
        Alert.alert(
          "Transaction Complete",
          `Changes committed successfully${data.snapshotId ? `. Snapshot #${data.snapshotId.slice(0, 8)} created.` : "."}`,
          [{ text: "OK", onPress: () => router.replace("/(tabs)") }],
        );
      },
      onError: () => Alert.alert("Error", "Transaction failed. Your files are unchanged."),
    },
  });
  const rejectMutation = useRejectTransaction({
    mutation: {
      onSuccess: () => {
        setPendingPlan(null);
        queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
        router.replace("/(tabs)");
      },
    },
  });

  if (!pendingPlan) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <MaterialIcons name="error-outline" size={56} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No pending transaction</Text>
          <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary }]} onPress={() => router.replace("/(tabs)")}>
            <Text style={styles.btnText}>Go Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isProcessing = approveMutation.isPending || rejectMutation.isPending;
  const accentColor = pendingPlan.hasRiskyActions ? colors.warning : colors.success;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topInset + 8, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        <View style={styles.headerRow}>
          <View style={[styles.iconBox, { backgroundColor: accentColor + "22" }]}>
            <MaterialIcons
              name={pendingPlan.hasRiskyActions ? "warning" : "check-circle"}
              size={22} color={accentColor}
            />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.foreground }]}>Review Transaction</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {pendingPlan.actions.length} action{pendingPlan.actions.length !== 1 ? "s" : ""} · {pendingPlan.hasRiskyActions ? "Requires approval" : "Safe to run"}
            </Text>
          </View>
          <TouchableOpacity style={styles.iconBtn} onPress={() => rejectMutation.mutate({ id: pendingPlan.transactionId })} disabled={isProcessing}>
            <MaterialIcons name="close" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: insets.bottom + 130 }}>
        <View style={styles.section}>
          <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: accentColor + "44" }]}>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>SUMMARY</Text>
            <Text style={[styles.summaryText, { color: colors.foreground }]}>{pendingPlan.actionsSummary}</Text>
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <MaterialIcons name="schedule" size={12} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>~{(pendingPlan.estimatedTimeMs / 1000).toFixed(1)}s</Text>
              </View>
              <View style={styles.metaItem}>
                <MaterialIcons name="security" size={12} color={colors.secondary} />
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>Snapshot before commit</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ACTIONS</Text>
          {pendingPlan.actions.map((action, i) => (
            <ActionCard key={action.id} action={action as ParsedAction} preview={previewData[i]} />
          ))}
        </View>

        {previewed && (
          <View style={styles.section}>
            <View style={[styles.infoBox, { backgroundColor: colors.success + "11", borderColor: colors.success + "33" }]}>
              <MaterialIcons name="visibility" size={16} color={colors.success} />
              <Text style={[styles.infoText, { color: colors.foreground }]}>
                Preview complete — {previewData.filter((p) => !p.error).length}/{previewData.length} actions OK in sandbox
              </Text>
            </View>
          </View>
        )}

        {pendingPlan.hasRiskyActions && (
          <View style={styles.section}>
            <View style={[styles.infoBox, { backgroundColor: colors.warning + "11", borderColor: colors.warning + "33" }]}>
              <MaterialIcons name="warning" size={16} color={colors.warning} />
              <Text style={[styles.infoText, { color: colors.foreground }]}>
                This transaction contains irreversible operations (rename/delete/move). Review carefully.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Platform.OS === "web" ? 28 : insets.bottom + 12, backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        {!previewed && (
          <TouchableOpacity
            style={[styles.previewBtn, { borderColor: colors.primary + "66" }]}
            onPress={() => previewMutation.mutate({ data: { transactionId: pendingPlan.transactionId, actions: pendingPlan.actions } })}
            disabled={previewMutation.isPending || isProcessing}
          >
            {previewMutation.isPending
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <MaterialIcons name="visibility" size={16} color={colors.primary} />
            }
            <Text style={[styles.previewBtnText, { color: colors.primary }]}>Preview Changes</Text>
          </TouchableOpacity>
        )}

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.rejectBtn, { borderColor: colors.danger + "55" }]}
            onPress={() => rejectMutation.mutate({ id: pendingPlan.transactionId })}
            disabled={isProcessing}
          >
            {rejectMutation.isPending ? <ActivityIndicator size="small" color={colors.danger} /> : <MaterialIcons name="close" size={16} color={colors.danger} />}
            <Text style={[styles.rejectText, { color: colors.danger }]}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.approveBtn, { backgroundColor: accentColor }]}
            onPress={() =>
              Alert.alert(
                "Approve Transaction",
                `This will apply ${pendingPlan.actions.length} action(s). A snapshot will be created first.`,
                [
                  { text: "Cancel", style: "cancel" },
                  { text: "Approve", onPress: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); approveMutation.mutate({ id: pendingPlan.transactionId }); } },
                ],
              )
            }
            disabled={isProcessing}
          >
            {approveMutation.isPending ? <ActivityIndicator color={pendingPlan.hasRiskyActions ? "#000" : "#fff"} /> : <MaterialIcons name="check" size={16} color={pendingPlan.hasRiskyActions ? "#000" : "#fff"} />}
            <Text style={[styles.approveBtnText, { color: pendingPlan.hasRiskyActions ? "#000" : "#fff" }]}>Approve</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  btn: { paddingHorizontal: 24, paddingVertical: 11, borderRadius: 10 },
  btnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  header: { paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, gap: 10, alignItems: "center" },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center" },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, width: "100%" },
  iconBox: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  headerText: { flex: 1, gap: 2 },
  title: { fontSize: 17, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular" },
  iconBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  scroll: { flex: 1 },
  section: { paddingHorizontal: 16, paddingTop: 14, gap: 10 },
  sectionLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 1 },
  summaryCard: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 7 },
  summaryLabel: { fontSize: 9, fontFamily: "Inter_600SemiBold", letterSpacing: 1 },
  summaryText: { fontSize: 14, fontFamily: "Inter_500Medium", lineHeight: 21 },
  metaRow: { flexDirection: "row", gap: 14 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  infoBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  infoText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  footer: { paddingTop: 12, paddingHorizontal: 16, borderTopWidth: StyleSheet.hairlineWidth, gap: 10 },
  previewBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 11, borderRadius: 10, borderWidth: 1 },
  previewBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  actionRow: { flexDirection: "row", gap: 10 },
  rejectBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 13, paddingHorizontal: 20, borderRadius: 12, borderWidth: 1 },
  rejectText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  approveBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 12 },
  approveBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
