"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Mic, Square, Loader2, MicOff } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useTheme } from "next-themes";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import {
  enrichTranscription,
  transcribeAudio,
  type LanguageSelection,
  type ProcessingMode,
  type SupportedLanguageCode,
} from "@/services/ai";
import { useLanguage } from "@/components/language-provider";

export default function Home() {
  const { state, audioBlob, error, startRecording, stopRecording, reset } = useAudioRecorder();
  const { t, uiLanguage, setUiLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [transcription, setTranscription] = useState("");
  const [enriched, setEnriched] = useState("");
  const [processing, setProcessing] = useState(false);
  const [languageCode, setLanguageCode] = useState<SupportedLanguageCode>("de");
  const [processingMode, setProcessingMode] = useState<ProcessingMode>("standard");
  const [directPaste, setDirectPaste] = useState(false);

  const languages: LanguageSelection[] = useMemo(
    () => [
      { code: "auto", label: "Auto-detect" },
      { code: "de", label: "Deutsch" },
      { code: "en", label: "English" },
      { code: "fr", label: "Français" },
      { code: "es", label: "Español" },
      { code: "it", label: "Italiano" },
      { code: "pt", label: "Português" },
      { code: "nl", label: "Nederlands" },
      { code: "pl", label: "Polski" },
      { code: "tr", label: "Türkçe" },
      { code: "ru", label: "Русский" },
      { code: "ar", label: "العربية" },
      { code: "hi", label: "हिन्दी" },
      { code: "ja", label: "日本語" },
      { code: "ko", label: "한국어" },
      { code: "zh", label: "中文" },
    ],
    []
  );

  const selectedLanguageLabel = useMemo(() => {
    return languages.find((l) => l.code === languageCode)?.label || "Deutsch";
  }, [languageCode, languages]);

  useEffect(() => {
    // Persist user preference
    try {
      const saved = localStorage.getItem("voice-prod-language");
      if (saved) setLanguageCode(saved as SupportedLanguageCode);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("voice-prod-language", languageCode);
    } catch {}
  }, [languageCode]);

  useEffect(() => {
    try {
      const savedMode = localStorage.getItem("voice-prod-mode");
      if (savedMode) setProcessingMode(savedMode as ProcessingMode);
      const savedPaste = localStorage.getItem("voice-prod-direct-paste");
      if (savedPaste) setDirectPaste(savedPaste === "true");
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("voice-prod-mode", processingMode);
      localStorage.setItem("voice-prod-direct-paste", String(directPaste));
    } catch {}
  }, [processingMode, directPaste]);

  const processRecording = useCallback(async (blob: Blob) => {
    setProcessing(true);
    setTranscription("");
    setEnriched("");
    try {
      const text = await transcribeAudio(blob, { languageCode });
      setTranscription(text || "(No speech detected)");
      let clipboardContext = "";
      if (processingMode === "context_reply") {
        try {
          clipboardContext = await invoke<string>("get_clipboard_content");
          // Keep it reasonable for prompting.
          if (clipboardContext.length > 12000) clipboardContext = clipboardContext.slice(0, 12000);
        } catch {
          clipboardContext = "";
        }
      }

      const formatted = await enrichTranscription(text || "", {
        languageLabel: selectedLanguageLabel,
        mode: processingMode,
        clipboardContext,
        directPaste,
      });
      setEnriched(formatted);

      if (directPaste) {
        // Hide window so the user's target app receives the paste.
        try {
          const win = getCurrentWebviewWindow();
          await win.hide();
        } catch {}
        try {
          await invoke("inject_text", { text: formatted });
          // After pasting, reset UI for the next run.
          reset();
          setTranscription("");
          setEnriched("");
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Paste failed";
          setTranscription(`Error: ${msg}`);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "AI error";
      setTranscription(`Error: ${msg}`);
      setEnriched("");
    } finally {
      setProcessing(false);
    }
  }, [directPaste, languageCode, processingMode, reset, selectedLanguageLabel]);

  useEffect(() => {
    if (audioBlob && state === "stopped") {
      processRecording(audioBlob);
    }
  }, [audioBlob, state, processRecording]);

  // Global hotkey: Shift+Space (emitted from Tauri)
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen("hotkey-triggered", () => {
      if (state === "recording") {
        stopRecording();
      } else if (state === "idle") {
        startRecording();
      }
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => {});

    return () => {
      unlisten?.();
    };
  }, [state, startRecording, stopRecording]);

  const handleToggleRecord = () => {
    if (state === "recording") {
      stopRecording();
    } else if (state === "idle") {
      startRecording();
    }
  };

  const handleReset = () => {
    reset();
    setTranscription("");
    setEnriched("");
  };

  const hasResult = Boolean(transcription || enriched);
  const showResult = hasResult && !processing;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <Card className="w-full max-w-2xl border-border bg-card">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-6">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <img
                src="/LogoVoiceFlow.ico"
                alt="VoiceFlow"
                className="h-24 w-24 shrink-0 object-contain drop-shadow-md"
              />
              <div className="min-w-0 flex-1">
                <CardTitle className="text-2xl font-semibold">{t("appTitle")}</CardTitle>
                <CardDescription className="mt-1">
                  {t("recordHint")}{" "}
                  <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">Shift+Space</kbd>.{" "}
                  {t("appSubtitle")}
                </CardDescription>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <select
                value={uiLanguage}
                onChange={(e) => setUiLanguage(e.target.value as "de" | "en")}
                className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                aria-label={t("uiLanguageToggle")}
              >
                <option value="de">DE</option>
                <option value="en">EN</option>
              </select>

              <select
                value={theme || "dark"}
                onChange={(e) => setTheme(e.target.value)}
                className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                aria-label={t("theme")}
              >
                <option value="dark">{t("themeDark")}</option>
                <option value="light">{t("themeLight")}</option>
                <option value="colorful">{t("themeColorful")}</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3 rounded-md border border-border p-4">
            <div className="text-sm font-medium">{t("workflowSettings")}</div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label className="text-xs text-muted-foreground">{t("mode")}</label>
                <select
                  value={processingMode}
                  onChange={(e) => {
                    const next = e.target.value as ProcessingMode;
                    setProcessingMode(next);
                    if (next === "meeting_minutes") {
                      // Requirement: warning/alert dialog for this mode.
                      window.alert(t("meetingMinutesWarning"));
                    }
                  }}
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  aria-label="Processing Mode"
                  disabled={processing || state === "recording"}
                >
                  <option value="standard">{t("modeStandard")}</option>
                  <option value="context_reply">{t("modeContextReply")}</option>
                  <option value="meeting_minutes">{t("modeMeetingMinutes")}</option>
                  <option value="todo_extractor">{t("modeTodoExtractor")}</option>
                  <option value="scientific_work">{t("modeScientificWork")}</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs text-muted-foreground">{t("language")}</label>
                <select
                  value={languageCode}
                  onChange={(e) => setLanguageCode(e.target.value as SupportedLanguageCode)}
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  aria-label="Language"
                  disabled={processing || state === "recording"}
                >
                  {languages.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={directPaste}
                onChange={(e) => setDirectPaste(e.target.checked)}
                disabled={processing || state === "recording"}
              />
              <span className="font-medium">{t("directPaste")}</span>
              <span className="text-xs text-muted-foreground">{t("directPasteHint")}</span>
            </label>

            <p className="text-xs text-muted-foreground">
              {t("outputOptimizedFor")} <span className="font-medium">{selectedLanguageLabel}</span>.
              {processingMode === "context_reply" && ` ${t("contextReplyClipboardHint")}`}
            </p>
          </div>

          {/* Idle / Recording */}
          {!showResult && (
            <div className="flex flex-col items-center gap-4">
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              {state === "idle" && !processing && (
                <Button
                  size="lg"
                  onClick={handleToggleRecord}
                  className="gap-2"
                >
                  <Mic className="h-5 w-5" />
                  {t("startRecording")}
                </Button>
              )}

              {state === "recording" && (
                <div className="flex flex-col items-center gap-4">
                  <div
                    className="h-4 w-4 rounded-full bg-destructive animate-pulse-recording"
                    aria-label="Recording"
                  />
                  <p className="text-sm text-muted-foreground">{t("recording")}</p>
                  <Button
                    variant="destructive"
                    size="lg"
                    onClick={handleToggleRecord}
                    className="gap-2"
                  >
                    <Square className="h-4 w-4" />
                    {t("stop")}
                  </Button>
                </div>
              )}

              {processing && (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">{t("transcribing")}</p>
                </div>
              )}
            </div>
          )}

          {/* Result: Tabs */}
          {showResult && (
            <div className="space-y-4">
              <Tabs defaultValue="transcription" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="transcription">{t("transcriptionTab")}</TabsTrigger>
                  <TabsTrigger value="enriched">{t("aiOutputTab")}</TabsTrigger>
                </TabsList>
                <TabsContent value="transcription">
                  <Textarea
                    readOnly
                    value={transcription}
                    className="min-h-[200px] font-mono text-sm"
                  />
                </TabsContent>
                <TabsContent value="enriched">
                  <Textarea
                    readOnly
                    value={enriched}
                    className="min-h-[200px] font-mono text-sm whitespace-pre-wrap"
                  />
                </TabsContent>
              </Tabs>
              <div className="flex justify-end">
                <Button variant="outline" onClick={handleReset} className="gap-2">
                  <MicOff className="h-4 w-4" />
                  {t("newRecording")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
        <footer className="border-t border-border px-6 py-4 text-center">
          <p className="text-xs text-muted-foreground">
            VoiceFlow © 2026 Created by Adrian Arvid Zedler
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Max-Liebermann-Straße 138, 04157 Leipzig, Germany
          </p>
        </footer>
      </Card>
    </main>
  );
}
