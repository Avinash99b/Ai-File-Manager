import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export type LLMProvider = "openai" | "anthropic" | "gemini" | "ollama" | "custom";
export type EmbeddingModel = "builtin" | "openai" | "custom";
export type BackupFrequency = "disabled" | "daily" | "weekly" | "on-action";
export type AppTheme = "dark" | "light" | "auto";

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  presencePenalty: number;
  frequencyPenalty: number;
  customEndpoint: string;
}

export interface AppSettings {
  llm: LLMConfig;
  embeddingModel: EmbeddingModel;
  embeddingEndpoint: string;
  autoBackupFrequency: BackupFrequency;
  maxLocalSnapshots: number;
  uploadToDrive: boolean;
  maxDriveBackups: number;
  autoApproveSafe: boolean;
  showApprovalModal: boolean;
  transactionHistorySize: number;
  enableDetailedLogs: boolean;
  theme: AppTheme;
  language: string;
  enableNotifications: boolean;
  notifyOnBackup: boolean;
  notifyOnLargeOps: boolean;
  notifyOnErrors: boolean;
  debugMode: boolean;
  apiTimeout: number;
  verboseMode: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  llm: {
    provider: "openai",
    model: "gpt-4o-mini",
    temperature: 0.7,
    maxTokens: 1024,
    topP: 1.0,
    presencePenalty: 0,
    frequencyPenalty: 0,
    customEndpoint: "",
  },
  embeddingModel: "builtin",
  embeddingEndpoint: "",
  autoBackupFrequency: "on-action",
  maxLocalSnapshots: 5,
  uploadToDrive: false,
  maxDriveBackups: 10,
  autoApproveSafe: false,
  showApprovalModal: true,
  transactionHistorySize: 50,
  enableDetailedLogs: true,
  theme: "dark",
  language: "en",
  enableNotifications: true,
  notifyOnBackup: true,
  notifyOnLargeOps: true,
  notifyOnErrors: true,
  debugMode: false,
  apiTimeout: 30,
  verboseMode: false,
};

const SETTINGS_STORAGE_KEY = "@aifm/settings";
const API_KEY_SECURE_KEY = "@aifm/apikey";

interface SettingsContextType {
  settings: AppSettings;
  apiKey: string;
  isLoaded: boolean;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  updateLLM: (partial: Partial<LLMConfig>) => Promise<void>;
  setApiKey: (key: string) => Promise<void>;
  clearApiKey: () => Promise<void>;
  resetSettings: () => Promise<void>;
  getLLMConfigForRequest: () => (LLMConfig & { apiKey: string }) | null;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [apiKey, setApiKeyState] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [stored, storedKey] = await Promise.all([
          AsyncStorage.getItem(SETTINGS_STORAGE_KEY),
          SecureStore.getItemAsync(API_KEY_SECURE_KEY).catch(() => null),
        ]);
        if (stored) {
          const parsed = JSON.parse(stored) as Partial<AppSettings>;
          setSettings((prev) => ({ ...prev, ...parsed, llm: { ...prev.llm, ...(parsed.llm ?? {}) } }));
        }
        if (storedKey) setApiKeyState(storedKey);
      } catch {}
      setIsLoaded(true);
    }
    load();
  }, []);

  const updateSettings = useCallback(async (partial: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const updateLLM = useCallback(async (partial: Partial<LLMConfig>) => {
    setSettings((prev) => {
      const next = { ...prev, llm: { ...prev.llm, ...partial } };
      AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const setApiKey = useCallback(async (key: string) => {
    setApiKeyState(key);
    await SecureStore.setItemAsync(API_KEY_SECURE_KEY, key);
  }, []);

  const clearApiKey = useCallback(async () => {
    setApiKeyState("");
    await SecureStore.deleteItemAsync(API_KEY_SECURE_KEY).catch(() => {});
  }, []);

  const resetSettings = useCallback(async () => {
    setSettings(DEFAULT_SETTINGS);
    await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
  }, []);

  const getLLMConfigForRequest = useCallback(() => {
    if (!apiKey) return null;
    return { ...settings.llm, apiKey };
  }, [settings.llm, apiKey]);

  return (
    <SettingsContext.Provider
      value={{
        settings,
        apiKey,
        isLoaded,
        updateSettings,
        updateLLM,
        setApiKey,
        clearApiKey,
        resetSettings,
        getLLMConfigForRequest,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
