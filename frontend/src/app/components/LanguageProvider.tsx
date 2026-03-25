/**
 * LanguageProvider.tsx
 *
 * Global language context for the entire TrustLens application.
 * Works exactly like ThemeProvider (next-themes) — wrap the app once,
 * call useLanguage() anywhere to get the current language and toggle it.
 *
 * Persistence: language preference is stored in localStorage under the key
 * "trustlens-language" so it survives page refreshes and persists across
 * all pages until the user explicitly toggles it again.
 *
 * Supported languages:
 *   "en" — English (default)
 *   "ms" — Bahasa Malaysia
 */

import React, { createContext, useContext, useEffect, useState } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────────
export type Language = "en" | "ms";

interface LanguageContextValue {
  /** Currently active language */
  language: Language;
  /** Toggle between "en" and "ms" */
  toggleLanguage: () => void;
  /** Explicitly set a language */
  setLanguage: (lang: Language) => void;
}

// ─── Context ───────────────────────────────────────────────────────────────────
const LanguageContext = createContext<LanguageContextValue>({
  language: "en",
  toggleLanguage: () => {},
  setLanguage: () => {},
});

// ─── Storage key ───────────────────────────────────────────────────────────────
const STORAGE_KEY = "trustlens-language";

// ─── Provider ─────────────────────────────────────────────────────────────────
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    // Initialise from localStorage on first render
    const stored = localStorage.getItem(STORAGE_KEY);
    return (stored === "ms" ? "ms" : "en") as Language;
  });

  // Persist to localStorage whenever the language changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, language);
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const toggleLanguage = () => {
    setLanguageState(prev => (prev === "en" ? "ms" : "en"));
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────────────────────────
/**
 * useLanguage()
 *
 * Call this in any component to access the global language state.
 *
 * @example
 * const { language, toggleLanguage } = useLanguage();
 * return <button onClick={toggleLanguage}>{language === "en" ? "BM" : "EN"}</button>
 */
export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
