import React, { createContext, useContext, useState, useCallback } from "react";

interface FileManagerState {
  currentPath: string;
  selectedFiles: string[];
  searchQuery: string;
  isIndexed: boolean;
}

interface FileManagerContextType extends FileManagerState {
  navigateTo: (path: string) => void;
  selectFile: (path: string) => void;
  deselectFile: (path: string) => void;
  clearSelection: () => void;
  setSearchQuery: (q: string) => void;
  setIsIndexed: (v: boolean) => void;
  goBack: () => void;
}

const FileManagerContext = createContext<FileManagerContextType | null>(null);

export function FileManagerProvider({ children }: { children: React.ReactNode }) {
  const [currentPath, setCurrentPath] = useState("/");
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isIndexed, setIsIndexed] = useState(false);
  const [history, setHistory] = useState<string[]>([]);

  const navigateTo = useCallback((path: string) => {
    setHistory((prev) => [...prev, currentPath]);
    setCurrentPath(path);
    setSelectedFiles([]);
  }, [currentPath]);

  const goBack = useCallback(() => {
    const prev = history[history.length - 1];
    if (prev !== undefined) {
      setHistory((h) => h.slice(0, -1));
      setCurrentPath(prev);
      setSelectedFiles([]);
    }
  }, [history]);

  const selectFile = useCallback((path: string) => {
    setSelectedFiles((prev) => (prev.includes(path) ? prev : [...prev, path]));
  }, []);

  const deselectFile = useCallback((path: string) => {
    setSelectedFiles((prev) => prev.filter((p) => p !== path));
  }, []);

  const clearSelection = useCallback(() => setSelectedFiles([]), []);

  return (
    <FileManagerContext.Provider
      value={{
        currentPath,
        selectedFiles,
        searchQuery,
        isIndexed,
        navigateTo,
        goBack,
        selectFile,
        deselectFile,
        clearSelection,
        setSearchQuery,
        setIsIndexed,
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
