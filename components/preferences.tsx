"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { savePreferences } from "@/app/(dashboard)/profile/actions";
import type { Preferences, TablePreference } from "@/lib/auth-user";

/*
 * The signed-in user's screen settings (theme, sidebar, each table's rows per
 * page and sort), saved on their account so they follow them to any browser.
 *
 * Kept here as well as on the server because the dashboard layout is not
 * re-rendered on client navigation: its `user` still holds the settings as
 * they were at sign-in, so a table opened later reads them from here.
 */

type SavePreference = <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;

type PreferencesContextValue = {
  preferences: Preferences;
  /** Shows the change at once and saves it; a failed save just isn't remembered. */
  savePreference: SavePreference;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ initial, children }: { initial: Preferences; children: ReactNode }) {
  const [preferences, setPreferences] = useState(initial);

  const savePreference = useCallback<SavePreference>((key, value) => {
    setPreferences((current) => ({ ...current, [key]: value }));
    // PATCH /auth/me/ merges by key, so only this one is sent.
    void savePreferences({ [key]: value } as Preferences);
  }, []);

  return <PreferencesContext.Provider value={{ preferences, savePreference }}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error("usePreferences must be used inside <PreferencesProvider>");
  return value;
}

/** One table's saved settings, and a setter that saves the ones passed and keeps the rest. */
export function useTablePreference(saveAs: string): [TablePreference, (change: TablePreference) => void] {
  const { preferences, savePreference } = usePreferences();
  const key = `table.${saveAs}` as const;
  const saved = preferences[key] ?? {};
  return [saved, (change) => savePreference(key, { ...saved, ...change })];
}
