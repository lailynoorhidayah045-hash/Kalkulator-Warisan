import React, { useState } from 'react';
import { BookmarkPlus, FolderOpen, Trash2, Clock } from 'lucide-react';
import { SavedCase } from '../types/inheritance';
import { formatCurrency } from '../modules/currency';

interface SavedCasesPanelProps {
  cases: SavedCase[];
  onSaveCase: (name: string, notes: string) => void;
  onLoadCase: (saved: SavedCase) => void;
  onDeleteCase: (id: string) => void;
}

export const SavedCasesPanel: React.FC<SavedCasesPanelProps> = ({
  cases,
  onSaveCase,
  onLoadCase,
  onDeleteCase,
}) => {
  const [caseName, setCaseName] = useState('');
  const [caseNotes, setCaseNotes] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveCase(caseName, caseNotes);
    setCaseName('');
    setCaseNotes('');
    setFeedback('Kasus berhasil disimpan ke browser (localStorage).');
    window.setTimeout(() => setFeedback(null), 3000);
  };

  return (
    <section className="no-print rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
      <div className="border-b border-slate-100 pb-3.5">
        <h2 className="text-base font-bold text-[#1e3a8a]">
          Riwayat &amp; Simpan Kasus (LocalStorage)
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Simpan skenario pembagian waris secara lokal di browser untuk dimuat ulang kapan saja.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-2.5">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <input
            type="text"
            value={caseName}
            onChange={(e) => setCaseName(e.target.value)}
            placeholder="Nama kasus (misal: Keluarga Bpk. Ahmad)"
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0284c7] focus:outline-none focus:ring-2 focus:ring-[#0284c7]/20"
          />
          <input
            type="text"
            value={caseNotes}
            onChange={(e) => setCaseNotes(e.target.value)}
            placeholder="Catatan singkat (opsional)"
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0284c7] focus:outline-none focus:ring-2 focus:ring-[#0284c7]/20"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="submit"
            className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#1e3a8a] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#172e6e] focus-visible:outline-2 focus-visible:outline-[#0284c7]"
          >
            <BookmarkPlus className="h-4 w-4" />
            Simpan Kasus Saat Ini
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
                      <span>{sysText}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-num font-medium text-[#1e3a8a]">
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
                      className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-[#0284c7] bg-white px-3 py-1.5 text-xs font-semibold text-[#0284c7] transition-colors hover:bg-[#e0f2fe]"
                    >
                      <FolderOpen className="h-3.5 w-3.5" />
                      Muat
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteCase(item.id)}
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
