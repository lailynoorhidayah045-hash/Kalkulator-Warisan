import * as XLSX from 'xlsx';
import {
  DEFAULT_EXCHANGE_RATE,
  FamilyCounts,
  FinancialInputs,
  FirestoreCoachLog,
  FirestoreIdentityRecord,
  FirestoreSimulationLog,
  HEIR_METADATA,
  HeirKey,
  INITIAL_FAMILY_COUNTS,
  INITIAL_FINANCIALS,
  SavedCase,
  UserIdentity,
} from '../types/inheritance';
import { formatCurrency } from './currency';

export type AdminDatasetType = 'cases' | 'simulationLogs' | 'identities' | 'coachLogs';

function sanitizeNumber(val: unknown, fallback = 0): number {
  if (typeof val === 'number' && Number.isFinite(val) && val >= 0) return val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[^\d.-]/g, '');
    const n = parseFloat(cleaned);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return fallback;
}

export function exportAdminDatasetToExcel(
  type: AdminDatasetType,
  data: {
    cases?: SavedCase[];
    simulationLogs?: FirestoreSimulationLog[];
    identities?: FirestoreIdentityRecord[];
    coachLogs?: FirestoreCoachLog[];
  }
): void {
  const wb = XLSX.utils.book_new();
  const dateTag = new Date().toISOString().slice(0, 10);

  if (type === 'cases' && data.cases) {
    const rows = data.cases.map((c) => ({
      ID: c.id,
      Nama_Kasus: c.name,
      Pemilik: c.ownerName ?? '',
      Sistem_Hukum: c.state.legalSystem,
      Gender_Pewaris: c.state.deceasedGender,
      Mata_Uang: c.state.currency,
      Kurs_USD: c.state.exchangeRate,
      Harta_Kotor: c.state.financials.grossAssets,
      Utang: c.state.financials.debts,
      Biaya_Pemakaman: c.state.financials.funeralCosts,
      Wasiat: c.state.financials.willAmount,
      Harta_Bersih: c.netEstateSnapshot,
      Harta_Bersih_Tampil: formatCurrency(c.netEstateSnapshot, c.state.currency),
      Nama_Pengisi: c.state.identity?.fullName ?? '',
      Peran_Pengisi: c.state.identity?.role ?? '',
      Nama_Pewaris: c.state.identity?.deceasedName ?? '',
      Domisili: c.state.identity?.city ?? '',
      Kontak: c.state.identity?.contact ?? '',
      Catatan: c.notes,
      Komposisi_Keluarga_JSON: JSON.stringify(c.state.family),
      Waktu: new Date(c.savedAt).toLocaleString('id-ID'),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Kasus_Waris');
    XLSX.writeFile(wb, `admin-kasus-waris-${dateTag}.xlsx`);
    return;
  }

  if (type === 'simulationLogs' && data.simulationLogs) {
    const rows = data.simulationLogs.map((l) => ({
      ID: l.id,
      Judul_Simulasi: l.title,
      Aksi: l.action,
      Pengguna: l.ownerName,
      Email_Pengguna: l.ownerEmail ?? '',
      Sistem_Hukum: l.legalSystem,
      Gender_Pewaris: l.deceasedGender,
      Mata_Uang: l.currency,
      Kurs_USD: l.exchangeRate,
      Harta_Kotor: l.financials.grossAssets,
      Utang: l.financials.debts,
      Biaya_Pemakaman: l.financials.funeralCosts,
      Wasiat: l.financials.willAmount,
      Harta_Bersih: l.netEstate,
      Harta_Bersih_Tampil: formatCurrency(l.netEstate, l.currency),
      Nama_Pengisi: l.identity?.fullName ?? '',
      Nama_Pewaris: l.identity?.deceasedName ?? '',
      Ringkasan: l.summaryText,
      Komposisi_Keluarga_JSON: JSON.stringify(l.family),
      Waktu: new Date(l.createdAtMs).toLocaleString('id-ID'),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Log_Simulasi');
    XLSX.writeFile(wb, `admin-log-simulasi-${dateTag}.xlsx`);
    return;
  }

  if (type === 'identities' && data.identities) {
    const rows = data.identities.map((i) => ({
      ID: i.id,
      Nama_Pengisi: i.fullName,
      Peran: i.role,
      Nama_Pewaris: i.deceasedName,
      Kota: i.city,
      Kontak: i.contact,
      Email_Akun: i.ownerEmail ?? '',
      Catatan: i.notes,
      Waktu: new Date(i.createdAtMs).toLocaleString('id-ID'),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Identitas_Masuk');
    XLSX.writeFile(wb, `admin-identitas-${dateTag}.xlsx`);
    return;
  }

  if (type === 'coachLogs' && data.coachLogs) {
    const rows = data.coachLogs.map((c) => ({
      ID: c.id,
      Pengguna: c.ownerName,
      Sistem_Hukum: c.legalSystem,
      Pertanyaan: c.question,
      Jawaban: c.answer,
      Waktu: new Date(c.createdAtMs).toLocaleString('id-ID'),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Log_AI_Coach');
    XLSX.writeFile(wb, `admin-log-coach-${dateTag}.xlsx`);
  }
}

export interface ParsedImportPayload {
  cases: Array<{
    name: string;
    notes: string;
    currency: 'IDR' | 'USD';
    exchangeRate: number;
    legalSystem: 'islam' | 'civil';
    deceasedGender: 'male' | 'female';
    netEstateSnapshot: number;
    financials: FinancialInputs;
    family: FamilyCounts;
    identity: UserIdentity;
  }>;
  simulationLogs: Array<{
    action: string;
    title: string;
    legalSystem: 'islam' | 'civil';
    deceasedGender: 'male' | 'female';
    currency: 'IDR' | 'USD';
    exchangeRate: number;
    netEstate: number;
    financials: FinancialInputs;
    family: FamilyCounts;
    identity: UserIdentity;
    summaryText: string;
  }>;
  identities: UserIdentity[];
  coachLogs: Array<{
    question: string;
    answer: string;
    legalSystem: 'islam' | 'civil';
  }>;
}

function parseFamilyJson(raw: unknown): FamilyCounts {
  if (typeof raw === 'string' && raw.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as Partial<FamilyCounts>;
      const next = { ...INITIAL_FAMILY_COUNTS };
      for (const k of Object.keys(HEIR_METADATA) as HeirKey[]) {
        if (k in parsed) {
          const val = Math.trunc(Number(parsed[k]) || 0);
          next[k] = Math.min(HEIR_METADATA[k].max, Math.max(0, val));
        }
      }
      return next;
    } catch {
      return { ...INITIAL_FAMILY_COUNTS };
    }
  }
  return { ...INITIAL_FAMILY_COUNTS };
}

export async function parseExcelImportFile(
  file: File,
  targetType: AdminDatasetType
): Promise<ParsedImportPayload> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('File Excel/CSV tidak memiliki lembar kerja (sheet).');
  }
  const sheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  const result: ParsedImportPayload = {
    cases: [],
    simulationLogs: [],
    identities: [],
    coachLogs: [],
  };

  for (const row of rawRows) {
    const getStr = (...keys: string[]): string => {
      for (const k of keys) {
        const matchKey = Object.keys(row).find(
          (rk) => rk.toLowerCase().trim() === k.toLowerCase()
        );
        if (matchKey && String(row[matchKey]).trim() !== '') {
          return String(row[matchKey]).trim();
        }
      }
      return '';
    };
    const getNum = (fallback: number, ...keys: string[]): number => {
      for (const k of keys) {
        const matchKey = Object.keys(row).find(
          (rk) => rk.toLowerCase().trim() === k.toLowerCase()
        );
        if (matchKey && row[matchKey] !== '') {
          return sanitizeNumber(row[matchKey], fallback);
        }
      }
      return fallback;
    };

    const sysRaw = getStr('Sistem_Hukum', 'legalSystem', 'Sistem').toLowerCase();
    const legalSystem: 'islam' | 'civil' =
      sysRaw.includes('civil') || sysRaw.includes('perdata') || sysRaw.includes('bw')
        ? 'civil'
        : 'islam';

    const genRaw = getStr('Gender_Pewaris', 'deceasedGender', 'Jenis_Kelamin').toLowerCase();
    const deceasedGender: 'male' | 'female' =
      genRaw.includes('female') || genRaw.includes('perempuan') ? 'female' : 'male';

    const curRaw = getStr('Mata_Uang', 'currency').toUpperCase();
    const currency: 'IDR' | 'USD' = curRaw === 'USD' ? 'USD' : 'IDR';

    if (targetType === 'cases') {
      const financials: FinancialInputs = {
        grossAssets: getNum(INITIAL_FINANCIALS.grossAssets, 'Harta_Kotor', 'grossAssets'),
        debts: getNum(0, 'Utang', 'debts'),
        funeralCosts: getNum(0, 'Biaya_Pemakaman', 'funeralCosts'),
        willAmount: getNum(0, 'Wasiat', 'willAmount'),
      };
      const computedNet = Math.max(
        0,
        financials.grossAssets - financials.debts - financials.funeralCosts - financials.willAmount
      );
      const net = getNum(computedNet, 'Harta_Bersih', 'netEstateSnapshot');
      result.cases.push({
        name: getStr('Nama_Kasus', 'name', 'Judul') || 'Kasus Impor Excel',
        notes: getStr('Catatan', 'notes'),
        currency,
        exchangeRate: Math.max(1, getNum(DEFAULT_EXCHANGE_RATE, 'Kurs_USD', 'exchangeRate')),
        legalSystem,
        deceasedGender,
        netEstateSnapshot: net,
        financials,
        family: parseFamilyJson(getStr('Komposisi_Keluarga_JSON', 'family')),
        identity: {
          fullName: getStr('Nama_Pengisi', 'fullName'),
          role: getStr('Peran_Pengisi', 'role') || 'Ahli Waris / Anggota Keluarga',
          deceasedName: getStr('Nama_Pewaris', 'deceasedName'),
          city: getStr('Domisili', 'Kota', 'city'),
          contact: getStr('Kontak', 'contact'),
          notes: getStr('Catatan', 'notes'),
        },
      });
    } else if (targetType === 'simulationLogs') {
      const financials: FinancialInputs = {
        grossAssets: getNum(INITIAL_FINANCIALS.grossAssets, 'Harta_Kotor', 'grossAssets'),
        debts: getNum(0, 'Utang', 'debts'),
        funeralCosts: getNum(0, 'Biaya_Pemakaman', 'funeralCosts'),
        willAmount: getNum(0, 'Wasiat', 'willAmount'),
      };
      const computedNet = Math.max(
        0,
        financials.grossAssets - financials.debts - financials.funeralCosts - financials.willAmount
      );
      result.simulationLogs.push({
        action: getStr('Aksi', 'action') || 'Impor Excel',
        title: getStr('Judul_Simulasi', 'title', 'Nama_Kasus') || 'Simulasi Impor Excel',
        legalSystem,
        deceasedGender,
        currency,
        exchangeRate: Math.max(1, getNum(DEFAULT_EXCHANGE_RATE, 'Kurs_USD', 'exchangeRate')),
        netEstate: getNum(computedNet, 'Harta_Bersih', 'netEstate'),
        financials,
        family: parseFamilyJson(getStr('Komposisi_Keluarga_JSON', 'family')),
        identity: {
          fullName: getStr('Nama_Pengisi', 'fullName'),
          role: getStr('Peran', 'role') || 'Ahli Waris / Anggota Keluarga',
          deceasedName: getStr('Nama_Pewaris', 'deceasedName'),
          city: getStr('Kota', 'city'),
          contact: getStr('Kontak', 'contact'),
          notes: getStr('Catatan', 'notes'),
        },
        summaryText: getStr('Ringkasan', 'summaryText') || 'Diimpor dari file Excel/CSV',
      });
    } else if (targetType === 'identities') {
      result.identities.push({
        fullName: getStr('Nama_Pengisi', 'fullName', 'Nama'),
        role: getStr('Peran', 'role') || 'Ahli Waris / Anggota Keluarga',
        deceasedName: getStr('Nama_Pewaris', 'deceasedName'),
        city: getStr('Kota', 'Domisili', 'city'),
        contact: getStr('Kontak', 'contact'),
        notes: getStr('Catatan', 'notes'),
      });
    } else if (targetType === 'coachLogs') {
      const q = getStr('Pertanyaan', 'question');
      const a = getStr('Jawaban', 'answer');
      if (q && a) {
        result.coachLogs.push({
          question: q,
          answer: a,
          legalSystem,
        });
      }
    }
  }

  return result;
}
