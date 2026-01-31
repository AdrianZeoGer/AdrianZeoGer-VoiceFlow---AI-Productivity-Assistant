import OpenAI from "openai";

const getBaseURL = () => {
  const url = process.env.NEXT_PUBLIC_OPENAI_BASE_URL;
  if (url) return url;
  return undefined; // uses OpenAI default
};

const getApiKey = () => {
  return process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY || "";
};

function createClient() {
  const apiKey = getApiKey();
  const baseURL = getBaseURL();
  if (!apiKey) {
    throw new Error("Missing NEXT_PUBLIC_OPENAI_API_KEY or NEXT_PUBLIC_GROQ_API_KEY in .env.local");
  }
  return new OpenAI({
    apiKey,
    baseURL,
    dangerouslyAllowBrowser: true,
  });
}

async function getAudioStats(blob: Blob): Promise<{ durationSec: number; rms: number } | null> {
  // Best-effort: if decoding fails (codec unsupported), we just skip stats.
  try {
    const arrayBuf = await blob.arrayBuffer();
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const audioBuf = await audioCtx.decodeAudioData(arrayBuf.slice(0));
    const channel0 = audioBuf.getChannelData(0);

    // Compute RMS (root-mean-square) amplitude for quick "is this basically silence?" detection.
    let sumSq = 0;
    for (let i = 0; i < channel0.length; i++) sumSq += channel0[i] * channel0[i];
    const rms = Math.sqrt(sumSq / Math.max(1, channel0.length));

    // Close context to avoid leaking audio threads.
    await audioCtx.close().catch(() => {});

    return { durationSec: audioBuf.duration, rms };
  } catch {
    return null;
  }
}

function isLikelyHallucination(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return true;
  // Common whisper "garbage" outputs when audio is silence/invalid.
  return t === "thank you." || t === "thank you" || t === "vielen dank." || t === "vielen dank";
}

const GLOBAL_GRAMMAR_RULE =
  "CRITICAL INSTRUCTION: Regardless of the output format, you MUST correct all grammatical errors in the input. Use high-standard German ('Hochdeutsch'). Specifically, pay attention to case usage (e.g., strictly use Genitive 'wegen des' instead of Dative 'wegen dem'). Ensure punctuation and sentence structure are perfect.";

export type SupportedLanguageCode =
  | "auto"
  | "de"
  | "en"
  | "fr"
  | "es"
  | "it"
  | "pt"
  | "nl"
  | "pl"
  | "tr"
  | "sv"
  | "no"
  | "da"
  | "fi"
  | "cs"
  | "sk"
  | "hu"
  | "ro"
  | "bg"
  | "ru"
  | "uk"
  | "el"
  | "ar"
  | "he"
  | "hi"
  | "id"
  | "ms"
  | "vi"
  | "th"
  | "ja"
  | "ko"
  | "zh";

export type LanguageSelection = {
  code: SupportedLanguageCode;
  label: string;
};

export type TranscribeOptions = {
  languageCode?: SupportedLanguageCode; // "auto" or ISO 639-1
};

export type EnrichOptions = {
  languageLabel?: string; // human-friendly label (e.g. "Deutsch")
  mode?: ProcessingMode;
  clipboardContext?: string;
  directPaste?: boolean;
};

export type ProcessingMode =
  | "standard"
  | "context_reply"
  | "meeting_minutes"
  | "todo_extractor"
  | "scientific_work";

/**
 * Transcribe audio using Whisper (or Groq-compatible endpoint when base URL is set).
 */
export async function transcribeAudio(blob: Blob, opts: TranscribeOptions = {}): Promise<string> {
  const openai = createClient();

  // Validate audio blob
  if (!blob || blob.size < 2000) {
    throw new Error(`Audio too short or empty (${blob?.size || 0} bytes). Please record for longer.`);
  }

  const file = new File([blob], "audio.webm", { type: blob.type || "audio/webm" });

  const configuredModel = process.env.NEXT_PUBLIC_WHISPER_MODEL || "whisper-1";
  const configuredLanguage = process.env.NEXT_PUBLIC_WHISPER_LANGUAGE; // e.g., "de", "en" or unset for auto
  const selectedLanguage =
    opts.languageCode && opts.languageCode !== "auto" ? opts.languageCode : configuredLanguage;

  // If we can decode the audio, detect near-silence and fail fast (prevents hallucinations).
  const stats = await getAudioStats(blob);
  if (stats) {
    // These thresholds are intentionally conservative.
    if (stats.durationSec < 0.25) {
      throw new Error("Recording is too short. Please record at least 1–2 seconds of speech.");
    }
    if (stats.rms < 0.003) {
      throw new Error("No audible speech detected (recording is near-silent). Check mic input/volume.");
    }
  }

  // Attempt 1: configured settings (usually what you want)
  const attempt1 = await openai.audio.transcriptions.create({
    file,
    model: configuredModel,
    response_format: "json",
    temperature: 0,
    ...(selectedLanguage ? { language: selectedLanguage } : {}),
  });
  const text1 = attempt1.text || "";
  if (!isLikelyHallucination(text1)) return text1;

  // Attempt 2: safer fallback (auto-language + turbo / large swap)
  const fallbackModel =
    configuredModel === "whisper-large-v3" ? "whisper-large-v3-turbo" : "whisper-large-v3";
  const attempt2 = await openai.audio.transcriptions.create({
    file,
    model: fallbackModel,
    response_format: "json",
    temperature: 0,
  });
  const text2 = attempt2.text || "";
  return text2;
}

