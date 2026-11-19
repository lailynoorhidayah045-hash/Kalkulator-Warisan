/**
 * Theme definitions for Simulator & Kalkulator Hukum Waris Interaktif.
 * Every theme guarantees bright, unmistakable active-selection colors
 * and high-contrast legibility.
 */

export type ThemeId = 'navy' | 'emerald' | 'cyan' | 'amber' | 'plum';

export interface AppTheme {
  id: ThemeId;
  name: string;
  swatch: string;
  headerFrom: string;
  headerVia: string;
  headerTo: string;
  primary: string;
  primaryHover: string;
  bright: string;
  brightHover: string;
  brightText: string;
  tint: string;
  border: string;
  pageBg: string;
  chartPalette: string[];
}

export const APP_THEMES: AppTheme[] = [
  {
    id: 'navy',
    name: 'Navy Langit',
    swatch: '#0ea5e9',
    headerFrom: '#1e3a8a',
    headerVia: '#1d4ed8',
    headerTo: '#0284c7',
    primary: '#1e3a8a',
    primaryHover: '#172e6e',
    bright: '#0ea5e9',
    brightHover: '#0284c7',
    brightText: '#ffffff',
    tint: '#e0f2fe',
    border: '#38bdf8',
    pageBg: '#f8fafc',
    chartPalette: ['#1e3a8a', '#0ea5e9', '#2563eb', '#0284c7', '#06b6d4', '#14b8a6', '#3b82f6', '#6366f1'],
  },
  {
    id: 'emerald',
    name: 'Zamrud Syariah',
    swatch: '#10b981',
    headerFrom: '#064e3b',
    headerVia: '#047857',
    headerTo: '#10b981',
    primary: '#065f46',
    primaryHover: '#064e3b',
    bright: '#10b981',
    brightHover: '#059669',
    brightText: '#ffffff',
    tint: '#d1fae5',
    border: '#34d399',
    pageBg: '#f6fbf9',
    chartPalette: ['#065f46', '#10b981', '#059669', '#14b8a6', '#0d9488', '#34d399', '#0284c7', '#047857'],
  },
  {
    id: 'cyan',
    name: 'Safir Cerah',
    swatch: '#06b6d4',
    headerFrom: '#312e81',
    headerVia: '#2563eb',
    headerTo: '#06b6d4',
    primary: '#312e81',
    primaryHover: '#1e1b4b',
    bright: '#06b6d4',
    brightHover: '#0891b2',
    brightText: '#ffffff',
    tint: '#cffafe',
    border: '#22d3ee',
    pageBg: '#f6fafe',
    chartPalette: ['#312e81', '#06b6d4', '#2563eb', '#0891b2', '#4f46e5', '#22d3ee', '#0ea5e9', '#6366f1'],
  },
  {
    id: 'amber',
    name: 'Emas Klasik',
    swatch: '#f59e0b',
    headerFrom: '#1e293b',
    headerVia: '#334155',
    headerTo: '#b45309',
    primary: '#1e293b',
    primaryHover: '#0f172a',
    bright: '#f59e0b',
    brightHover: '#d97706',
    brightText: '#0f172a',
    tint: '#fef3c7',
    border: '#fbbf24',
    pageBg: '#fafaf7',
    chartPalette: ['#1e293b', '#f59e0b', '#d97706', '#0284c7', '#b45309', '#475569', '#eab308', '#0d9488'],
  },
  {
    id: 'plum',
    name: 'Anggrek Elegan',
    swatch: '#ec4899',
    headerFrom: '#581c87',
    headerVia: '#7e22ce',
    headerTo: '#db2777',
    primary: '#581c87',
    primaryHover: '#3b0764',
    bright: '#ec4899',
    brightHover: '#db2777',
    brightText: '#ffffff',
    tint: '#fce7f3',
    border: '#f472b6',
    pageBg: '#faf7fb',
    chartPalette: ['#581c87', '#ec4899', '#9333ea', '#db2777', '#7e22ce', '#f472b6', '#6366f1', '#0284c7'],
  },
];

const THEME_STORAGE_KEY = 'waris_simulator_theme_v1';

export function loadSavedThemeId(): ThemeId {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY) as ThemeId | null;
    if (raw && APP_THEMES.some((t) => t.id === raw)) return raw;
  } catch {
    // ignore
  }
  return 'navy';
}

export function saveThemeId(id: ThemeId): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {
    // ignore
  }
}

export function getThemeById(id: ThemeId): AppTheme {
  return APP_THEMES.find((t) => t.id === id) ?? APP_THEMES[0];
}
