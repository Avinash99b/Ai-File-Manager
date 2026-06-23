import { Platform } from "react-native";

export interface DeviceFile {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  mtime: Date;
  mimeType?: string;
}

export interface StatResult {
  name: string;
  path: string;
  size: number;
  isFile: boolean;
  isDirectory: boolean;
  mtime: Date;
  ctime?: Date;
}

let _RNFS: typeof import("react-native-fs") | null = null;

function getRNFS(): typeof import("react-native-fs") {
  if (Platform.OS === "web") {
    throw new Error("Filesystem access is not available on web. Install the APK on an Android device.");
  }
  if (!_RNFS) {
    _RNFS = require("react-native-fs") as typeof import("react-native-fs");
  }
  return _RNFS;
}

export function getStorageRoot(): string {
  if (Platform.OS === "web") return "/";
  try {
    const RNFS = getRNFS();
    return RNFS.ExternalStorageDirectoryPath ?? RNFS.DocumentDirectoryPath;
  } catch {
    return "/storage/emulated/0";
  }
}

export function getStorageRoots(): string[] {
  if (Platform.OS === "web") return [];
  try {
    const RNFS = getRNFS();
    return [
      RNFS.ExternalStorageDirectoryPath,
      RNFS.DocumentDirectoryPath,
    ].filter(Boolean) as string[];
  } catch {
    return [];
  }
}

function getMimeType(filename: string): string {
  const dotIndex = filename.lastIndexOf(".");
  const ext = dotIndex >= 0 ? filename.slice(dotIndex + 1).toLowerCase() : "";
  const map: Record<string, string> = {
    txt: "text/plain", md: "text/markdown", json: "application/json",
    js: "application/javascript", ts: "application/typescript",
    jsx: "application/javascript", tsx: "application/typescript",
    csv: "text/csv", log: "text/plain", yaml: "application/yaml",
    yml: "application/yaml", xml: "application/xml", html: "text/html",
    css: "text/css", sh: "text/x-shellscript", bash: "text/x-shellscript",
    py: "text/x-python", java: "text/x-java", cpp: "text/x-c++",
    c: "text/x-c", rs: "text/x-rust", go: "text/x-go", rb: "text/x-ruby",
    php: "application/x-php", swift: "text/x-swift", kt: "text/x-kotlin",
    ini: "text/plain", env: "text/plain", cfg: "text/plain", conf: "text/plain",
    toml: "text/plain", properties: "text/plain",
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
    gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
    bmp: "image/bmp", tiff: "image/tiff",
    pdf: "application/pdf", zip: "application/zip",
    tar: "application/x-tar", gz: "application/gzip",
    "7z": "application/x-7z-compressed", rar: "application/x-rar-compressed",
    mp3: "audio/mpeg", mp4: "video/mp4", mkv: "video/x-matroska",
    apk: "application/vnd.android.package-archive",
  };
  return map[ext] ?? "application/octet-stream";
}

export function isTextFile(filename: string): boolean {
  const basename = filename.split("/").pop() ?? filename;
  const dotIndex = basename.lastIndexOf(".");
  const ext = dotIndex > 0 ? basename.slice(dotIndex + 1).toLowerCase() : "";
  const name = basename.toLowerCase();

  const textExts = new Set([
    "txt", "md", "json", "js", "ts", "jsx", "tsx", "csv", "log",
    "yaml", "yml", "xml", "html", "css", "sh", "bash", "py", "java",
    "cpp", "c", "rs", "go", "rb", "php", "swift", "kt", "ini", "env",
    "cfg", "conf", "toml", "properties", "gitignore", "aiignore",
    "eslintignore", "npmignore", "dockerignore", "editorconfig",
    "babelrc", "prettierrc",
  ]);

  if (textExts.has(ext)) return true;

  const isDotfile = basename.startsWith(".") && !ext;
  if (isDotfile) return true;

  if (name === "makefile" || name === "dockerfile" || name === "rakefile") return true;

  return false;
}