/**
 * Enrich transcribed text: summarization, to-dos, formatting.
 * Uses the configured model (OpenAI or Groq via base URL).
 */
export async function enrichTranscription(text: string, opts: EnrichOptions = {}): Promise<string> {
  const openai = createClient();

  const model = process.env.NEXT_PUBLIC_LLM_MODEL || "gpt-4o-mini";
  const languageLabel = opts.languageLabel?.trim() || "the user's language";
  const mode: ProcessingMode = opts.mode || "standard";
  const clipboardContext = (opts.clipboardContext || "").trim();
  const directPaste = Boolean(opts.directPaste);

  const pasteInstruction = directPaste
    ? "Output must be ready to paste into another app: no preamble, no meta-commentary, no code fences."
    : "Be concise and helpful.";

  let taskInstruction = "";
  switch (mode) {
    case "standard":
      taskInstruction =
        "Task: rewrite the transcription with correct grammar, spelling, and punctuation. Preserve meaning and tone. Do not add new information.";
      break;
    case "context_reply":
      taskInstruction =
        "Task: use the clipboard text as context and the voice instruction to produce the appropriate response or perform the requested transformation. If the user asks to reply, draft the reply. If the user asks to edit/transform the clipboard, output the transformed text.";
      break;
    case "meeting_minutes":
      taskInstruction =
        "Task: produce meeting minutes in markdown with clear headings: Summary, Speakers/Participants (if inferable), Decisions, Action Items (checkbox list), Notes. Be robust to imperfect transcripts.";
      break;
    case "todo_extractor":
      taskInstruction =
        "Task: extract actionable to-dos and output a markdown checklist. If none, output: \"No action items.\"";
      break;
    case "scientific_work":
      taskInstruction = `You are an academic editor for a Bachelor's thesis. The user will dictate thoughts via stream-of-consciousness. They may stutter, repeat themselves, or speak colloquially.

YOUR TASK: Extract the core arguments and factual content. Reformulate them into precise, high-level academic German ('Wissenschaftssprache') as if you are the author writing the thesis directly.

PERSPECTIVE: Write directly as the author. Do NOT use phrases like 'The user says', 'The author states', 'The author intends to', or any meta-reference to the speaker. The output must read as the thesis text itself.

CONTEXT AWARENESS: Match the type of content. If the input is an argument or claim, formulate it as the argument. If it is a methodology description, write it as the methodology section. If it is a result or finding, write it as the results section. Adapt structure and register accordingly.

TONE: Maintain strict academic 'Nominalstil' (noun-heavy style) and passive voice where appropriate, but ensure the text flows naturally as part of a thesis chapter—not as a summary about the text.

RULES:
1. Use Nominalstil and passive voice where appropriate for academic texts.
2. Strictly NO filler words.
3. DO NOT invent new facts. Only structure and reformulate the user's thoughts.
4. If the user says 'write this down' or similar, ignore the command and output only the content.
5. Output format: A clean, coherent paragraph ready to be pasted into LaTeX or Word.

EXAMPLE:
- Input: "I asked 50 people."
- Bad: "The author states that 50 people were asked."
- Good: "An empirical survey of 50 subjects was conducted."`;
      break;
    default:
      taskInstruction = "Task: produce a clean, structured output.";
  }

  const systemPrompt = `${GLOBAL_GRAMMAR_RULE}

You are a highly capable productivity assistant who writes naturally in ${languageLabel}.
${pasteInstruction}
${taskInstruction}`;

  const userContent =
    mode === "context_reply"
      ? `Here is the text from my clipboard:\n\n${clipboardContext || "(clipboard is empty)"}\n\nMy voice instruction is:\n\n${text}`
      : text;

  const response = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: userContent,
      },
    ],
    temperature: 0.3,
  });

  const choice = response.choices?.[0];
  if (!choice?.message?.content) {
    throw new Error("No enrichment response from AI");
  }
  return choice.message.content;
}
