import React from 'react';
import { Download, Printer, Info, AlertTriangle } from 'lucide-react';
import { AppState, CalculationResult, HeirResultRow } from '../types/inheritance';
import { formatCurrency } from '../modules/currency';
import { AppTheme } from '../modules/themes';

interface ResultsMatrixProps {
  state: AppState;
  result: CalculationResult;
  theme: AppTheme;
  onExportCsv: () => void;
  onPrint: () => void;
}

function getStatusClasses(tone: HeirResultRow['statusTone']): string {
  if (tone === 'eligible') {
    return 'bg-emerald-50 text-emerald-800 border border-emerald-200';
  }
  if (tone === 'blocked') {
    return 'bg-amber-50 text-amber-800 border border-amber-200';
  }
  return 'bg-slate-100 text-slate-600 border border-slate-200';
}

export const ResultsMatrix: React.FC<ResultsMatrixProps> = ({
  state,
  result,
  theme,
  onExportCsv,
  onPrint,
}) => {
  return (
    <section className="print-card rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight" style={{ color: theme.primary }}>
            Matriks Hasil Pembagian Waris
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Menampilkan seluruh anggota keluarga aktif (termasuk yang terhalang dan bukan ahli waris).
          </p>
        </div>

        <div className="no-print flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onPrint}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <Printer className="h-3.5 w-3.5" style={{ color: theme.primary }} />
            Cetak / PDF
          </button>
          <button
            type="button"
            onClick={onExportCsv}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: theme.primary }}
          >
            <Download className="h-3.5 w-3.5" />
            Unduh Excel (.csv)
          </button>
        </div>
      </div>

      {/* Legal System / Aul / Radd Notice */}
      {result.adjustmentNote && (
        <div
          className={`mt-4 flex items-start gap-2.5 rounded-lg border p-3.5 text-xs leading-relaxed ${
            result.adjustmentType === 'aul'
              ? 'border-amber-200 bg-amber-50/80 text-amber-900'
              : result.adjustmentType === 'empty'
              ? 'border-slate-200 bg-slate-50 text-slate-700'
              : ''
          }`}
          style={
            result.adjustmentType !== 'aul' && result.adjustmentType !== 'empty'
              ? {
                  backgroundColor: theme.tint,
                  borderColor: theme.border,
                  color: theme.primary,
                }
              : undefined
          }
        >
          {result.adjustmentType === 'aul' ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          ) : (
            <Info className="mt-0.5 h-4 w-4 shrink-0" style={{ color: theme.primary }} />
          )}
          <span>{result.adjustmentNote}</span>
        </div>
      )}

      {/* Results Table */}
      <div className="mt-4 overflow-x-auto">
        {result.rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center text-sm text-slate-500">
            Belum ada anggota keluarga yang ditambahkan. Gunakan tombol <strong>+</strong> pada panel komposisi keluarga untuk memulai simulasi.
          </div>
        ) : (
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                <th className="py-3 pl-3 pr-2">Anggota Keluarga</th>
                <th className="px-2 py-3 text-center">Jml</th>
                <th className="px-2 py-3">Status &amp; Alasan</th>
                <th className="px-2 py-3 text-right">Porsi</th>
                <th className="px-2 py-3 text-right">Total ({state.currency})</th>
                <th className="py-3 pl-2 pr-3 text-right">Per Orang</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.rows.map((row) => (
                <tr
                  key={row.key}
                  className={`transition-colors hover:bg-slate-50/70 ${
                    row.statusTone === 'non_heir' ? 'bg-slate-50/40' : ''
                  }`}
                >
                  <td className="py-3 pl-3 pr-2 align-top">
                    <div className="font-semibold text-slate-900">{row.label}</div>
                  </td>
                  <td className="font-mono-num px-2 py-3 text-center align-top font-semibold text-slate-700">
                    {row.count}
                  </td>
                  <td className="px-2 py-3 align-top">
                    <span
                      className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold leading-tight ${getStatusClasses(
                        row.statusTone
                      )}`}
                    >
                      {row.statusLabel}
                    </span>
                    <div className="mt-1 text-xs leading-snug text-slate-500">
                      {row.reason}
                    </div>
                  </td>
                  <td className="font-mono-num px-2 py-3 text-right align-top text-xs font-medium text-slate-700">
                    {row.fractionLabel}
                  </td>
                  <td className="font-mono-num px-2 py-3 text-right align-top font-semibold text-slate-900">
                    {formatCurrency(row.totalAmount, state.currency)}
                  </td>
                  <td
                    className="font-mono-num py-3 pl-2 pr-3 text-right align-top text-xs font-medium"
                    style={{ color: theme.primary }}
                  >
                    {row.totalAmount > 0
                      ? formatCurrency(row.perPersonAmount, state.currency)
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr
                className="border-t-2 border-slate-200 font-semibold"
                style={{ backgroundColor: theme.tint, color: theme.primary }}
              >
                <td className="py-3 pl-3 pr-2" colSpan={3}>
                  Total Harta Terdistribusi
                </td>
                <td className="font-mono-num px-2 py-3 text-right text-xs">
                  {(result.totalDistributedRatio * 100).toFixed(2)}%
                </td>
                <td className="font-mono-num px-2 py-3 text-right">
                  {formatCurrency(result.totalDistributedAmount, state.currency)}
                </td>
                <td className="py-3 pl-2 pr-3 text-right text-xs font-normal text-slate-600">
                  {state.legalSystem === 'islam' ? 'KHI & Faraid' : 'KUHPerdata'}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </section>
  );
};