export const DeviceFileService = {
  getStorageRoot,
  getStorageRoots,
  getMimeType,
  isTextFile,

  async listDir(dirPath: string): Promise<DeviceFile[]> {
    const RNFS = getRNFS();
    const items = await RNFS.readDir(dirPath);
    return items
      .map((item) => ({
        name: item.name,
        path: item.path,
        isDirectory: item.isDirectory(),
        size: Number(item.size) || 0,
        mtime: item.mtime ? new Date(item.mtime) : new Date(),
        mimeType: item.isFile() ? getMimeType(item.name) : undefined,
      }))
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      });
  },

  async readFile(filePath: string): Promise<string> {
    const RNFS = getRNFS();
    return RNFS.readFile(filePath, "utf8");
  },

  async writeFile(filePath: string, content: string): Promise<void> {
    const RNFS = getRNFS();
    await RNFS.writeFile(filePath, content, "utf8");
  },

  async rename(fromPath: string, toPath: string): Promise<void> {
    const RNFS = getRNFS();
    await RNFS.moveFile(fromPath, toPath);
  },

  async copy(fromPath: string, toPath: string): Promise<void> {
    const RNFS = getRNFS();
    await RNFS.copyFile(fromPath, toPath);
  },

  async move(fromPath: string, toPath: string): Promise<void> {
    const RNFS = getRNFS();
    await RNFS.moveFile(fromPath, toPath);
  },

  async deleteItem(itemPath: string): Promise<void> {
    const RNFS = getRNFS();
    await RNFS.unlink(itemPath);
  },

  async createDir(dirPath: string): Promise<void> {
    const RNFS = getRNFS();
    await RNFS.mkdir(dirPath);
  },

  async exists(itemPath: string): Promise<boolean> {
    const RNFS = getRNFS();
    return RNFS.exists(itemPath);
  },

  async stat(itemPath: string): Promise<StatResult> {
    const RNFS = getRNFS();
    const s = await RNFS.stat(itemPath);
    return {
      name: itemPath.split("/").pop() ?? itemPath,
      path: itemPath,
      size: Number(s.size) || 0,
      isFile: s.isFile(),
      isDirectory: s.isDirectory(),
      mtime: s.mtime ? new Date(s.mtime) : new Date(),
      ctime: s.ctime ? new Date(s.ctime) : undefined,
    };
  },

  getParentPath(filePath: string, storageRoot: string): string {
    if (!filePath || filePath === storageRoot) return storageRoot;
    const cleaned = filePath.endsWith("/") ? filePath.slice(0, -1) : filePath;
    const lastSlash = cleaned.lastIndexOf("/");
    if (lastSlash <= 0) return storageRoot;
    return cleaned.slice(0, lastSlash) || storageRoot;
  },

  async searchByName(
    rootPath: string,
    query: string,
    maxDepth = 4,
    maxResults = 200,
  ): Promise<DeviceFile[]> {
    const RNFS = getRNFS();
    const results: DeviceFile[] = [];
    const lower = query.toLowerCase();

    async function walk(dir: string, depth: number) {
      if (depth > maxDepth || results.length >= maxResults) return;
      try {
        const items = await RNFS.readDir(dir);
        for (const item of items) {
          if (results.length >= maxResults) break;
          if (item.name.toLowerCase().includes(lower)) {
            results.push({
              name: item.name,
              path: item.path,
              isDirectory: item.isDirectory(),
              size: Number(item.size) || 0,
              mtime: item.mtime ? new Date(item.mtime) : new Date(),
              mimeType: item.isFile() ? getMimeType(item.name) : undefined,
            });
          }
          if (item.isDirectory() && depth < maxDepth) {
            await walk(item.path, depth + 1);
          }
        }
      } catch {
        // Skip directories we can't read
      }
    }

    await walk(rootPath, 0);
    return results;
  },
};
