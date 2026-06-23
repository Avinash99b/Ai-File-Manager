import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Linking, Platform, ScrollView,
  StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import Slider from "@react-native-community/slider";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useSettings, type LLMProvider, type AppTheme, type BackupFrequency } from "@/context/SettingsContext";
import { useIndexDirectory } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

type MIcon = React.ComponentProps<typeof MaterialIcons>["name"];

// ─── Reusable sub-components ────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: MIcon; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={sectionStyles.root}>
      <View style={sectionStyles.header}>
        <MaterialIcons name={icon} size={16} color={colors.primary} />
        <Text style={[sectionStyles.title, { color: colors.primary }]}>{title.toUpperCase()}</Text>
      </View>
      <View style={[sectionStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  root: { marginBottom: 24 },
  header: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  title: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1 },
  card: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
});

function SettingRow({
  icon, label, description, right, onPress, isLast = false,
}: {
  icon: MIcon; label: string; description?: string; right?: React.ReactNode;
  onPress?: () => void; isLast?: boolean;
}) {
  const colors = useColors();
  const content = (
    <View style={[rowStyles.row, !isLast && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <View style={[rowStyles.iconWrap, { backgroundColor: colors.primary + "18" }]}>
        <MaterialIcons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={rowStyles.text}>
        <Text style={[rowStyles.label, { color: colors.foreground }]}>{label}</Text>
        {description && <Text style={[rowStyles.desc, { color: colors.mutedForeground }]}>{description}</Text>}
      </View>
      {right ?? (onPress && <MaterialIcons name="chevron-right" size={20} color={colors.mutedForeground} />)}
    </View>
  );
  if (onPress) return <TouchableOpacity onPress={onPress} activeOpacity={0.7}>{content}</TouchableOpacity>;
  return content;
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  iconWrap: { width: 36, height: 36, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  text: { flex: 1 },
  label: { fontSize: 14, fontFamily: "Inter_500Medium" },
  desc: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
});

function ToggleRow({ icon, label, description, value, onChange, isLast = false }: {
  icon: MIcon; label: string; description?: string; value: boolean; onChange: (v: boolean) => void; isLast?: boolean;
}) {
  const colors = useColors();
  return (
    <SettingRow
      icon={icon} label={label} description={description} isLast={isLast}
      right={<Switch value={value} onValueChange={onChange} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#fff" />}
    />
  );
}

function RadioGroup<T extends string>({ options, value, onChange }: {
  options: { key: T; label: string; description?: string }[];
  value: T; onChange: (v: T) => void;
}) {
  const colors = useColors();
  return (
    <View>
      {options.map((opt, i) => (
        <TouchableOpacity
          key={opt.key}
          style={[radioStyles.item, i < options.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}
          onPress={() => onChange(opt.key)}
          activeOpacity={0.7}
        >
          <View style={[radioStyles.radio, { borderColor: value === opt.key ? colors.primary : colors.border }]}>
            {value === opt.key && <View style={[radioStyles.dot, { backgroundColor: colors.primary }]} />}
          </View>
          <View style={radioStyles.text}>
            <Text style={[radioStyles.label, { color: colors.foreground }]}>{opt.label}</Text>
            {opt.description && <Text style={[radioStyles.desc, { color: colors.mutedForeground }]}>{opt.description}</Text>}
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const radioStyles = StyleSheet.create({
  item: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  dot: { width: 10, height: 10, borderRadius: 5 },
  text: { flex: 1 },
  label: { fontSize: 14, fontFamily: "Inter_500Medium" },
  desc: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
});

function PermissionCard({ label, description, status, onRequest }: {
  label: string; description: string;
  status: "granted" | "denied" | "undetermined" | "checking";
  onRequest: () => void;
}) {
  const colors = useColors();
  const { icon, color, text }: { icon: MIcon; color: string; text: string } =
    status === "granted" ? { icon: "check-circle", color: colors.success, text: "Granted" }
    : status === "denied" ? { icon: "cancel", color: colors.danger, text: "Denied" }
    : status === "checking" ? { icon: "schedule", color: colors.mutedForeground, text: "Checking…" }
    : { icon: "help-outline", color: colors.warning, text: "Not Set" };

  return (
    <View style={[permStyles.card, { borderColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <View style={permStyles.info}>
        <Text style={[permStyles.label, { color: colors.foreground }]}>{label}</Text>
        <Text style={[permStyles.desc, { color: colors.mutedForeground }]}>{description}</Text>
        <View style={permStyles.statusRow}>
          <MaterialIcons name={icon} size={14} color={color} />
          <Text style={[permStyles.statusText, { color }]}>{text}</Text>
        </View>
      </View>
      {status !== "granted" && (
        <TouchableOpacity style={[permStyles.btn, { backgroundColor: colors.primary }]} onPress={onRequest}>
          <Text style={permStyles.btnText}>{status === "denied" ? "Open Settings" : "Grant"}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const permStyles = StyleSheet.create({
  card: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 12 },
  info: { flex: 1, gap: 3 },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  desc: { fontSize: 11, fontFamily: "Inter_400Regular" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  btn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 7 },
  btnText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
});

// ─── Main Settings Screen ────────────────────────────────────────────────────

const LLM_PROVIDERS: { key: LLMProvider; label: string; description?: string }[] = [
  { key: "openai", label: "OpenAI", description: "GPT-4o, GPT-4o-mini, GPT-3.5-turbo" },
  { key: "anthropic", label: "Anthropic Claude", description: "Claude 3.5 Sonnet, Claude 3 Opus" },
  { key: "gemini", label: "Google Gemini", description: "Gemini 2.0 Flash, Gemini 1.5 Pro" },
  { key: "ollama", label: "Ollama (Local)", description: "Llama 3.2, Mistral, Phi-3, etc." },
  { key: "custom", label: "Custom API", description: "OpenAI-compatible endpoint" },
];

const MODEL_OPTIONS: Record<LLMProvider, string[]> = {
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo", "gpt-4-turbo"],
  anthropic: ["claude-3-5-sonnet-20241022", "claude-3-opus-20240229", "claude-3-haiku-20240307"],
  gemini: ["gemini-2.0-flash-lite", "gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
  ollama: ["llama3.2", "llama3.1", "mistral", "phi3", "gemma2"],
  custom: ["custom"],
};

const BACKUP_FREQUENCIES: { key: BackupFrequency; label: string; description?: string }[] = [
  { key: "disabled", label: "Disabled" },
  { key: "on-action", label: "On Every Action", description: "Recommended" },
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
];

const THEMES: { key: AppTheme; label: string }[] = [
  { key: "dark", label: "Dark" },
  { key: "light", label: "Light" },
  { key: "auto", label: "Follow System" },
];

const AIIGNORE_PRESETS: Record<string, string> = {
  "Node.js": "node_modules/\n.env\n.env.*\ndist/\nbuild/\n*.log\nnpm-debug.log*\n",
  Python: "__pycache__/\n*.pyc\n*.pyo\n.venv/\nvenv/\ndist/\nbuild/\n*.egg-info/\n",
  Android: ".gradle/\nbuild/\n*.apk\n*.aab\n*.keystore\nlocal.properties\n",
  Git: ".git/\n.gitignore\n",
};

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { settings, apiKey, updateSettings, updateLLM, setApiKey, clearApiKey, resetSettings } = useSettings();

  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(apiKey);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<"success" | "error" | null>(null);

  const [storagePermission, setStoragePermission] = useState<"granted" | "denied" | "undetermined" | "checking">("checking");
  const [aiignoreContent, setAiignoreContent] = useState("");
  const [aiignoreLoading, setAiignoreLoading] = useState(false);

  const topInset = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  const indexMutation = useIndexDirectory({
    mutation: {
      onSuccess: (r) => Alert.alert("Index Rebuilt", `${r.filesIndexed} files indexed`),
    },
  });

  // Load permissions on mount
  useEffect(() => {
    if (Platform.OS === "android") {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const MediaLibrary = require("expo-media-library") as typeof import("expo-media-library");
        MediaLibrary.getPermissionsAsync()
          .then((r) => setStoragePermission(r.granted ? "granted" : r.status === "denied" ? "denied" : "undetermined"))
          .catch(() => setStoragePermission("undetermined"));
      } catch {
        setStoragePermission("undetermined");
      }
    } else {
      setStoragePermission("granted");
    }
  }, []);

  // Sync apiKeyInput when apiKey changes
  useEffect(() => { setApiKeyInput(apiKey); }, [apiKey]);

  const handleSaveApiKey = useCallback(async () => {
    await setApiKey(apiKeyInput.trim());
    setConnectionResult(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [apiKeyInput, setApiKey]);

  const handleTestConnection = useCallback(async () => {
    if (!apiKeyInput.trim()) { Alert.alert("No API Key", "Enter an API key first"); return; }
    setTestingConnection(true);
    setConnectionResult(null);
    try {
      let url: string; let headers: Record<string, string>; let body: unknown;
      if (settings.llm.provider === "openai" || settings.llm.provider === "custom") {
        url = settings.llm.customEndpoint || "https://api.openai.com/v1/chat/completions";
        headers = { "Content-Type": "application/json", Authorization: `Bearer ${apiKeyInput.trim()}` };
        body = { model: settings.llm.model, messages: [{ role: "user", content: "Hi" }], max_tokens: 5 };
      } else if (settings.llm.provider === "anthropic") {
        url = "https://api.anthropic.com/v1/messages";
        headers = { "Content-Type": "application/json", "x-api-key": apiKeyInput.trim(), "anthropic-version": "2023-06-01" };
        body = { model: settings.llm.model, max_tokens: 5, messages: [{ role: "user", content: "Hi" }] };
      } else if (settings.llm.provider === "gemini") {
        url = `https://generativelanguage.googleapis.com/v1beta/models/${settings.llm.model}:generateContent?key=${apiKeyInput.trim()}`;
        headers = { "Content-Type": "application/json" };
        body = { contents: [{ parts: [{ text: "Hi" }] }] };
      } else {
        url = (settings.llm.customEndpoint || "http://localhost:11434") + "/api/tags";
        headers = { "Content-Type": "application/json" };
        body = {};
      }
      const res = await fetch(url, { method: settings.llm.provider === "ollama" ? "GET" : "POST", headers, body: JSON.stringify(body) });
      setConnectionResult(res.ok ? "success" : "error");
      if (!res.ok) {
        const text = await res.text();
        Alert.alert("Connection Failed", `Status ${res.status}: ${text.slice(0, 200)}`);
      }
    } catch (e) {
      setConnectionResult("error");
      Alert.alert("Connection Error", String(e));
    } finally {
      setTestingConnection(false);
    }
  }, [apiKeyInput, settings.llm]);

  const handleRequestStorage = useCallback(async () => {
    if (storagePermission === "denied") { Linking.openSettings(); return; }
    if (Platform.OS !== "android") { Linking.openSettings(); return; }
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const MediaLibrary = require("expo-media-library") as typeof import("expo-media-library");
      const result = await MediaLibrary.requestPermissionsAsync();
      setStoragePermission(result.granted ? "granted" : "denied");
    } catch {
      Linking.openSettings();
    }
  }, [storagePermission]);

  const handleLoadAiignore = useCallback(async () => {
    setAiignoreLoading(true);
    try {
      const domain = process.env.EXPO_PUBLIC_DOMAIN;
      const res = await fetch(`https://${domain}/api/files/content?path=.aiignore`);
      if (res.ok) {
        const data = await res.json() as { content: string };
        setAiignoreContent(data.content);
      }
    } catch {} finally { setAiignoreLoading(false); }
  }, []);

  const handleSaveAiignore = useCallback(async () => {
    try {
      const domain = process.env.EXPO_PUBLIC_DOMAIN;
      const res = await fetch(`https://${domain}/api/files/write`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: ".aiignore", content: aiignoreContent }),
      });
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Saved", ".aiignore rules updated");
      }
    } catch { Alert.alert("Error", "Failed to save .aiignore"); }
  }, [aiignoreContent]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topInset + 10, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Settings</Text>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => Alert.alert("Reset Settings", "Restore all settings to defaults?", [
            { text: "Cancel", style: "cancel" },
            { text: "Reset", style: "destructive", onPress: resetSettings },
          ])}
        >
          <MaterialIcons name="restart-alt" size={24} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}>

        {/* 1. AI & LLM Configuration */}
        <Section title="AI & LLM Configuration" icon="auto-awesome">
          <View style={[innerStyles.subheader, { borderBottomColor: colors.border }]}>
            <Text style={[innerStyles.subheaderText, { color: colors.mutedForeground }]}>Provider</Text>
          </View>
          <RadioGroup<LLMProvider>
            options={LLM_PROVIDERS}
            value={settings.llm.provider}
            onChange={(v) => {
              updateLLM({ provider: v, model: MODEL_OPTIONS[v][0] });
            }}
          />

          {/* Model selection */}
          <View style={[innerStyles.subheader, { borderColor: colors.border }]}>
            <Text style={[innerStyles.subheaderText, { color: colors.mutedForeground }]}>Model</Text>
          </View>
          <View style={innerStyles.modelRow}>
            {MODEL_OPTIONS[settings.llm.provider].map((model) => (
              <TouchableOpacity
                key={model}
                style={[innerStyles.modelChip, {
                  backgroundColor: settings.llm.model === model ? colors.primary : colors.muted,
                  borderColor: settings.llm.model === model ? colors.primary : colors.border,
                }]}
                onPress={() => updateLLM({ model })}
              >
                <Text style={[innerStyles.modelChipText, { color: settings.llm.model === model ? "#fff" : colors.mutedForeground }]}>{model}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Custom endpoint (shown for custom/ollama) */}
          {(settings.llm.provider === "custom" || settings.llm.provider === "ollama") && (
            <View style={[innerStyles.inputGroup, { borderTopColor: colors.border }]}>
              <Text style={[innerStyles.inputLabel, { color: colors.mutedForeground }]}>Endpoint URL</Text>
              <TextInput
                style={[innerStyles.textInput, { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border }]}
                value={settings.llm.customEndpoint}
                onChangeText={(v) => updateLLM({ customEndpoint: v })}
                placeholder={settings.llm.provider === "ollama" ? "http://localhost:11434" : "https://api.example.com/v1"}
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          )}

          {/* API Key */}
          <View style={[innerStyles.inputGroup, { borderTopColor: colors.border }]}>
            <Text style={[innerStyles.inputLabel, { color: colors.mutedForeground }]}>
              {settings.llm.provider === "ollama" ? "API Key (optional)" : "API Key *"}
            </Text>
            <View style={[innerStyles.apiKeyRow, { backgroundColor: colors.input, borderColor: connectionResult === "success" ? colors.success : connectionResult === "error" ? colors.danger : colors.border }]}>
              <MaterialIcons name="key" size={18} color={colors.mutedForeground} />
              <TextInput
                style={[innerStyles.apiKeyInput, { color: colors.foreground }]}
                value={apiKeyInput}
                onChangeText={setApiKeyInput}
                placeholder="sk-••••••••••••••••"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showApiKey}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowApiKey(!showApiKey)}>
                <MaterialIcons name={showApiKey ? "visibility-off" : "visibility"} size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            <View style={innerStyles.apiKeyActions}>
              <TouchableOpacity
                style={[innerStyles.actionBtn, { backgroundColor: colors.primary }]}
                onPress={handleSaveApiKey}
              >
                <MaterialIcons name="save" size={14} color="#fff" />
                <Text style={innerStyles.actionBtnText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[innerStyles.actionBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderWidth: 1 }]}
                onPress={handleTestConnection}
                disabled={testingConnection}
              >
                {testingConnection
                  ? <ActivityIndicator size="small" color={colors.primary} />
                  : <>
                    <MaterialIcons name="wifi-tethering" size={14} color={connectionResult === "success" ? colors.success : colors.foreground} />
                    <Text style={[innerStyles.actionBtnText, { color: connectionResult === "success" ? colors.success : colors.foreground }]}>Test</Text>
                  </>
                }
              </TouchableOpacity>
              {apiKey && (
                <TouchableOpacity
                  style={[innerStyles.actionBtn, { backgroundColor: colors.danger + "22", borderColor: colors.danger + "44", borderWidth: 1 }]}
                  onPress={() => Alert.alert("Revoke Key", "Remove stored API key?", [
                    { text: "Cancel", style: "cancel" },
                    { text: "Revoke", style: "destructive", onPress: clearApiKey },
                  ])}
                >
                  <MaterialIcons name="delete-outline" size={14} color={colors.danger} />
                  <Text style={[innerStyles.actionBtnText, { color: colors.danger }]}>Revoke</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Advanced: temperature, tokens, topP */}
          <View style={[innerStyles.inputGroup, { borderTopColor: colors.border }]}>
            <Text style={[innerStyles.inputLabel, { color: colors.mutedForeground }]}>Temperature · {settings.llm.temperature.toFixed(1)}</Text>
            <Slider
              style={innerStyles.slider}
              minimumValue={0} maximumValue={2} step={0.1}
              value={settings.llm.temperature}
              onValueChange={(v) => updateLLM({ temperature: parseFloat(v.toFixed(1)) })}
              minimumTrackTintColor={colors.primary}
              maximumTrackTintColor={colors.border}
              thumbTintColor={colors.primary}
            />
            <View style={innerStyles.sliderLabels}>
              <Text style={[innerStyles.sliderLabel, { color: colors.mutedForeground }]}>Precise</Text>
              <Text style={[innerStyles.sliderLabel, { color: colors.mutedForeground }]}>Creative</Text>
            </View>
          </View>
          <View style={[innerStyles.inputGroup, { borderTopColor: colors.border }]}>
            <Text style={[innerStyles.inputLabel, { color: colors.mutedForeground }]}>Max Tokens · {settings.llm.maxTokens}</Text>
            <Slider
              style={innerStyles.slider}
              minimumValue={256} maximumValue={4096} step={64}
              value={settings.llm.maxTokens}
              onValueChange={(v) => updateLLM({ maxTokens: Math.round(v) })}
              minimumTrackTintColor={colors.primary}
              maximumTrackTintColor={colors.border}
              thumbTintColor={colors.primary}
            />
          </View>
          <View style={[innerStyles.inputGroup, { borderTopColor: colors.border }]}>
            <Text style={[innerStyles.inputLabel, { color: colors.mutedForeground }]}>Top P · {settings.llm.topP.toFixed(2)}</Text>
            <Slider
              style={innerStyles.slider}
              minimumValue={0} maximumValue={1} step={0.05}
              value={settings.llm.topP}
              onValueChange={(v) => updateLLM({ topP: parseFloat(v.toFixed(2)) })}
              minimumTrackTintColor={colors.primary}
              maximumTrackTintColor={colors.border}
              thumbTintColor={colors.primary}
            />
          </View>
        </Section>

        {/* 2. Embedding & Search */}
        <Section title="Embedding & Search" icon="travel-explore">
          <SettingRow
            icon="memory"
            label="Embedding Model"
            description={settings.embeddingModel === "builtin" ? "On-device TF-IDF (no API key required)" : settings.embeddingModel === "openai" ? "text-embedding-3-small via OpenAI" : "Custom endpoint"}
            onPress={() => {}}
          />
          <SettingRow
            icon="refresh"
            label="Rebuild Search Index"
            description="Re-index all files for semantic search"
            isLast
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              indexMutation.mutate({ data: { path: "/" } });
            }}
            right={
              indexMutation.isPending
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <View style={[innerStyles.chip, { backgroundColor: colors.primary }]}>
                    <Text style={innerStyles.chipText}>Rebuild</Text>
                  </View>
            }
          />
        </Section>

        {/* 3. File Permissions */}
        {Platform.OS !== "web" && (
          <Section title="File Permissions" icon="security">
            <PermissionCard
              label="Storage Access"
              description="Required to read and write files"
              status={storagePermission}
              onRequest={handleRequestStorage}
            />
            <View style={[permStyles.card, { borderColor: colors.border }]}>
              <View style={permStyles.info}>
                <Text style={[permStyles.label, { color: colors.foreground }]}>All Files Access</Text>
                <Text style={[permStyles.desc, { color: colors.mutedForeground }]}>MANAGE_ALL_FILES — for Android 11+ full filesystem access</Text>
                <View style={permStyles.statusRow}>
                  <MaterialIcons name="info-outline" size={14} color={colors.warning} />
                  <Text style={[permStyles.statusText, { color: colors.warning }]}>Requires manual grant</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[permStyles.btn, { backgroundColor: colors.warning }]}
                onPress={() => Linking.openSettings()}
              >
                <Text style={[permStyles.btnText, { color: "#000" }]}>Open Settings</Text>
              </TouchableOpacity>
            </View>
            <View style={[innerStyles.infoBox, { backgroundColor: colors.primary + "11", borderColor: colors.primary + "33", margin: 12 }]}>
              <MaterialIcons name="info-outline" size={16} color={colors.primary} />
              <Text style={[innerStyles.infoText, { color: colors.mutedForeground }]}>
                Storage permissions are required to browse, index, and manage files on your device.
              </Text>
            </View>
          </Section>
        )}

        {/* 4. Backup & Snapshots */}
        <Section title="Backup & Snapshots" icon="backup">
          <View style={[innerStyles.subheader, { borderBottomColor: colors.border }]}>
            <Text style={[innerStyles.subheaderText, { color: colors.mutedForeground }]}>Auto-backup frequency</Text>
          </View>
          <RadioGroup<BackupFrequency>
            options={BACKUP_FREQUENCIES}
            value={settings.autoBackupFrequency}
            onChange={(v) => updateSettings({ autoBackupFrequency: v })}
          />
          <View style={[innerStyles.inputGroup, { borderTopColor: colors.border }]}>
            <Text style={[innerStyles.inputLabel, { color: colors.mutedForeground }]}>Max local snapshots · {settings.maxLocalSnapshots}</Text>
            <Slider
              style={innerStyles.slider}
              minimumValue={1} maximumValue={20} step={1}
              value={settings.maxLocalSnapshots}
              onValueChange={(v) => updateSettings({ maxLocalSnapshots: Math.round(v) })}
              minimumTrackTintColor={colors.primary}
              maximumTrackTintColor={colors.border}
              thumbTintColor={colors.primary}
            />
          </View>
          <ToggleRow
            icon="cloud-upload"
            label="Sync to Google Drive"
            description="Upload backups automatically (coming soon)"
            value={false}
            onChange={() => Alert.alert("Coming Soon", "Google Drive integration will be available in a future update.")}
            isLast
          />
        </Section>

        {/* 5. .aiignore Management */}
        <Section title=".aiignore Rules" icon="rule">
          <View style={innerStyles.aiignoreHeader}>
            <Text style={[innerStyles.aiignoreInfo, { color: colors.mutedForeground }]}>
              Files matching these patterns are excluded from indexing and all AI operations. Follows .gitignore syntax.
            </Text>
            <View style={innerStyles.presetRow}>
              {Object.keys(AIIGNORE_PRESETS).map((preset) => (
                <TouchableOpacity
                  key={preset}
                  style={[innerStyles.presetChip, { backgroundColor: colors.muted, borderColor: colors.border }]}
                  onPress={() => setAiignoreContent((prev) => prev + "\n" + AIIGNORE_PRESETS[preset])}
                >
                  <Text style={[innerStyles.presetChipText, { color: colors.mutedForeground }]}>{preset}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <TextInput
            style={[innerStyles.codeInput, { color: colors.codeForeground, backgroundColor: colors.codeBackground, borderColor: colors.border }]}
            value={aiignoreContent}
            onChangeText={setAiignoreContent}
            placeholder={"# Patterns to ignore\n*.tmp\n*.log\nnode_modules/"}
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={8}
            onFocus={aiignoreContent === "" ? handleLoadAiignore : undefined}
          />
          <View style={innerStyles.aiignoreActions}>
            <TouchableOpacity
              style={[innerStyles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}
              onPress={handleLoadAiignore}
            >
              {aiignoreLoading
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <MaterialIcons name="refresh" size={14} color={colors.foreground} />
              }
              <Text style={[innerStyles.actionBtnText, { color: colors.foreground }]}>Reload</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[innerStyles.actionBtn, { backgroundColor: colors.primary }]}
              onPress={handleSaveAiignore}
            >
              <MaterialIcons name="save" size={14} color="#fff" />
              <Text style={innerStyles.actionBtnText}>Save & Apply</Text>
            </TouchableOpacity>
          </View>
        </Section>

        {/* 6. Transaction Settings */}
        <Section title="Transaction Behavior" icon="receipt-long">
          <ToggleRow
            icon="check-circle-outline"
            label="Auto-approve Safe Actions"
            description="Automatically commit copy and create operations"
            value={settings.autoApproveSafe}
            onChange={(v) => updateSettings({ autoApproveSafe: v })}
          />
          <ToggleRow
            icon="preview"
            label="Show Approval Modal"
            description="Always show preview before committing"
            value={settings.showApprovalModal}
            onChange={(v) => updateSettings({ showApprovalModal: v })}
          />
          <View style={[innerStyles.inputGroup, { borderTopColor: colors.border }]}>
            <Text style={[innerStyles.inputLabel, { color: colors.mutedForeground }]}>Transaction history · {settings.transactionHistorySize}</Text>
            <Slider
              style={innerStyles.slider}
              minimumValue={10} maximumValue={100} step={10}
              value={settings.transactionHistorySize}
              onValueChange={(v) => updateSettings({ transactionHistorySize: Math.round(v) })}
              minimumTrackTintColor={colors.primary}
              maximumTrackTintColor={colors.border}
              thumbTintColor={colors.primary}
            />
          </View>
          <ToggleRow icon="bug-report" label="Detailed Logs" description="Log all actions with timestamps" value={settings.enableDetailedLogs} onChange={(v) => updateSettings({ enableDetailedLogs: v })} />
          <SettingRow
            icon="delete-sweep"
            label="Clear Transaction History"
            description="Remove all past transactions from database"
            isLast
            onPress={() =>
              Alert.alert("Clear History", "This will permanently delete all transaction records.", [
                { text: "Cancel", style: "cancel" },
                { text: "Clear", style: "destructive", onPress: async () => {
                  queryClient.clear();
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }},
              ])
            }
          />
        </Section>

        {/* 7. Appearance */}
        <Section title="Appearance & Behavior" icon="palette">
          <View style={[innerStyles.subheader, { borderBottomColor: colors.border }]}>
            <Text style={[innerStyles.subheaderText, { color: colors.mutedForeground }]}>Theme</Text>
          </View>
          <RadioGroup<AppTheme>
            options={THEMES}
            value={settings.theme}
            onChange={(v) => updateSettings({ theme: v })}
          />
          <ToggleRow
            icon="notifications-active"
            label="Notifications"
            description="Alerts for backups, large operations, and errors"
            value={settings.enableNotifications}
            onChange={(v) => updateSettings({ enableNotifications: v })}
          />
          <ToggleRow icon="notifications" label="Notify on Backup" value={settings.notifyOnBackup} onChange={(v) => updateSettings({ notifyOnBackup: v })} />
          <ToggleRow icon="error-outline" label="Notify on Errors" value={settings.notifyOnErrors} onChange={(v) => updateSettings({ notifyOnErrors: v })} />

          <View style={[innerStyles.subheader, { borderColor: colors.border }]}>
            <Text style={[innerStyles.subheaderText, { color: colors.mutedForeground }]}>Developer Options</Text>
          </View>
          <ToggleRow icon="developer-mode" label="Debug Mode" value={settings.debugMode} onChange={(v) => updateSettings({ debugMode: v })} />
          <ToggleRow icon="list-alt" label="Verbose Logging" value={settings.verboseMode} onChange={(v) => updateSettings({ verboseMode: v })} isLast />
        </Section>

        {/* 8. About & Help */}
        <Section title="About & Help" icon="info">
          <SettingRow icon="smartphone" label="App Version" description="AI File Manager 1.0.0 (build 1)" right={<Text style={[innerStyles.valueText, { color: colors.mutedForeground }]}>1.0.0</Text>} />
          <SettingRow icon="code" label="Framework" description="Expo 54 · React Native 0.81 · Node 24" right={<Text style={[innerStyles.valueText, { color: colors.mutedForeground }]}>Expo 54</Text>} />
          <SettingRow icon="bug-report" label="Report a Bug" onPress={() => Linking.openURL("mailto:support@example.com?subject=AI File Manager Bug")} />
          <SettingRow icon="system-update" label="Check for Updates" onPress={() => Alert.alert("Up to date", "You're running the latest version.")} />
          <SettingRow icon="privacy-tip" label="Privacy Policy" onPress={() => Alert.alert("Privacy Policy", "Your data is stored locally and never transmitted without your consent.")} />
          <SettingRow icon="gavel" label="Terms of Service" isLast onPress={() => Alert.alert("Terms", "Use of this app is subject to our terms of service.")} />
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, gap: 4,
  },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center" },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20 },
});

const innerStyles = StyleSheet.create({
  subheader: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  subheaderText: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  modelRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  modelChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7, borderWidth: 1 },
  modelChipText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  inputGroup: { paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
  inputLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5, marginBottom: 8 },
  textInput: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, fontFamily: "Inter_400Regular" },
  apiKeyRow: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 8, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 10 },
  apiKeyInput: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", padding: 0 },
  apiKeyActions: { flexDirection: "row", gap: 8, marginTop: 10 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 7 },
  actionBtnText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  chipText: { color: "#fff", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  slider: { width: "100%", height: 36 },
  sliderLabels: { flexDirection: "row", justifyContent: "space-between" },
  sliderLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
  aiignoreHeader: { paddingHorizontal: 16, paddingTop: 12 },
  aiignoreInfo: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18, marginBottom: 10 },
  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  presetChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  presetChipText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  codeInput: {
    marginHorizontal: 16, borderRadius: 8, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    minHeight: 140, textAlignVertical: "top",
  },
  aiignoreActions: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  infoBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 10, borderRadius: 8, borderWidth: 1 },
  infoText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  valueText: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
