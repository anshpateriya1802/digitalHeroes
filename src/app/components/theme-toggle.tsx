"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  localStorage.setItem("dh_theme", theme);
}

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const saved = localStorage.getItem("dh_theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const initial = getInitialTheme();
    setTheme(initial);
    applyTheme(initial);
    setReady(true);
  }, []);

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    applyTheme(next);
  }

  if (!ready) return null;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`theme-toggle-btn fixed right-4 bottom-4 z-50 inline-flex h-9 w-9 items-center justify-center rounded-full border text-base shadow-lg backdrop-blur-md transition-transform duration-200 ease-out hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 md:right-6 md:bottom-6 ${
        theme === "light"
          ? "border-[#0f1a20] bg-[#0f1a20] text-white hover:bg-[#1a2a33] focus-visible:ring-[#0f1a20]"
          : "keep-light-surface border-[var(--card-border)] bg-white text-[#0f1a20] hover:bg-[#f5f3ee] focus-visible:ring-[var(--card-border)]"
      }`}
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
    >
      <span aria-hidden="true" className="leading-none">{theme === "light" ? "☾" : "☀"}</span>
    </button>
  );
}
