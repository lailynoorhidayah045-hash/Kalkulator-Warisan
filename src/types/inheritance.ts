/**
 * Centralized TypeScript types and constants for the Interactive Inheritance Simulator.
 */

export type CurrencyCode = 'IDR' | 'USD';
export type LegalSystem = 'islam' | 'civil';
export type DeceasedGender = 'male' | 'female';

export interface FinancialInputs {
  grossAssets: number;
  debts: number;
  funeralCosts: number;
  willAmount: number;
}

export interface FamilyCounts {
  suami: number;
  istri: number;
  anakL: number;
  anakP: number;
  cucuL: number;
  cucuP: number;
  cicitL: number;
  cicitP: number;
  ibu: number;
  ayah: number;
  kakek: number;
  nenek: number;
  buyutL: number;
  buyutP: number;
  saudaraL: number;
  saudaraP: number;
  anakTiri: number;
  mertua: number;
  menantu: number;
}

export type HeirKey = keyof FamilyCounts;

export type HeirStatusTone = 'eligible' | 'blocked' | 'non_heir';

export interface HeirResultRow {
  key: HeirKey;
  label: string;
  category: string;
  count: number;
  statusLabel: string;
  statusTone: HeirStatusTone;
  reason: string;
  fractionLabel: string;
  totalShareRatio: number; // 0..1
  totalAmount: number;
  perPersonAmount: number;
}

export interface CalculationResult {
  system: LegalSystem;
  netEstate: number;
  estateBeforeWill: number;
  maxAllowedWill: number;
  isWillExcessive: boolean;
  rows: HeirResultRow[];
  adjustmentNote: string | null;
  adjustmentType: 'aul' | 'radd' | 'normal' | 'empty';
  totalDistributedRatio: number;
  totalDistributedAmount: number;
}

export interface UserIdentity {
  fullName: string;
  role: string;
  deceasedName: string;
  city: string;
  contact: string;
  notes: string;
}

export interface AppState {
  currency: CurrencyCode;
  exchangeRate: number; // 1 USD = X IDR
  legalSystem: LegalSystem;
  deceasedGender: DeceasedGender;
  financials: FinancialInputs;
  family: FamilyCounts;
  identity?: UserIdentity;
}

export interface SavedCase {
  id: string;
  name: string;
  notes: string;
  savedAt: string;
  state: AppState;
  netEstateSnapshot: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'coach';
  content: string;
  timestamp: string;
}

export interface HeirMeta {
  key: HeirKey;
  label: string;
  shortLabel: string;
  max: number;
  group: 'pasangan' | 'keturunan_utama' | 'keturunan_lanjutan' | 'leluhur' | 'sampingan' | 'non_ahli_waris';
}

export const DEFAULT_EXCHANGE_RATE = 15800;

export const INITIAL_FAMILY_COUNTS: FamilyCounts = {
  suami: 0,
  istri: 1,
  anakL: 1,
  anakP: 2,
  cucuL: 0,
  cucuP: 0,
  cicitL: 0,
  cicitP: 0,
  ibu: 1,
  ayah: 1,
  kakek: 0,
  nenek: 0,
  buyutL: 0,
  buyutP: 0,
  saudaraL: 1,
  saudaraP: 0,
  anakTiri: 0,
  mertua: 0,
  menantu: 0,
};

export const INITIAL_FINANCIALS: FinancialInputs = {
  grossAssets: 1500000000,
  debts: 100000000,
  funeralCosts: 25000000,
  willAmount: 75000000,
};

