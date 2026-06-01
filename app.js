const state = {
  rootPath: "",
  tree: null,
  fileCache: new Map(),
  activePath: "",
  activeContent: "",
  dirty: false,
  expanded: new Set(),
  messages: [],
  currentAgentMessage: null,
};

const MAX_CONTEXT_FILES = 12;
const MAX_CONTEXT_CHARS = 12000;
const MAX_FILE_CHARS = 3000;

const elements = {
  rootPath: document.querySelector("#root-path"),
  fileTree: document.querySelector("#file-tree"),
  editor: document.querySelector("#editor"),
  lineNumbers: document.querySelector("#line-numbers"),
  activeFileName: document.querySelector("#active-file-name"),
  statusText: document.querySelector("#status-text"),
  fileMeta: document.querySelector("#file-meta"),
  agentLog: document.querySelector("#agent-log"),
  chatForm: document.querySelector("#chat-form"),
  promptInput: document.querySelector("#prompt-input"),
  endpointInput: document.querySelector("#endpoint-input"),
  modelInput: document.querySelector("#model-input"),
  agentMode: document.querySelector("#agent-mode"),
  sendButton: document.querySelector("#send-button"),
  stopButton: document.querySelector("#stop-button"),
  thinkingIndicator: document.querySelector("#thinking-indicator"),
  settingsToggle: document.querySelector("#settings-toggle"),
  settingsContent: document.querySelector("#settings-content"),
  openFolderButton: document.querySelector("#open-folder-button"),
  saveButton: document.querySelector("#save-button"),
  formatButton: document.querySelector("#format-button"),
  newFileButton: document.querySelector("#new-file-button"),
  newFolderButton: document.querySelector("#new-folder-button"),
  refreshButton: document.querySelector("#refresh-button"),
};

function setStatus(message) {
  elements.statusText.textContent = message;
}

