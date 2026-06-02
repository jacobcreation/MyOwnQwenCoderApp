const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const fs = require("fs/promises");
const path = require("path");

app.disableHardwareAcceleration();

const PREVIEW_LIMIT = 2 * 1024 * 1024;
const DEFAULT_SKIP = new Set(["node_modules", ".git", ".idea", ".vscode", "dist", "build", "out"]);

function workspaceStatePath() {
  return path.join(app.getPath("userData"), "workspace-state.json");
}

async function readLastFolder() {
  try {
    const raw = await fs.readFile(workspaceStatePath(), "utf8");
    const parsed = JSON.parse(raw);
    return typeof parsed.lastFolder === "string" ? parsed.lastFolder : "";
  } catch {
    return "";
  }
}

async function writeLastFolder(folderPath) {
  await fs.mkdir(path.dirname(workspaceStatePath()), { recursive: true });
  await fs.writeFile(workspaceStatePath(), JSON.stringify({ lastFolder: folderPath }), "utf8");
}

const pty = require("node-pty");
const os = require("os");

const shell = os.platform() === "win32" ? "powershell.exe" : "zsh";
let ptyProcess = null;
function setupPty(mainWindow) {
  ptyProcess = pty.spawn(shell, [], {
    name: "xterm-color",
    cols: 80,
    rows: 24,
    cwd: process.env.HOME,
    env: process.env,
  });

  ptyProcess.onData((data) => {
    mainWindow.webContents.send("terminal:incoming-data", data);
  });

  ipcMain.on("terminal:send-data", (event, data) => {
    if (ptyProcess) ptyProcess.write(data);
  });

  ipcMain.on("terminal:resize", (event, { cols, rows }) => {
    if (ptyProcess) ptyProcess.resize(cols, rows);
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 980,
    backgroundColor: "#101316",
    icon: path.join(__dirname, "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.removeMenu();
  win.loadFile(path.join(__dirname, "index.html"));
  setupPty(win);
}

async function isReadableText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const obviousText = new Set([
    ".html",
    ".htm",
    ".css",
    ".js",
    ".mjs",
    ".cjs",
    ".ts",
    ".tsx",
    ".jsx",
    ".json",
    ".md",
    ".txt",
    ".yml",
    ".yaml",
    ".xml",
    ".csv",
    ".toml",
    ".ini",
    ".env",
    ".scss",
    ".less",
    ".vue",
    ".svelte",
    ".py",
    ".rb",
    ".go",
    ".rs",
    ".java",
    ".c",
    ".cc",
    ".cpp",
    ".h",
    ".hpp",
    ".sh",
    ".bat",
    ".ps1",
    ".sql",
    ".graphql",
  ]);

  if (obviousText.has(ext)) return true;

  const handle = await fs.open(filePath, "r");
  try {
    const size = Math.min(PREVIEW_LIMIT, (await handle.stat()).size);
    const buffer = Buffer.alloc(size);
    const { bytesRead } = await handle.read(buffer, 0, size, 0);
    for (let i = 0; i < bytesRead; i += 1) {
      if (buffer[i] === 0) return false;
    }
    return true;
  } finally {
    await handle.close();
  }
}

async function walkDirectory(rootPath, currentPath = rootPath) {
  const dirents = await fs.readdir(currentPath, { withFileTypes: true });
  const children = [];

  for (const dirent of dirents) {
    if (DEFAULT_SKIP.has(dirent.name)) continue;
    if (dirent.name.startsWith(".") && dirent.name !== ".env") continue;

    const fullPath = path.join(currentPath, dirent.name);
    const relativePath = path.relative(rootPath, fullPath) || dirent.name;

    if (dirent.isDirectory()) {
      children.push({
        type: "directory",
        name: dirent.name,
        path: fullPath,
        relativePath,
        children: await walkDirectory(rootPath, fullPath),
      });
      continue;
    }

    const text = await isReadableText(fullPath);
    if (!text) continue;

    children.push({
      type: "file",
      name: dirent.name,
      path: fullPath,
      relativePath,
    });
  }

  children.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return children;
}

async function readWorkspace(rootPath) {
  const stat = await fs.stat(rootPath);
  if (!stat.isDirectory()) {
    throw new Error("Selected path is not a folder.");
  }

  const tree = {
    type: "directory",
    name: path.basename(rootPath) || rootPath,
    path: rootPath,
    relativePath: "",
    children: await walkDirectory(rootPath),
  };

  return { path: rootPath, tree };
}

ipcMain.handle("dialog:open-folder", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });

  if (result.canceled || !result.filePaths.length) return null;

  const folder = result.filePaths[0];
  await writeLastFolder(folder);
  return readWorkspace(folder);
});

ipcMain.handle("workspace:get-last-folder", async () => {
  const lastFolder = await readLastFolder();
  if (!lastFolder) return null;
  try {
    return readWorkspace(lastFolder);
  } catch {
    await writeLastFolder("");
    return null;
  }
});

ipcMain.handle("workspace:read-tree", async (_event, rootPath) => readWorkspace(rootPath));

ipcMain.handle("workspace:read-file", async (_event, filePath) => fs.readFile(filePath, "utf8"));

ipcMain.handle("workspace:write-file", async (_event, filePath, content) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
  return true;
});

ipcMain.handle("workspace:create-directory", async (_event, dirPath) => {
  await fs.mkdir(dirPath, { recursive: true });
  return true;
});

ipcMain.handle("workspace:resolve-path", async (_event, rootPath, relativePath) => path.resolve(rootPath, relativePath));

let currentAbortController = null;

ipcMain.handle("lmstudio:abort", async () => {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
  return true;
});

ipcMain.handle("lmstudio:chat", async (event, endpoint, payload) => {
  if (currentAbortController) currentAbortController.abort();
  currentAbortController = new AbortController();

  const isStream = payload.stream !== false;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: currentAbortController.signal,
    });

    if (!isStream) {
      const text = await response.text();
      return { ok: response.ok, status: response.status, body: text };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (!line.trim() || line.startsWith(":")) continue;

        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();
          if (data === "[DONE]") {
            event.sender.send("lmstudio:stream-done");
            continue;
          }

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content || "";
            if (content) {
              event.sender.send("lmstudio:stream-chunk", content);
            }
          } catch (e) {
            // Partial JSON or other error, ignore and wait for next chunk
          }
        }
      }
    }

    currentAbortController = null;
    return { ok: true, stream: true };
  } catch (error) {
    const isAbort = error.name === "AbortError";
    currentAbortController = null;
    return {
      ok: false,
      status: isAbort ? -1 : 0,
      body: isAbort ? "Request cancelled" : error.message,
    };
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
