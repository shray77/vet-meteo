"use client";

import { useEffect } from "react";

interface KeyboardShortcutsProps {
  onOpenFilters?: () => void;
  onOpenCalculator?: () => void;
  onOpenAbout?: () => void;
  onOpenNearby?: () => void;
  onOpenSIR?: () => void;
  onResetFilters?: () => void;
  onToggleTheme?: () => void;
  onToggleTimelinePlay?: () => void;
  onOpenSearch?: () => void;
}

/**
 * Global keyboard shortcuts handler.
 *
 * Shortcuts:
 *   ?        — show about dialog (shortcut cheatsheet)
 *   f        — toggle mobile filters panel
 *   c        — open quarantine calculator
 *   n        — open "nearby outbreaks" dialog (geolocation)
 *   s        — open SIR simulator
 *   r        — reset all filters
 *   t        — toggle theme (light/dark/system)
 *   /        — focus search box (autocomplete)
 *   Space    — play/pause timeline slider
 *   d        — toggle disease profile drawer (last viewed)
 *   Esc      — close any open dialog/drawer
 */
export function useKeyboardShortcuts({
  onOpenFilters,
  onOpenCalculator,
  onOpenAbout,
  onOpenNearby,
  onOpenSIR,
  onResetFilters,
  onToggleTheme,
  onToggleTimelinePlay,
  onOpenSearch,
}: KeyboardShortcutsProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if user is typing
      const target = e.target as HTMLElement;
      if (target) {
        const tag = target.tagName.toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable) {
          // Only handle Escape in inputs
          if (e.key === "Escape") {
            (target as HTMLInputElement).blur();
          }
          return;
        }
      }

      // Skip if any modifier is pressed (except Space which we use without modifiers)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      switch (e.key.toLowerCase()) {
        case "?":
          e.preventDefault();
          onOpenAbout?.();
          break;
        case "f":
          e.preventDefault();
          onOpenFilters?.();
          break;
        case "c":
          e.preventDefault();
          onOpenCalculator?.();
          break;
        case "n":
          e.preventDefault();
          onOpenNearby?.();
          break;
        case "s":
          e.preventDefault();
          onOpenSIR?.();
          break;
        case "r":
          e.preventDefault();
          onResetFilters?.();
          break;
        case "t":
          e.preventDefault();
          onToggleTheme?.();
          break;
        case "/":
          e.preventDefault();
          // Try the registered search focus method first, fall back to DOM query
          const focusSearch = (window as unknown as { __focusVetSearch?: () => void }).__focusVetSearch;
          if (focusSearch) {
            focusSearch();
          } else {
            onOpenSearch?.();
          }
          break;
        case " ":
          // Space — toggle timeline play
          e.preventDefault();
          onToggleTimelinePlay?.();
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onOpenFilters, onOpenCalculator, onOpenAbout, onOpenNearby, onOpenSIR, onResetFilters, onToggleTheme, onToggleTimelinePlay, onOpenSearch]);
}
