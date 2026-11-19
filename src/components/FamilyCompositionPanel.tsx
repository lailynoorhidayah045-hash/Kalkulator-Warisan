import React from 'react';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import {
  DeceasedGender,
  FAMILY_GROUPS,
  FamilyCounts,
  HEIR_METADATA,
  HeirKey,
} from '../types/inheritance';

interface FamilyCompositionPanelProps {
  family: FamilyCounts;
  deceasedGender: DeceasedGender;
  onChangeCount: (key: HeirKey, nextValue: number) => void;
  onResetFamily: () => void;
}

export const FamilyCompositionPanel: React.FC<FamilyCompositionPanelProps> = ({
  family,
  deceasedGender,
  onChangeCount,
  onResetFamily,
}) => {
  const totalMembers = Object.values(family).reduce((sum, n) => sum + n, 0);

  return (
    <section className="no-print rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
        <div>
          <h2 className="text-base font-bold text-[#1e3a8a]">
            Komposisi Anggota Keluarga
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Total tercatat: <strong className="font-mono-num text-slate-800">{totalMembers}</strong> orang
          </p>
        </div>
        <button
          type="button"
          onClick={onResetFamily}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Nolkan Semua
        </button>
      </div>

      <div className="mt-4 space-y-5">
        {FAMILY_GROUPS.map((group) => {
          const visibleKeys = group.keys.filter((key) => {
            if (key === 'suami') return deceasedGender === 'female';
            if (key === 'istri') return deceasedGender === 'male';
            return true;
          });

          return (
            <div key={group.id} className="space-y-2.5">
              <div className="flex items-baseline justify-between gap-2 border-b border-slate-100 pb-1.5">
                <h3 className="text-xs font-bold tracking-tight text-slate-800">
                  {group.title}
                </h3>
                <span className="text-[11px] text-slate-400">{group.subtitle}</span>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {visibleKeys.map((key) => {
                  const meta = HEIR_METADATA[key];
                  const value = family[key];
                  const isActive = value > 0;

                  return (
                    <div
                      key={key}
                      className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-colors ${
                        isActive
                          ? 'border-[#0284c7]/40 bg-[#e0f2fe]/30'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-slate-800">
                          {meta.label}
                        </div>
                        {key === 'istri' && (
                          <div className="text-[10px] text-slate-500">
                            Maks 4 (dibagi rata)
                          </div>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onChangeCount(key, Math.max(0, value - 1))}
                          disabled={value <= 0}
                          aria-label={`Kurangi ${meta.label}`}
                          className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition-colors hover:border-[#0284c7] hover:text-[#0284c7] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="font-mono-num w-6 text-center text-sm font-bold text-slate-900">
                          {value}
                        </span>
                        <button
                          type="button"
                          onClick={() => onChangeCount(key, Math.min(meta.max, value + 1))}
                          disabled={value >= meta.max}
                          aria-label={`Tambah ${meta.label}`}
                          className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition-colors hover:border-[#0284c7] hover:bg-[#e0f2fe]/50 hover:text-[#1e3a8a] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
