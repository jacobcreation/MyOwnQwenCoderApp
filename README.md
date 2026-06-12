# Qwen Agent Coder Studio

Qwen Agent Coder Studio is a lightweight desktop-style application that integrates **LM Studio local models** into an **agentic coding environment**, enabling autonomous code generation, file editing, and multi-step reasoning workflows.

It is designed for developers who want to turn local LLMs into practical coding agents—without relying on cloud APIs.

---

## 🚀 Features

- 🔌 **LM Studio Integration**  
  Connect directly to your local LM Studio server (OpenAI-compatible API)

- 🤖 **Agentic Coding Loop**  
  Models can plan, write, review, and refine code iteratively

- 📁 **Project Workspace Support**  
  Work with real project folders and file trees

- 🧠 **Multi-step reasoning**  
  Break complex coding tasks into structured steps

- ✏️ **File Editing Capabilities**  
  Read, modify, and generate project files

- 💬 **Chat + Command Interface**  
  Natural language coding assistant with tool execution support

- ⚡ **Multi-model Support**  
  Use Qwen Coder, DeepSeek Coder, CodeLlama, and other LM Studio models

---

## 🧠 Supported Models

Works with any **OpenAI-compatible model server**, especially:

- Qwen2.5-Coder / Qwen3-Coder
- DeepSeek-Coder / DeepSeek-Coder-V2
- CodeLlama
- StarCoder / StarCoder2
- Any GGUF model running in LM Studio

---

## 📦 Requirements

- LM Studio installed  
- Local server enabled (`http://localhost:1234/v1`)
- Node.js (or Electron runtime if packaged)
- At least 8GB RAM recommended (16GB ideal)

---

## ⚙️ Setup

### 1. Start LM Studio Server
Enable OpenAI-compatible API in LM Studio:

Settings → Developer → Enable Server

Default endpoint:
http://localhost:1234/v1

---

### 2. Clone Repository

```bash
git clone https://github.com/<repo>
cd <repo>
```

---

### 3. Install Dependencies

```bash
npm install
```

---

### 4. Run the App

```bash
npm start
```

---

## ⚙️ Configuration

Create a `.env` file:

```
LM_STUDIO_BASE_URL=http://localhost:1234/v1
MODEL_NAME=qwen2.5-coder
MAX_TOKENS=4096
TEMPERATURE=0.2
```

---

## 🧩 How It Works

1. User gives a coding task  
2. Agent breaks task into steps  
3. Model writes or modifies code  
4. System executes tool actions (read/write files)  
5. Model reviews output and refines  
6. Loop continues until completion

---

## 📁 Project Structure

```
qwen-agent-coder-studio/
│
├── src/
│   ├── agent/
│   ├── llm/
│   ├── workspace/
│   ├── ui/
│   └── utils/
│
├── config/
├── public/
├── .env
└── README.md
```

---

## ⚡ Example Use Cases

- Build full-stack apps from prompts
- Debug existing codebases
- Refactor large projects
- Generate boilerplate instantly
- Automate repetitive coding tasks

---

## 🧪 Roadmap

- [ ] Tool calling system (shell, git, browser simulation)
- [ ] Multi-agent collaboration
- [ ] Memory system for long projects
- [ ] VS Code extension version
- [ ] UI improvements (drag-drop workspace)
- [ ] Streaming agent execution logs

---

## ⚠️ Notes

- Performance depends heavily on your local model
- Larger models may require GPU acceleration
- Agentic loops can be CPU/RAM intensive

---

## 📜 License

MIT License

---

## 💡 Inspiration

Inspired by:
- OpenAI function calling agents
- AutoGPT / BabyAGI concepts
- LM Studio local inference workflows
- Developer-first AI tooling
