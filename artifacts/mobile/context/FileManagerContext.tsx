import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { Platform } from "react-native";
import { DeviceFileService, type DeviceFile, getStorageRoot } from "@/services/DeviceFileService";
import { PermissionService, type PermissionStatus } from "@/services/PermissionService";

interface FileManagerContextType {
  currentPath: string;
  files: DeviceFile[];
  isLoading: boolean;
  error: string | null;
  permissionStatus: PermissionStatus;
  storageRoot: string;
  canGoBack: boolean;
  navigateTo: (path: string) => void;
  goBack: () => void;
  refresh: () => void;
  checkPermission: () => void;
  requestPermission: () => void;
}

const FileManagerContext = createContext<FileManagerContextType | null>(null);

export function FileManagerProvider({ children }: { children: React.ReactNode }) {
  const storageRoot = getStorageRoot();
  const [currentPath, setCurrentPath] = useState(storageRoot);
  const [files, setFiles] = useState<DeviceFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>("checking");
  const [canGoBack, setCanGoBack] = useState(false);
  const historyRef = useRef<string[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const loadFiles = useCallback(async (path: string) => {
    if (Platform.OS === "web") {
      if (mountedRef.current) {
        setPermissionStatus("denied");
        setFiles([]);
        setError("Install the Android APK to browse device files. Web cannot access local storage.");
        setIsLoading(false);
      }
      return;
    }
    if (mountedRef.current) {
      setIsLoading(true);
      setError(null);
    }
    try {
      const items = await DeviceFileService.listDir(path);
      if (mountedRef.current) {
        setFiles(items);
        setPermissionStatus("granted");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isPermission =
        msg.includes("Permission") ||
        msg.includes("EACCES") ||
        msg.includes("EPERM") ||
        msg.includes("access denied");
      if (mountedRef.current) {
        if (isPermission) {
          setPermissionStatus("denied");
          setError(null);
        } else {
          setError(`Cannot read directory: ${msg}`);
        }
        setFiles([]);
      }
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  const checkPermission = useCallback(() => {
    setPermissionStatus("checking");
    PermissionService.checkStoragePermission().then((status) => {
      if (!mountedRef.current) return;
      setPermissionStatus(status);
      if (status === "granted") {
        loadFiles(currentPath);
      } else {
        setFiles([]);
        setIsLoading(false);
      }
    });
  }, [currentPath, loadFiles]);

  useEffect(() => {
    checkPermission();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const navigateTo = useCallback(
    (path: string) => {
      historyRef.current = [...historyRef.current, currentPath];
      setCanGoBack(true);
      setCurrentPath(path);
      loadFiles(path);
    },
    [currentPath, loadFiles],
  );

  const goBack = useCallback(() => {
    const prev = historyRef.current[historyRef.current.length - 1];
    if (prev !== undefined) {
      historyRef.current = historyRef.current.slice(0, -1);
      setCanGoBack(historyRef.current.length > 0);
      setCurrentPath(prev);
      loadFiles(prev);
    }
  }, [loadFiles]);

  const refresh = useCallback(() => {
    loadFiles(currentPath);
  }, [currentPath, loadFiles]);

  const requestPermission = useCallback(() => {
    PermissionService.requestStoragePermission().then((status) => {
      if (!mountedRef.current) return;
      setPermissionStatus(status);
      if (status === "granted") {
        loadFiles(currentPath);
      } else if (status === "undetermined") {
        setTimeout(() => {
          PermissionService.checkStoragePermission().then((recheckStatus) => {
            if (!mountedRef.current) return;
            setPermissionStatus(recheckStatus);
            if (recheckStatus === "granted") loadFiles(currentPath);
          });
        }, 2000);
      }
    });
  }, [currentPath, loadFiles]);

  return (
    <FileManagerContext.Provider
      value={{
        currentPath,
        files,
        isLoading,
        error,
        permissionStatus,
        storageRoot,
        canGoBack,
        navigateTo,
        goBack,
        refresh,
        checkPermission,
        requestPermission,
      }}
    >
      {children}
    </FileManagerContext.Provider>
  );
}

export function useFileManager() {
  const ctx = useContext(FileManagerContext);
  if (!ctx) throw new Error("useFileManager must be used within FileManagerProvider");
  return ctx;
}
