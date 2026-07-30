"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Deferred to an effect, not a lazy useState initializer, so the
    // server-rendered markup and the client's first render match (theme
    // depends on localStorage, unavailable during SSR) — same SSR-safe
    // deferral pattern as mandate/expiry-ring.tsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    const saved = localStorage.getItem("vitta-theme") as Theme | null;
    const resolved: Theme = saved === "dark" || saved === "light" ? saved : "light";
    setTheme(resolved);
    document.documentElement.classList.toggle("dark", resolved === "dark");
  }, []);

  const toggleTheme = () => {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("vitta-theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  // Before mount, render children without context — avoids SSR mismatch.
  // The theme class applies after first paint via the useEffect above.
  return (
    <ThemeContext.Provider value={mounted ? { theme, toggleTheme } : { theme: "light", toggleTheme: () => {} }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
