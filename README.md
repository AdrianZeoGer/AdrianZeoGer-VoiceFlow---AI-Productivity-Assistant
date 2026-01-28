# VoiceFlow — AI Productivity Assistant (Tauri + Groq)

**The hook:** Turn voice into polished, context-aware output and paste it directly where you work — saving hours of typing, rewriting, and follow-up.

## What it is
VoiceFlow is a lightweight desktop “voice-to-workflow” tool. Record a short instruction, optionally pull in clipboard context, generate a structured result, and (optionally) **magic-paste** it into the currently active app (Mail, Slack, Docs, etc.).

## Key Features

- **Context Awareness (Clipboard)**
  - “Context Reply” mode reads your clipboard and drafts replies/edits based on it.

- **Smart Modes**
  - **Standard**: clean notes + strict grammar polish  
  - **Meeting Minutes**: summary, decisions, and action items  
  - **To‑Do Extractor**: turns speech into a checkbox checklist  

- **Strict Grammar Enforcement (Hochdeutsch)**
  - Global rule: correct grammar *in every mode*, including case usage (e.g. Genitive: “wegen **des** …”).

- **Magic Paste**
  - “Direct Paste” hides the window and injects the result into the active application.

- **Desktop UX**
  - **System tray icon** (runs in the background)
  - **Shift + Space** global hotkey toggles the window visibility
  - Close button **hides** the app instead of quitting

## Winning Stack

- **Tauri v2** (Rust) — native tray, global hotkey, clipboard + input injection commands
- **Next.js 15** + **React 19** — UI and workflow logic
- **Groq (OpenAI-compatible API)** — blazing-fast Llama 3 for formatting + workflow output, and Whisper for transcription

## Demo Flows (Hackathon-friendly)

### Context Reply (Clipboard → Reply)
1. Copy an email/chat message.
2. Select **Mode: Context Reply**.
3. Record: “Antworte freundlich und schlage nächste Schritte vor.”
4. Enable **Direct Paste** to paste the response straight into your chat/email editor.

### Meeting Minutes (Voice → Protocol)
1. Select **Mode: Meeting Minutes**.
2. Record a short meeting recap.
3. Get structured minutes: Summary, Decisions, Action Items.

### To‑Do Extractor (Voice → Checklist)
1. Select **Mode: To‑Do Extractor**.
2. Record: “Heute: Kunden anrufen, Angebot schicken, Rechnung prüfen …”
3. Receive a clean markdown checklist (ready to paste).

## Installation (Windows / macOS / Linux)

### Prerequisites
- **Node.js** (recommended: latest LTS)
- **Rust toolchain** (via `rustup`)
- Tauri prerequisites for your OS (WebView2 on Windows, etc.)

### Setup
1. Install JS dependencies:

```bash
npm install
```

2. Create `.env.local` (Groq):
   - Copy `.env.local.example` → `.env.local`
   - Replace `YOUR_GROQ_API_KEY` with your real key

**Example**

```bash
NEXT_PUBLIC_OPENAI_API_KEY=YOUR_GROQ_API_KEY
NEXT_PUBLIC_OPENAI_BASE_URL=https://api.groq.com/openai/v1
NEXT_PUBLIC_LLM_MODEL=llama-3.3-70b-versatile
NEXT_PUBLIC_WHISPER_MODEL=whisper-large-v3-turbo
NEXT_PUBLIC_WHISPER_LANGUAGE=de
```

3. Run the desktop app:

```bash
npm run tauri dev
```

## Architecture (How it works)

### Frontend (Next.js / React)
- UI lives in `src/app/page.tsx`
- The app records audio in the browser runtime (MediaRecorder), transcribes it, and runs the selected workflow mode.

### AI Service (Groq via OpenAI-compatible SDK)
- `src/services/ai.ts` calls:
  - `/audio/transcriptions` for speech-to-text
  - `/chat/completions` for workflow output
- The system prompt is generated per mode **but always includes the global Hochdeutsch grammar rule**.

### Backend (Tauri / Rust)
- `src-tauri/src/lib.rs` provides OS-level integration:
  - **Tray icon** + quit menu
  - **Shift + Space** global shortcut toggles window visibility
  - Close button hides the window (keeps app running)
  - Tauri commands:
    - `get_clipboard_content` → read text clipboard (Context Reply)
    - `inject_text` → hide window and paste into active app (Magic Paste)

### Frontend ↔ Backend Bridge
- The React UI calls Rust commands through Tauri IPC:
  - `invoke("get_clipboard_content")`
  - `invoke("inject_text", { text })`

## Notes / Limitations
- **Direct Paste** relies on OS input simulation and may require accessibility/input permissions on some systems.
- Clipboard-based flows only work with **text** clipboard content.

## Project Name Ideas
If you want alternatives to “VoiceFlow”:
- **PastePilot**
- **Speak2Ship**
- **ClipReply**

# Voice Prod — Voice-driven desktop productivity

Record audio, transcribe with Whisper, and enrich with AI (summaries, to-dos).  
Built with **Tauri v2**, **Next.js** (App Router), **Tailwind**, **shadcn/ui**, and **OpenAI SDK** (configurable for Groq).

## Quick start

1. **Install deps**
   ```bash
   cd voice-prod-tool && npm install
   ```

2. **Configure API**
   - Copy `.env.local.example` to `.env.local`
   - Set `NEXT_PUBLIC_OPENAI_API_KEY` (or `NEXT_PUBLIC_OPENAI_BASE_URL` + `NEXT_PUBLIC_GROQ_API_KEY` for Groq)

3. **Run**
   ```bash
   npm run tauri dev
   ```

- **Global hotkey:** `Alt+Space` — toggles recording or brings the window to focus.  
- **Microphone:** Uses the browser `getUserMedia`; grant mic access when prompted.

## Structure

- `src/app/` — Next.js App Router (page, layout, globals)
- `src/components/ui/` — shadcn-style: Card, Button, Tabs, Textarea
- `src/hooks/useAudioRecorder.ts` — MediaRecorder-based recording
- `src/services/ai.ts` — Whisper transcription + LLM enrichment (OpenAI/Groq)
- `src-tauri/` — Tauri v2 (Rust): global shortcut `Alt+Space`, emits `hotkey-triggered`, focus window

## Groq

In `.env.local`:

```env
NEXT_PUBLIC_OPENAI_BASE_URL=https://api.groq.com/openai/v1
NEXT_PUBLIC_GROQ_API_KEY=gsk_...
NEXT_PUBLIC_LLM_MODEL=llama-3.1-70b-versatile
```

Whisper-like transcription depends on Groq’s compatibility; otherwise keep `NEXT_PUBLIC_OPENAI_API_KEY` for Whisper and use Groq only for the LLM by adjusting `ai.ts` if needed.

## Build

```bash
npm run build
npm run tauri build
```

Icons: set `bundle.icon` in `src-tauri/tauri.conf.json` or run `npm run tauri icon path/to/icon.png` before building.
