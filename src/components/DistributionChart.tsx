import React, { useEffect, useRef } from 'react';
import {
  ArcElement,
  Chart,
  DoughnutController,
  Legend,
  Tooltip,
} from 'chart.js';
import { CurrencyCode, HeirResultRow } from '../types/inheritance';
import { formatCurrency } from '../modules/currency';

Chart.register(DoughnutController, ArcElement, Tooltip, Legend);

interface DistributionChartProps {
  rows: HeirResultRow[];
  currency: CurrencyCode;
  netEstate: number;
  palette?: string[];
  primaryColor?: string;
}

const DEFAULT_CHART_PALETTE = [
  '#1e3a8a',
  '#0284c7',
  '#0ea5e9',
  '#2563eb',
  '#0d9488',
  '#059669',
  '#3b82f6',
  '#6366f1',
  '#0369a1',
  '#14b8a6',
];

export const DistributionChart: React.FC<DistributionChartProps> = ({
  rows,
  currency,
  netEstate,
  palette = DEFAULT_CHART_PALETTE,
  primaryColor = '#1e3a8a',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<Chart<'doughnut'> | null>(null);

  const receivingRows = rows.filter((r) => r.totalAmount > 0.001);
  const activePalette = palette.length > 0 ? palette : DEFAULT_CHART_PALETTE;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
      chartInstanceRef.current = null;
    }

    if (receivingRows.length === 0) return;

    const labels = receivingRows.map((r) =>
      r.count > 1 ? `${r.label} (${r.count})` : r.label
    );
    const values = receivingRows.map((r) => Number(r.totalAmount.toFixed(2)));
    const colors = receivingRows.map((_, i) => activePalette[i % activePalette.length]);

    chartInstanceRef.current = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: colors,
            borderColor: '#ffffff',
            borderWidth: 2,
            hoverOffset: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            backgroundColor: '#0f172a',
            titleFont: { family: "'Plus Jakarta Sans', 'Segoe UI', sans-serif", size: 12, weight: 'bold' },
            bodyFont: { family: "'JetBrains Mono', monospace", size: 12 },
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) => {
                const row = receivingRows[ctx.dataIndex];
                if (!row) return '';
                const pct = (row.totalShareRatio * 100).toFixed(2);
                return ` ${formatCurrency(row.totalAmount, currency)} (${pct}%)`;
              },
            },
          },
        },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [receivingRows, currency, netEstate, activePalette]);

  if (receivingRows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 text-center">
        <p className="text-sm font-medium text-slate-600">
          Belum ada visualisasi distribusi harta
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Pastikan Harta Bersih &gt; 0 dan minimal satu ahli waris yang berhak telah ditambahkan.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 items-center gap-6 sm:grid-cols-12">
      <div className="relative mx-auto h-56 w-56 sm:col-span-5">
        <canvas ref={canvasRef} aria-label="Grafik Distribusi Pembagian Waris" />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[11px] font-medium text-slate-500">Harta Bersih</span>
          <span
            className="font-mono-num mt-0.5 max-w-[125px] truncate text-xs font-bold"
            style={{ color: primaryColor }}
          >
            {formatCurrency(netEstate, currency)}
          </span>
        </div>
      </div>

      <div className="space-y-2.5 sm:col-span-7">
        {receivingRows.map((row, idx) => {
          const color = activePalette[idx % activePalette.length];
          const pct = (row.totalShareRatio * 100).toFixed(2);
          return (
            <div
              key={row.key}
              className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 last:border-b-0 last:pb-0"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className="h-3 w-3 shrink-0 rounded-sm"
                  style={{ backgroundColor: color }}
                  aria-hidden="true"
                />
                <span className="truncate text-sm font-medium text-slate-800">
                  {row.label}
                  {row.count > 1 ? ` (${row.count})` : ''}
                </span>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-mono-num text-sm font-semibold text-slate-900">
                  {formatCurrency(row.totalAmount, currency)}
                </div>
                <div className="font-mono-num text-xs text-slate-500">{pct}%</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
