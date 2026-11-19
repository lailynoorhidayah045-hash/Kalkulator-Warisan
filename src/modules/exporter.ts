/**
 * Report export module: Excel-compatible CSV (.csv with UTF-8 BOM)
 * and print trigger for PDF saving.
 */

import { AppState, CalculationResult } from '../types/inheritance';
import { formatCurrency, formatRateIdr } from './currency';

function escapeCsvCell(value: string | number): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportResultsToCsv(state: AppState, result: CalculationResult): void {
  const systemName =
    state.legalSystem === 'islam'
      ? 'Hukum Waris Islam (KHI & Faraid)'
      : 'Hukum Waris Perdata Barat (KUHPerdata / BW)';
  const genderName = state.deceasedGender === 'male' ? 'Laki-laki' : 'Perempuan';
  const generatedAt = new Date().toLocaleString('id-ID');

  const identity = state.identity;
  const identityRows: Array<Array<string | number>> = [];
  if (identity?.fullName) identityRows.push(['Nama Pengisi / Pemohon', identity.fullName]);
  if (identity?.role && (identity.fullName || identity.deceasedName || identity.city || identity.contact)) {
    identityRows.push(['Peran / Kapasitas', identity.role]);
  }
  if (identity?.deceasedName) identityRows.push(['Nama Pewaris', identity.deceasedName]);
  if (identity?.city) identityRows.push(['Kota / Domisili', identity.city]);
  if (identity?.contact) identityRows.push(['Kontak', identity.contact]);
  if (identity?.notes) identityRows.push(['Catatan Kasus', identity.notes]);

  const lines: Array<Array<string | number>> = [
    ['LAPORAN SIMULASI PEMBAGIAN HUKUM WARIS'],
    ['Tanggal Cetak', generatedAt],
    ...identityRows,
    ['Sistem Hukum', systemName],
    ['Jenis Kelamin Pewaris', genderName],
    ['Mata Uang Aktif', state.currency],
    ['Kurs Aktif', `1 USD = ${formatRateIdr(state.exchangeRate)}`],
    [],
    ['RINGKASAN KEUANGAN'],
    ['Total Harta Kotor (Gross)', formatCurrency(state.financials.grossAssets, state.currency)],
    ['Utang / Kewajiban', formatCurrency(state.financials.debts, state.currency)],
    ['Biaya Pemakaman', formatCurrency(state.financials.funeralCosts, state.currency)],
    ['Wasiat / Hibah', formatCurrency(state.financials.willAmount, state.currency)],
    ['Harta Bersih Siap Dibagi', formatCurrency(result.netEstate, state.currency)],
    [
      'Status Batas Wasiat 1/3 (KHI)',
      result.isWillExcessive
        ? `MELEBIHI BATAS 1/3 (Maks: ${formatCurrency(result.maxAllowedWill, state.currency)})`
        : 'Memenuhi batas maksimal 1/3',
    ],
    [],
    ['MATRIKS PEMBAGIAN AHLI WARIS & KERABAT'],
    [
      'Anggota Keluarga',
      'Jumlah',
      'Status Hukum',
      'Keterangan / Dasar Hukum',
      'Porsi / Bagian',
      `Total Nominal (${state.currency})`,
      `Per Orang (${state.currency})`,
    ],
  ];

  for (const row of result.rows) {
    lines.push([
      row.label,
      row.count,
      row.statusLabel,
      row.reason,
      row.fractionLabel,
      formatCurrency(row.totalAmount, state.currency),
      formatCurrency(row.perPersonAmount, state.currency),
    ]);
  }

  lines.push([]);
  lines.push([
    'TOTAL TERDISTRIBUSI',
    '',
    '',
    result.adjustmentNote ?? 'Distribusi normal',
    `${(result.totalDistributedRatio * 100).toFixed(2)}%`,
    formatCurrency(result.totalDistributedAmount, state.currency),
    '',
  ]);

  const csvContent = '\uFEFF' + lines.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  const dateTag = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.setAttribute('download', `laporan-waris-${state.legalSystem}-${state.currency.toLowerCase()}-${dateTag}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
