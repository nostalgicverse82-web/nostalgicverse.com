# NostalgicVerse — Local Development & Preview Guide

A high-performance, zero-dependency digital museum architecture. Run the complete NostalgicVerse interactive archive locally on **Windows**, **macOS**, or **Linux** using standard Node.js built-ins.

---

## Prerequisites

- **Node.js**: `v18.0.0` or higher (tested on Node 18, 20, and 22 LTS).
- **External Dependencies**: **Zero** (`npm install` is not required).
- **Supported Browsers**: Chrome/Edge 100+, Safari 16+, Firefox 100+.

---

## Quick Start (Any Operating System)

Clone or navigate to the project directory in your terminal:

```bash
# Navigate to project root
cd /path/to/nostalgicverse1.com
```

### Option A: Standard npm Scripts (Recommended)

```bash
# Start canonical application server with REST APIs & background services (port 3000)
npm start

# Alternatively, run development mode
npm run dev

# Or launch minimal static preview server
npm run preview
```

### Option B: Direct Node.js Execution

```bash
# Windows (PowerShell / Command Prompt)
node server/index.cjs

# macOS / Linux (Terminal / zsh / bash)
node server/index.cjs
```

Open your browser and visit:  
👉 **[http://localhost:3000](http://localhost:3000)**

To stop the server at any time: press `Ctrl + C` (or `Cmd + C` on macOS).

---

## Cross-Platform Development Workflows

### 1. Visual Studio Code Workflow (Windows, macOS, Linux)
1. Open the repository root folder in VS Code:
   ```bash
   code .
   ```
2. Open the integrated terminal (`Ctrl + \`` or `Cmd + \``).
3. Run `npm start` or `npm test`.
4. Optionally install the **Live Preview** extension (`ms-vscode.live-server`) for instantaneous HTML previewing.

### 2. Port and Host Customization
You can configure the binding port and host via environment variables:

```bash
# Linux / macOS
PORT=8080 HOST=127.0.0.1 node server/index.cjs

# Windows (PowerShell)
$env:PORT="8080"; $env:HOST="127.0.0.1"; node server/index.cjs
```

---

## Validation & Test Suite Matrix

Run automated tests and validation audits directly from your terminal:

```bash
# Run master project audit (10,800+ automated assertions)
npm test

# Run full test battery (server, backend, QA, discovery, filters, favorites)
npm run test:all

# Validate data consistency across JSON records and exhibits
npm run audit

# Audit internal and external link integrity across 611 HTML documents
npm run audit:links

# Audit remote image URLs and header responses
npm run audit:media

# Audit console exhibit structure
npm run audit:consoles

# Audit responsive viewport & CSS rules
npm run audit:responsive
```

---

## Server Architecture & Routing

| Endpoint / Route | Handler | Purpose |
| :--- | :--- | :--- |
| `/` | Static exhibit | NostalgicVerse homepage with 9s rotating discovery |
| `/games/` | Static exhibit | 528-game archive with multi-select filter matrix |
| `/games/{slug}/` | Static exhibit | Individual game specimen exhibit with fallback plate |
| `/consoles/` | Static exhibit | 65 hardware generation archive |
| `/consoles/{slug}/` | Static exhibit | Individual console technical exhibit |
| `/search/?q=...` | Client-side engine | Instant query searching 744 entities |
| `/favorites/` | Client-side engine | Resilient client collection hydrated via registry |
| `/api/health` | REST API | Uptime, memory usage, catalog entity counts |
| `/api/content/games` | REST API | Filterable, paginated JSON feed of 528 games |
| `/api/content/consoles` | REST API | Generation and manufacturer filtered hardware |
| `/api/search?q=...` | REST API | Server-side entity search |
| `/api/news` | REST API | Published gaming history anniversary articles |
| `/api/internal/*` | Protected API | Ingestion, AI generation, and image monitoring (requires `X-Internal-Secret`) |
