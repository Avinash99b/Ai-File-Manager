import { Linking, PermissionsAndroid, Platform } from "react-native";
import { getStorageRoot } from "./DeviceFileService";

export type PermissionStatus = "granted" | "denied" | "undetermined" | "checking";

export const PermissionService = {
  async checkStoragePermission(): Promise<PermissionStatus> {
    if (Platform.OS !== "android") return "granted";

    const androidVersion = parseInt(Platform.Version.toString(), 10);

    if (androidVersion >= 30) {
      try {
        const RNFS = require("react-native-fs");
        const root = RNFS.ExternalStorageDirectoryPath ?? "/storage/emulated/0";
        await RNFS.readDir(root);
        return "granted";
      } catch {
        return "denied";
      }
    } else {
      try {
        const granted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        );
        return granted ? "granted" : "undetermined";
      } catch {
        return "undetermined";
      }
    }
  },

  async requestStoragePermission(): Promise<PermissionStatus> {
    if (Platform.OS !== "android") return "granted";

    const androidVersion = parseInt(Platform.Version.toString(), 10);

    if (androidVersion >= 30) {
      await Linking.openSettings();
      return "undetermined";
    } else {
      try {
        const readResult = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          {
            title: "Storage Access Required",
            message:
              "AI File Manager needs access to your device storage to browse and manage files.",
            buttonNeutral: "Ask Later",
            buttonNegative: "Deny",
            buttonPositive: "Allow",
          },
        );

        if (readResult === PermissionsAndroid.RESULTS.GRANTED) {
          if (androidVersion < 29) {
            await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
              {
                title: "Write Access Required",
                message: "Needed to rename, copy, move, and delete files.",
                buttonNeutral: "Ask Later",
                buttonNegative: "Deny",
                buttonPositive: "Allow",
              },
            );
          }
          return "granted";
        }
        return "denied";
      } catch {
        return "denied";
      }
    }
  },

  openStorageSettings(): void {
    Linking.openSettings();
  },

  getAndroidApiLevel(): number {
    if (Platform.OS !== "android") return 0;
    return parseInt(Platform.Version.toString(), 10);
  },

  getPermissionTierLabel(): string {
    if (Platform.OS !== "android") return "Not applicable";
    const v = parseInt(Platform.Version.toString(), 10);
    if (v >= 30) return "MANAGE_EXTERNAL_STORAGE (Android 11+)";
    if (v >= 29) return "READ_EXTERNAL_STORAGE — Scoped (Android 10)";
    return "READ + WRITE_EXTERNAL_STORAGE (Android ≤ 9)";
  },

  getStorageRootLabel(): string {
    try {
      return getStorageRoot();
    } catch {
      return "/storage/emulated/0";
    }
  },
};
