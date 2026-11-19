import React, { useState } from 'react';
import {
  BookmarkPlus,
  Cloud,
  FolderOpen,
  LogIn,
  Trash2,
  Clock,
} from 'lucide-react';
import { SavedCase } from '../types/inheritance';
import { formatCurrency } from '../modules/currency';
import { AppTheme } from '../modules/themes';

interface SavedCasesPanelProps {
  cases: SavedCase[];
  isAuthenticated: boolean;
  localPendingCount: number;
  theme: AppTheme;
  onSaveCase: (name: string, notes: string) => Promise<void> | void;
  onLoadCase: (saved: SavedCase) => void;
  onDeleteCase: (saved: SavedCase) => Promise<void> | void;
  onLoginClick: () => void;
  onSyncLocalCases: () => Promise<void> | void;
}

export const SavedCasesPanel: React.FC<SavedCasesPanelProps> = ({
  cases,
  isAuthenticated,
  localPendingCount,
  theme,
  onSaveCase,
  onLoadCase,
  onDeleteCase,
  onLoginClick,
  onSyncLocalCases,
}) => {
  const [caseName, setCaseName] = useState('');
  const [caseNotes, setCaseNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSaveCase(caseName, caseNotes);
      setCaseName('');
      setCaseNotes('');
      setFeedback(
        isAuthenticated
          ? 'Kasus berhasil disimpan langsung ke Database Firestore.'
          : 'Kasus disimpan sementara di browser. Login Google untuk menyimpan ke Database.'
      );
      window.setTimeout(() => setFeedback(null), 4000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="no-print rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
      <div className="flex flex-col gap-2 border-b border-slate-100 pb-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold" style={{ color: theme.primary }}>
            Riwayat &amp; Simpan Kasus {isAuthenticated ? '(Database Firestore)' : '(Lokal / Draft)'}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {isAuthenticated
              ? 'Semua kasus yang disimpan otomatis masuk ke database Firestore Anda.'
              : 'Login dengan akun Google agar seluruh kasus tersimpan permanen di database.'}
          </p>
        </div>
        {!isAuthenticated ? (
          <button
            type="button"
            onClick={onLoginClick}
            className="inline-flex items-center gap-1.5 self-start whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-90 sm:self-center"
            style={{
              backgroundColor: theme.tint,
              borderColor: theme.border,
              color: theme.primary,
            }}
          >
            <LogIn className="h-3.5 w-3.5" style={{ color: theme.primary }} />
            Login Google (Sync DB)
          </button>
        ) : (
          <span className="inline-flex items-center gap-1.5 self-start text-xs font-semibold text-emerald-700 sm:self-center">
            <Cloud className="h-4 w-4" />
            Terhubung ke Database
          </span>
        )}
      </div>

      {isAuthenticated && localPendingCount > 0 && (
        <div
          className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3.5 py-2.5 text-xs"
          style={{
            backgroundColor: theme.tint,
            borderColor: theme.border,
            color: theme.primary,
          }}
        >
          <span>
            Terdapat <strong>{localPendingCount}</strong> kasus lokal di browser yang belum masuk ke database Firestore.
          </span>
          <button
            type="button"
            onClick={() => void onSyncLocalCases()}
            className="rounded-md px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: theme.primary }}
          >
            Kirim ke Database Sekarang
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-4 space-y-2.5">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <input
            type="text"
            value={caseName}
            onChange={(e) => setCaseName(e.target.value)}
            placeholder="Nama kasus (misal: Keluarga Bpk. Ahmad)"
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2"
          />
          <input
            type="text"
            value={caseNotes}
            onChange={(e) => setCaseNotes(e.target.value)}
            placeholder="Catatan singkat (opsional)"
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-lg px-4 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: theme.primary }}
          >
            <BookmarkPlus className="h-4 w-4" />
            {saving ? 'Menyimpan...' : 'Simpan Kasus Saat Ini'}
          </button>
          {feedback && (
            <span className="text-xs font-medium text-emerald-700">{feedback}</span>
          )}
        </div>
      </form>

      {/* Saved list */}
      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-500">
          <span>Daftar Kasus Tersimpan</span>
          <span className="font-mono-num">{cases.length} kasus</span>
        </div>

        {cases.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-center text-xs text-slate-500">
            Belum ada kasus tersimpan. Isi nama kasus di atas lalu klik <strong>Simpan Kasus Saat Ini</strong>.
          </div>
        ) : (
          <div className="max-h-64 space-y-2.5 overflow-y-auto pr-1">
            {cases.map((item) => {
              const dateStr = new Date(item.savedAt).toLocaleString('id-ID', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });
              const sysText =
                item.state.legalSystem === 'islam' ? 'Islam (KHI/Faraid)' : 'Perdata (BW)';

              return (
                <div
                  key={item.id}
                  className="flex flex-col justify-between gap-2.5 rounded-lg border border-slate-200 bg-[#f8fafc] p-3 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">
                      {item.name}
                    </div>
                    {item.notes && (
                      <div className="mt-0.5 truncate text-xs text-slate-600">
                        {item.notes}
                      </div>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                      <span>{item.source === 'firestore' ? 'Firestore DB' : 'Lokal'}</span>
                      <span aria-hidden="true">·</span>
                      <span>{sysText}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-num font-medium" style={{ color: theme.primary }}>
                        {formatCurrency(item.netEstateSnapshot, item.state.currency)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {dateStr}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onLoadCase(item)}
                      className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-90"
                      style={{
                        backgroundColor: theme.tint,
                        borderColor: theme.border,
                        color: theme.primary,
                      }}
                    >
                      <FolderOpen className="h-3.5 w-3.5" />
                      Muat
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDeleteCase(item)}
                      aria-label={`Hapus kasus ${item.name}`}
                      className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
