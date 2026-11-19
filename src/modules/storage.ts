/**
 * LocalStorage persistence module for saving, listing, loading, and deleting inheritance cases.
 */

import { AppState, SavedCase } from '../types/inheritance';

const STORAGE_KEY = 'waris_simulator_saved_cases_v1';

export function loadSavedCases(): SavedCase[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCaseToStorage(
  name: string,
  notes: string,
  state: AppState,
  netEstateSnapshot: number
): SavedCase[] {
  const existing = loadSavedCases();
  const newCase: SavedCase = {
    id: `case_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim() || `Kasus Waris ${new Date().toLocaleDateString('id-ID')}`,
    notes: notes.trim(),
    savedAt: new Date().toISOString(),
    state: JSON.parse(JSON.stringify(state)),
    netEstateSnapshot,
  };
  const updated = [newCase, ...existing].slice(0, 30);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage quota errors gracefully
  }
  return updated;
}

export function deleteCaseFromStorage(caseId: string): SavedCase[] {
  const existing = loadSavedCases();
  const updated = existing.filter((c) => c.id !== caseId);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
  return updated;
}
