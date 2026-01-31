export type UiLanguage = "de" | "en";

export const STRINGS = {
  de: {
    appTitle: "VoiceFlow",
    appSubtitle: "Mit KI transkribieren & veredeln.",
    recordHint: "Aufnehmen mit Button oder",
    workflowSettings: "Workflow-Einstellungen",
    mode: "Modus",
    language: "Sprache",
    directPaste: "Direktes Einfügen",
    directPasteHint: "(Ergebnis automatisch in die aktive App einfügen)",
    outputOptimizedFor: "Ausgabe optimiert für",
    contextReplyClipboardHint: "„Kontext-Antwort“ liest deinen Zwischenablage-Text.",

    modeStandard: "Standard (Grammatik korrigieren)",
    modeContextReply: "Kontext-Antwort (Zwischenablage)",
    modeMeetingMinutes: "Meeting-Protokoll",
    modeTodoExtractor: "To-do-Extraktor",
    modeScientificWork: "Wissenschaftliche Arbeit",

    meetingMinutesWarning:
      "Hinweis: Das funktioniert am besten bei klaren Gesprächen mit 1–3 Sprecher:innen. Bei Überlappungen oder hitzigen Debatten kann die Qualität sinken.",

    startRecording: "Aufnahme starten",
    stop: "Stopp",
    recording: "Aufnahme läuft…",
    transcribing: "Transkribieren & Aufbereiten…",
    transcriptionTab: "Transkription",
    aiOutputTab: "KI-Ausgabe",
    newRecording: "Neue Aufnahme",

    theme: "Theme",
    themeDark: "Dark",
    themeLight: "Light",
    themeColorful: "Colorful",
    uiLanguageToggle: "UI-Sprache",
    startWithWindows: "Mit Windows starten",
  },
  en: {
    appTitle: "VoiceFlow",
    appSubtitle: "Transcribe & refine with AI.",
    recordHint: "Record with the button or",
    workflowSettings: "Workflow Settings",
    mode: "Mode",
    language: "Language",
    directPaste: "Direct Paste",
    directPasteHint: "(auto-paste result into your active app)",
    outputOptimizedFor: "Output optimized for",
    contextReplyClipboardHint: "Context Reply reads your clipboard text.",

    modeStandard: "Standard (Fix grammar)",
    modeContextReply: "Context Reply (uses clipboard)",
    modeMeetingMinutes: "Meeting Minutes",
    modeTodoExtractor: "To-Do Extractor",
    modeScientificWork: "Scientific Work",

    meetingMinutesWarning:
      "Note: This works best for clear conversations with 1-3 speakers. It may struggle with overlapping voices or heated debates.",

    startRecording: "Start recording",
    stop: "Stop",
    recording: "Recording…",
    transcribing: "Transcribing & enriching…",
    transcriptionTab: "Transcription",
    aiOutputTab: "AI output",
    newRecording: "New recording",

    theme: "Theme",
    themeDark: "Dark",
    themeLight: "Light",
    themeColorful: "Colorful",
    uiLanguageToggle: "UI Language",
    startWithWindows: "Start with Windows",
  },
} as const;

export type TranslationKey = keyof typeof STRINGS.en;