function restoreComposerState() {
  elements.sendButton.style.display = "inline-flex";
  elements.thinkingIndicator.classList.remove("active");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function iconForFile(name) {
  if (name.endsWith(".html")) return "HTML";
  if (name.endsWith(".css")) return "CSS";
  if (name.endsWith(".js") || name.endsWith(".ts")) return "JS";
  if (name.endsWith(".json")) return "JSON";
  if (name.endsWith(".md")) return "MD";
  return "FILE";
}

function sortedChildren(node) {
  return [...(node.children || [])].sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function flattenFiles(node, out = []) {
  if (!node) return out;
  if (node.type === "file") {
    out.push(node);
    return out;
  }
  sortedChildren(node).forEach((child) => flattenFiles(child, out));
  return out;
}

function findFirstFile(node) {
  if (!node) return null;
  if (node.type === "file") return node;
  for (const child of sortedChildren(node)) {
    const found = findFirstFile(child);
    if (found) return found;
  }
  return null;
}

function updateEditorMeta() {
  const lines = elements.editor.value ? elements.editor.value.split("\n").length : 1;
  elements.lineNumbers.textContent = Array.from({ length: lines }, (_, index) => index + 1).join("\n");
  elements.fileMeta.textContent = `${lines} L / ${elements.editor.value.length} C`;
}

function renderMessage(role, content = "") {
  const article = document.createElement("article");
  article.className = `message ${role}`;
  article.innerHTML = `<strong>${role}</strong><pre>${escapeHtml(content)}</pre>`;
  elements.agentLog.append(article);
  elements.agentLog.scrollTop = elements.agentLog.scrollHeight;

  const msgObj = { role, content, element: article.querySelector("pre") };
  state.messages.push(msgObj);
  return msgObj;
}

function renderFileTree() {
  const root = state.tree;
  elements.fileTree.innerHTML = "";
  if (!root) {
    elements.fileTree.innerHTML = '<div class="empty-state">Open a folder to begin.</div>';
    return;
  }
  elements.fileTree.append(renderTreeNode(root, true));
}

function renderTreeNode(node, isRoot = false) {
  if (node.type === "file") {
    const button = document.createElement("button");
    button.className = `file-item${node.path === state.activePath ? " active" : ""}`;
    button.innerHTML = `<span class="file-icon">${iconForFile(node.name)}</span><span class="file-label">${node.name}</span>`;
    button.addEventListener("click", () => openFile(node.path));
    return button;
  }

  const container = document.createElement("div");
  container.className = "tree-folder";
  if (isRoot) {
    const children = document.createElement("div");
    children.className = "tree-children";
    sortedChildren(node).forEach((child) => children.append(renderTreeNode(child)));
    container.append(children);
    return container;
  }

  const details = document.createElement("details");
  details.open = state.expanded.has(node.path);
  details.addEventListener("toggle", () => {
    if (details.open) state.expanded.add(node.path);
    else state.expanded.delete(node.path);
  });

  const summary = document.createElement("summary");
  summary.className = "folder-summary";
  summary.innerHTML = `<span class="folder-icon">▸</span><span class="file-label">${node.name}</span>`;
  details.append(summary);

  const children = document.createElement("div");
  children.className = "tree-children";
  sortedChildren(node).forEach((child) => children.append(renderTreeNode(child)));
  details.append(children);
  container.append(details);
  return container;
}

async function openFolder() {
  const folder = await window.workspace.openFolder();
  if (!folder) return;
  state.rootPath = folder.path;
  elements.rootPath.textContent = folder.path;
  state.tree = folder.tree;
  state.fileCache.clear();
  state.expanded = new Set();
  renderFileTree();
  const first = findFirstFile(state.tree);
  if (first) await openFile(first.path, { quiet: true });
}

async function openFile(path, options = {}) {
  if (!path) return;
  const content = await window.workspace.readFile(path);
  state.activePath = path;
  state.activeContent = content;
  state.fileCache.set(path, content);
  elements.activeFileName.textContent = path.split(/[\\/]/).pop() || path;
  elements.editor.value = content;
  state.dirty = false;
  updateEditorMeta();
  renderFileTree();
  if (!options.quiet) setStatus(`Opened ${path}`);
}

async function saveCurrentFile() {
  if (!state.activePath) return;
  const content = elements.editor.value;
  await window.workspace.writeFile(state.activePath, content);
  state.fileCache.set(state.activePath, content);
  state.activeContent = content;
  state.dirty = false;
  setStatus(`Saved ${state.activePath}`);
}

function onEditorChange() {
  state.dirty = true;
  updateEditorMeta();
  setStatus(`Unsaved changes...`);
}

async function refreshWorkspace(preferredPath = "") {
  if (!state.rootPath) return;
  const folder = await window.workspace.readTree(state.rootPath);
  state.tree = folder.tree;
  renderFileTree();
}

async function buildWorkspaceContext(prompt) {
  if (!state.tree) return "";
  const files = flattenFiles(state.tree);
  const picked = [];
  if (state.activePath) {
    const active = files.find((f) => f.path === state.activePath);
    if (active) picked.push(active);
  }
  for (const f of files) {
    if (picked.length >= MAX_CONTEXT_FILES) break;
    if (!picked.find((p) => p.path === f.path)) picked.push(f);
  }

  const chunks = [];
  let totalChars = 0;
  for (const f of picked) {
    let content = state.fileCache.get(f.path) || (await window.workspace.readFile(f.path));
    const clipped = content.length > MAX_FILE_CHARS ? `${content.slice(0, MAX_FILE_CHARS)}\n... [truncated]` : content;
    const block = `FILE: ${f.relativePath || f.path}\n\`\`\`\n${clipped}\n\`\`\``;
    if (totalChars + block.length > MAX_CONTEXT_CHARS) break;
    chunks.push(block);
    totalChars += block.length;
  }
  return chunks.join("\n\n");
}

function buildSystemPrompt() {
  return `You are a professional coding assistant. Use JSON tool blocks for edits:
\`\`\`json
{ "actions": [{ "type": "write_file", "path": "path", "content": "..." }] }
\`\`\``;
}

async function sendMessage(event) {
  event.preventDefault();
  const prompt = elements.promptInput.value.trim();
  if (!prompt) return;

  elements.promptInput.value = "";
  renderMessage("user", prompt);
  elements.sendButton.style.display = "none";
  elements.thinkingIndicator.classList.add("active");
  setStatus("Agent is working...");

  const endpoint = elements.endpointInput.value.trim();
  const model = elements.modelInput.value.trim();
  const context = await buildWorkspaceContext(prompt);

  state.currentAgentMessage = renderMessage("agent", "");

  const payload = {
    model,
    temperature: 0.1,
    stream: true,
    messages: [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: `Context:\n${context}\n\nTask: ${prompt}` },
    ],
  };

  try {
    const res = await window.workspace.chatWithLlm(endpoint, payload);
    if (!res.ok && res.status !== -1) throw new Error(res.body);
  } catch (error) {
    renderMessage("system", `Error: ${error.message}`);
    state.currentAgentMessage = null;
    restoreComposerState();
  } finally {
    if (!state.currentAgentMessage) restoreComposerState();
  }
}

async function applyAgentActions(content) {
  if (!elements.agentMode.checked) return;
  const blocks = [...content.matchAll(/```json\s*([\s\S]*?)```/gi)];
  let applied = 0;
  for (const b of blocks) {
    try {
      const parsed = JSON.parse(b[1]);
      for (const a of parsed.actions || []) {
        if (a.type === "write_file") {
          const fullPath = (await window.workspace.resolvePath(state.rootPath, a.path));
          await window.workspace.writeFile(fullPath, a.content);
          state.fileCache.set(fullPath, a.content);
          applied++;
        }
      }
    } catch {}
  }
  if (applied > 0) {
    await refreshWorkspace();
    setStatus(`Applied ${applied} edits.`);
  }
}

function wireEvents() {
  elements.openFolderButton.addEventListener("click", openFolder);
  elements.saveButton.addEventListener("click", saveCurrentFile);
  elements.refreshButton.addEventListener("click", () => refreshWorkspace());
  elements.chatForm.addEventListener("submit", sendMessage);
  elements.editor.addEventListener("input", onEditorChange);
  elements.stopButton.addEventListener("click", () => window.workspace.abortChat());
  
  elements.settingsToggle.addEventListener("click", () => {
    elements.settingsContent.classList.toggle("open");
    elements.settingsToggle.querySelector("span:last-child").textContent = 
      elements.settingsContent.classList.contains("open") ? "▲" : "▼";
  });

  window.workspace.onStreamChunk((chunk) => {
    if (state.currentAgentMessage) {
      state.currentAgentMessage.content += chunk;
      state.currentAgentMessage.element.textContent = state.currentAgentMessage.content;
      elements.agentLog.scrollTop = elements.agentLog.scrollHeight;
    }
  });

  window.workspace.onStreamDone(async () => {
    const finalContent = state.currentAgentMessage?.content || "";
    restoreComposerState();
    state.currentAgentMessage = null;
    await applyAgentActions(finalContent);
  });
}

async function bootstrap() {
  wireEvents();
  renderFileTree();
  updateEditorMeta();
  const last = await window.workspace.getLastFolder();
  if (last) {
    state.rootPath = last.path;
    elements.rootPath.textContent = last.path;
    state.tree = last.tree;
    renderFileTree();
    const first = findFirstFile(state.tree);
    if (first) await openFile(first.path, { quiet: true });
  }
}

bootstrap().catch(console.error);