export const HEIR_METADATA: Record<HeirKey, HeirMeta> = {
  suami: { key: 'suami', label: 'Suami', shortLabel: 'Suami', max: 1, group: 'pasangan' },
  istri: { key: 'istri', label: 'Istri', shortLabel: 'Istri', max: 4, group: 'pasangan' },
  anakL: { key: 'anakL', label: 'Anak Kandung Laki-laki', shortLabel: 'Anak L', max: 20, group: 'keturunan_utama' },
  anakP: { key: 'anakP', label: 'Anak Kandung Perempuan', shortLabel: 'Anak P', max: 20, group: 'keturunan_utama' },
  cucuL: { key: 'cucuL', label: 'Cucu Laki-laki', shortLabel: 'Cucu L', max: 20, group: 'keturunan_lanjutan' },
  cucuP: { key: 'cucuP', label: 'Cucu Perempuan', shortLabel: 'Cucu P', max: 20, group: 'keturunan_lanjutan' },
  cicitL: { key: 'cicitL', label: 'Cicit Laki-laki', shortLabel: 'Cicit L', max: 20, group: 'keturunan_lanjutan' },
  cicitP: { key: 'cicitP', label: 'Cicit Perempuan', shortLabel: 'Cicit P', max: 20, group: 'keturunan_lanjutan' },
  ibu: { key: 'ibu', label: 'Ibu Kandung', shortLabel: 'Ibu', max: 1, group: 'leluhur' },
  ayah: { key: 'ayah', label: 'Ayah Kandung', shortLabel: 'Ayah', max: 1, group: 'leluhur' },
  kakek: { key: 'kakek', label: 'Kakek', shortLabel: 'Kakek', max: 2, group: 'leluhur' },
  nenek: { key: 'nenek', label: 'Nenek', shortLabel: 'Nenek', max: 2, group: 'leluhur' },
  buyutL: { key: 'buyutL', label: 'Buyut Laki-laki', shortLabel: 'Buyut L', max: 4, group: 'leluhur' },
  buyutP: { key: 'buyutP', label: 'Buyut Perempuan', shortLabel: 'Buyut P', max: 4, group: 'leluhur' },
  saudaraL: { key: 'saudaraL', label: 'Saudara Kandung Laki-laki', shortLabel: 'Saudara L', max: 20, group: 'sampingan' },
  saudaraP: { key: 'saudaraP', label: 'Saudara Kandung Perempuan', shortLabel: 'Saudara P', max: 20, group: 'sampingan' },
  anakTiri: { key: 'anakTiri', label: 'Anak Tiri', shortLabel: 'Anak Tiri', max: 20, group: 'non_ahli_waris' },
  mertua: { key: 'mertua', label: 'Mertua', shortLabel: 'Mertua', max: 4, group: 'non_ahli_waris' },
  menantu: { key: 'menantu', label: 'Menantu', shortLabel: 'Menantu', max: 20, group: 'non_ahli_waris' },
};

export const FAMILY_GROUPS: Array<{
  id: HeirMeta['group'];
  title: string;
  subtitle: string;
  keys: HeirKey[];
}> = [
  {
    id: 'pasangan',
    title: 'Pasangan Sah',
    subtitle: 'Menyesuaikan jenis kelamin pewaris',
    keys: ['suami', 'istri'],
  },
  {
    id: 'keturunan_utama',
    title: 'Keturunan Utama',
    subtitle: 'Anak kandung laki-laki & perempuan',
    keys: ['anakL', 'anakP'],
  },
  {
    id: 'keturunan_lanjutan',
    title: 'Keturunan Lanjutan (Jalur Bawah)',
    subtitle: 'Cucu & cicit dari garis keturunan',
    keys: ['cucuL', 'cucuP', 'cicitL', 'cicitP'],
  },
  {
    id: 'leluhur',
    title: 'Leluhur (Jalur Atas)',
    subtitle: 'Orang tua, kakek/nenek, dan buyut',
    keys: ['ibu', 'ayah', 'kakek', 'nenek', 'buyutL', 'buyutP'],
  },
  {
    id: 'sampingan',
    title: 'Sampingan (Collateral)',
    subtitle: 'Saudara kandung seayah-seibu',
    keys: ['saudaraL', 'saudaraP'],
  },
  {
    id: 'non_ahli_waris',
    title: 'Non-Ahli Waris / Kerabat Lain',
    subtitle: 'Tetap dicatat pada matriks hasil sebagai rujukan hukum',
    keys: ['anakTiri', 'mertua', 'menantu'],
  },
];
