"use client";

import * as React from "react";
import { STRINGS, type UiLanguage, type TranslationKey } from "@/lib/translations";

type LanguageContextValue = {
  uiLanguage: UiLanguage;
  setUiLanguage: (lang: UiLanguage) => void;
  t: (key: TranslationKey) => string;
};

const LanguageContext = React.createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [uiLanguage, setUiLanguage] = React.useState<UiLanguage>("de");

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem("voice-prod-ui-language");
      if (saved === "de" || saved === "en") setUiLanguage(saved);
    } catch {}
  }, []);

  React.useEffect(() => {
    try {
      localStorage.setItem("voice-prod-ui-language", uiLanguage);
      document.documentElement.lang = uiLanguage;
    } catch {}
  }, [uiLanguage]);

  const value = React.useMemo<LanguageContextValue>(() => {
    return {
      uiLanguage,
      setUiLanguage,
      t: (key) => STRINGS[uiLanguage][key],
    };
  }, [uiLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = React.useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}

