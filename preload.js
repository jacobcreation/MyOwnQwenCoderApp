const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("workspace", {
  openFolder: () => ipcRenderer.invoke("dialog:open-folder"),
  getLastFolder: () => ipcRenderer.invoke("workspace:get-last-folder"),
  readTree: (rootPath) => ipcRenderer.invoke("workspace:read-tree", rootPath),
  readFile: (filePath) => ipcRenderer.invoke("workspace:read-file", filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke("workspace:write-file", filePath, content),
  createDirectory: (dirPath) => ipcRenderer.invoke("workspace:create-directory", dirPath),
  resolvePath: (rootPath, relativePath) => ipcRenderer.invoke("workspace:resolve-path", rootPath, relativePath),
  chatWithLlm: (endpoint, payload) => ipcRenderer.invoke("lmstudio:chat", endpoint, payload),
  abortChat: () => ipcRenderer.invoke("lmstudio:abort"),
  onStreamChunk: (callback) => ipcRenderer.on("lmstudio:stream-chunk", (_event, chunk) => callback(chunk)),
  onStreamDone: (callback) => ipcRenderer.on("lmstudio:stream-done", () => callback()),
  // Real Terminal IPC
  sendTerminalData: (data) => ipcRenderer.send("terminal:send-data", data),
  resizeTerminal: (cols, rows) => ipcRenderer.send("terminal:resize", { cols, rows }),
  onTerminalData: (callback) => ipcRenderer.on("terminal:incoming-data", (_event, data) => callback(data)),
});
