/**
 * LanguageToggleButton.tsx
 *
 * Global language toggle — renders as a segmented "EN | BM" pill.
 * The active language segment is highlighted (blue on light, white on dark).
 * Clicking either segment switches the global language instantly.
 *
 * Uses useLanguage() from LanguageProvider — all instances stay in sync.
 *
 * Variants:
 *   "default" — light backgrounds (page headers, sidebars)
 *   "dark"    — dark backgrounds (Landing page nav)
 *   "ghost"   — minimal, for Sidebar bottom section
 */

import { useLanguage } from "./LanguageProvider";

type ButtonVariant = "default" | "dark" | "ghost";

interface LanguageToggleButtonProps {
  variant?: ButtonVariant;
  className?: string;
}

export function LanguageToggleButton({
  variant = "default",
  className = "",
}: LanguageToggleButtonProps) {
  const { language, setLanguage } = useLanguage();

  const containerClasses: Record<ButtonVariant, string> = {
    default:
      "inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden text-xs font-semibold",
    dark:
      "inline-flex items-center rounded-lg border border-white/20 overflow-hidden text-xs font-semibold",
    ghost:
      "inline-flex items-center rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden text-xs font-semibold",
  };

  const activeClasses: Record<ButtonVariant, string> = {
    default: "bg-blue-600 text-white",
    dark: "bg-white text-[#0B0F19]",
    ghost: "bg-blue-600 text-white",
  };

  const inactiveClasses: Record<ButtonVariant, string> = {
    default:
      "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50",
    dark: "text-white/70 hover:text-white hover:bg-white/10",
    ghost:
      "text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700/50",
  };

  const dividerClasses: Record<ButtonVariant, string> = {
    default: "border-slate-200 dark:border-slate-700",
    dark: "border-white/20",
    ghost: "border-gray-200 dark:border-slate-700",
  };

  return (
    <div
      className={`${containerClasses[variant]} ${className}`}
      title="Switch language / Tukar bahasa"
    >
      {/* EN segment */}
      <button
        onClick={() => setLanguage("en")}
        className={`px-2.5 py-1.5 transition-colors cursor-pointer ${
          language === "en" ? activeClasses[variant] : inactiveClasses[variant]
        }`}
      >
        EN
      </button>

      {/* Divider line */}
      <span className={`w-px h-4 border-l ${dividerClasses[variant]}`} />

      {/* BM segment */}
      <button
        onClick={() => setLanguage("ms")}
        className={`px-2.5 py-1.5 transition-colors cursor-pointer ${
          language === "ms" ? activeClasses[variant] : inactiveClasses[variant]
        }`}
      >
        BM
      </button>
    </div>
  );
}
