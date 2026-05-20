import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Installation, Persisted } from "./types";

const KEY = "@rehau/mobile/v1";

const empty = (): Persisted => ({ version: 1, installations: [], activeId: null });

export const loadState = async (): Promise<Persisted> => {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    if (parsed?.version !== 1 || !Array.isArray(parsed.installations)) return empty();
    return {
      version: 1,
      installations: parsed.installations.filter(
        (i): i is Installation =>
          !!i && typeof i.id === "string" && typeof i.name === "string" && typeof i.url === "string",
      ),
      activeId: typeof parsed.activeId === "string" ? parsed.activeId : null,
    };
  } catch {
    return empty();
  }
};

export const saveState = async (s: Persisted): Promise<void> => {
  await AsyncStorage.setItem(KEY, JSON.stringify(s));
};

export const newId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const normalizeUrl = (raw: string): string => {
  let v = raw.trim();
  if (!v) return v;
  if (!/^https?:\/\//i.test(v)) v = `http://${v}`;
  v = v.replace(/\/+$/, "");
  return v;
};

export const upsertInstallation = (
  state: Persisted,
  installation: Installation,
): Persisted => {
  const idx = state.installations.findIndex((i) => i.id === installation.id);
  const installations = idx >= 0
    ? state.installations.map((i) => (i.id === installation.id ? installation : i))
    : [...state.installations, installation];
  const activeId = state.activeId ?? installation.id;
  return { ...state, installations, activeId };
};

export const deleteInstallation = (state: Persisted, id: string): Persisted => {
  const installations = state.installations.filter((i) => i.id !== id);
  let activeId = state.activeId;
  if (activeId === id) activeId = installations[0]?.id ?? null;
  return { ...state, installations, activeId };
};

export const setActive = (state: Persisted, id: string): Persisted => {
  if (!state.installations.some((i) => i.id === id)) return state;
  return { ...state, activeId: id };
};

export const activeInstallation = (s: Persisted): Installation | null => {
  if (!s.activeId) return null;
  return s.installations.find((i) => i.id === s.activeId) ?? null;
};
