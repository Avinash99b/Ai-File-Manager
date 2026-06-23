import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useTransaction, type ParsedAction } from "@/context/TransactionContext";
import { ActionCard } from "@/components/ActionCard";
import {
  usePreviewActions,
  useApproveTransaction,
  useRejectTransaction,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export default function ApprovalScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { pendingPlan, setPendingPlan, setLastApprovedId } = useTransaction();
  const [previewed, setPreviewed] = useState(false);
  const [previewData, setPreviewData] = useState<Array<{ before?: string; after?: string; action: string; error?: string }>>([]);

  const previewMutation = usePreviewActions({
    mutation: {
      onSuccess: (data) => {
        setPreviewed(true);
        setPreviewData(data.previewFiles);
      },
    },
  });

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
          `Changes committed. Snapshot created${data.snapshotId ? ` (${data.snapshotId.slice(0, 8)})` : ""}.`,
          [{ text: "OK", onPress: () => router.replace("/(tabs)") }],
        );
      },
      onError: () => {
        Alert.alert("Error", "Transaction failed. Your files are unchanged.");
      },
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
          <Feather name="alert-circle" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No pending transaction</Text>
          <TouchableOpacity onPress={() => router.replace("/(tabs)")} style={[styles.backBtn, { backgroundColor: colors.primary }]}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const handlePreview = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    previewMutation.mutate({
      data: {
        transactionId: pendingPlan.transactionId,
        actions: pendingPlan.actions,
      },
    });
  };

  const handleApprove = () => {
    Alert.alert(
      "Approve Transaction",
      `This will apply ${pendingPlan.actions.length} action(s) to your files. A snapshot will be created first.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve",
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            approveMutation.mutate({ id: pendingPlan.transactionId });
          },
        },
      ],
    );
  };

  const handleReject = () => {
    rejectMutation.mutate({ id: pendingPlan.transactionId });
  };

  const topInset = Platform.OS === "web" ? Math.max(insets.top, 20) : insets.top;
  const isProcessing = approveMutation.isPending || rejectMutation.isPending;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topInset + 12, borderBottomColor: colors.border, backgroundColor: colors.card }]}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        <View style={styles.headerRow}>
          <View style={[styles.iconBox, { backgroundColor: pendingPlan.hasRiskyActions ? colors.warning + "22" : colors.success + "22" }]}>
            <Feather
              name={pendingPlan.hasRiskyActions ? "alert-triangle" : "check-circle"}
              size={18}
              color={pendingPlan.hasRiskyActions ? colors.warning : colors.success}
            />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.foreground }]}>Review Transaction</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {pendingPlan.actions.length} action{pendingPlan.actions.length !== 1 ? "s" : ""} ·{" "}
              {pendingPlan.hasRiskyActions ? "Requires approval" : "Safe to run"}
            </Text>
          </View>
          <TouchableOpacity onPress={handleReject} style={styles.closeBtn} disabled={isProcessing}>
            <Feather name="x" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>
        {/* Summary */}
        <View style={styles.section}>
          <View style={[styles.summaryBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>SUMMARY</Text>
            <Text style={[styles.summaryText, { color: colors.foreground }]}>{pendingPlan.actionsSummary}</Text>
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Feather name="clock" size={11} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                  ~{(pendingPlan.estimatedTimeMs / 1000).toFixed(1)}s
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Feather name="shield" size={11} color={colors.primary} />
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>Snapshot before commit</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ACTIONS</Text>
          {pendingPlan.actions.map((action, i) => (
            <ActionCard
              key={action.id}
              action={action as ParsedAction}
              preview={previewData[i]}
            />
          ))}
        </View>

        {/* Preview result */}
        {previewed && previewData.length > 0 && (
          <View style={styles.section}>
            <View style={[styles.previewBox, { backgroundColor: colors.success + "11", borderColor: colors.success + "44" }]}>
              <Feather name="eye" size={15} color={colors.success} />
              <Text style={[styles.previewText, { color: colors.foreground }]}>
                Preview complete — {previewData.filter((p) => !p.error).length}/{previewData.length} actions applied in sandbox
              </Text>
            </View>
          </View>
        )}

        {/* Risk warning */}
        {pendingPlan.hasRiskyActions && (
          <View style={styles.section}>
            <View style={[styles.warningBox, { backgroundColor: colors.warning + "11", borderColor: colors.warning + "44" }]}>
              <Feather name="alert-triangle" size={15} color={colors.warning} />
              <Text style={[styles.warningText, { color: colors.foreground }]}>
                This transaction contains irreversible actions (rename/delete). Review carefully before approving.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Footer actions */}
      <View
        style={[
          styles.footer,
          {
            paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 12,
            backgroundColor: colors.card,
            borderTopColor: colors.border,
          },
        ]}
      >
        {!previewed && (
          <TouchableOpacity
            style={[styles.previewBtn, { borderColor: colors.border }]}
            onPress={handlePreview}
            disabled={previewMutation.isPending || isProcessing}
            activeOpacity={0.8}
          >
            {previewMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Feather name="eye" size={15} color={colors.primary} />
                <Text style={[styles.previewBtnText, { color: colors.primary }]}>Preview Changes</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.rejectBtn, { borderColor: colors.danger + "88" }]}
            onPress={handleReject}
            disabled={isProcessing}
            activeOpacity={0.8}
          >
            {rejectMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.danger} />
            ) : (
              <>
                <Feather name="x" size={15} color={colors.danger} />
                <Text style={[styles.rejectBtnText, { color: colors.danger }]}>Cancel</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.approveBtn, { backgroundColor: pendingPlan.hasRiskyActions ? colors.warning : colors.success }]}
            onPress={handleApprove}
            disabled={isProcessing}
            activeOpacity={0.8}
          >
            {approveMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="check" size={15} color="#fff" />
                <Text style={styles.approveBtnText}>Approve Transaction</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  backBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backBtnText: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
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
    gap: 10,
  },
  sectionLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  summaryBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  summaryLabel: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  summaryText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    lineHeight: 21,
  },
  metaRow: {
    flexDirection: "row",
    gap: 14,
    marginTop: 4,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  previewBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  previewText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  warningBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  footer: {
    paddingTop: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    gap: 10,
  },
  previewBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
  },
  previewBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  rejectBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
  },
  rejectBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  approveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 10,
  },
  approveBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
});
