import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  RefreshCw,
  UserCheck,
} from 'lucide-react';
import {
  AppState,
  CurrencyCode,
  DEFAULT_EXCHANGE_RATE,
  DeceasedGender,
  FinancialInputs,
  HeirKey,
  INITIAL_FAMILY_COUNTS,
  INITIAL_FINANCIALS,
  LegalSystem,
  SavedCase,
  UserIdentity,
} from './types/inheritance';
import {
  convertFinancialsBetweenCurrencies,
  formatCurrency,
  formatInputNumber,
  formatRateIdr,
  parseFinancialInput,
  revalueFinancialsForRateChange,
} from './modules/currency';
import { calculateIslamicInheritance } from './modules/islamicCalculator';
import { calculateCivilInheritance } from './modules/civilCalculator';
import {
  deleteCaseFromStorage,
  loadSavedCases,
  saveCaseToStorage,
} from './modules/storage';
import { exportResultsToCsv } from './modules/exporter';
import { FamilyCompositionPanel } from './components/FamilyCompositionPanel';
import { DistributionChart } from './components/DistributionChart';
import { ResultsMatrix } from './components/ResultsMatrix';
import { AiLegalCoachPanel } from './components/AiLegalCoachPanel';
import { SavedCasesPanel } from './components/SavedCasesPanel';
import { IdentityModal } from './components/IdentityModal';

const DEFAULT_IDENTITY: UserIdentity = {
  fullName: '',
  role: 'Ahli Waris / Anggota Keluarga',
  deceasedName: '',
  city: '',
  contact: '',
  notes: '',
};

const INITIAL_STATE: AppState = {
  currency: 'IDR',
  exchangeRate: DEFAULT_EXCHANGE_RATE,
  legalSystem: 'islam',
  deceasedGender: 'male',
  financials: INITIAL_FINANCIALS,
  family: INITIAL_FAMILY_COUNTS,
  identity: DEFAULT_IDENTITY,
};

export function App() {
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [draftRate, setDraftRate] = useState<string>(String(DEFAULT_EXCHANGE_RATE));
  const [rateFeedback, setRateFeedback] = useState<string | null>(null);
  const [savedCases, setSavedCases] = useState<SavedCase[]>(() => loadSavedCases());
  const [showIdentityModal, setShowIdentityModal] = useState<boolean>(true);

  // Core calculation engine (auto-selects KHI/Faraid or KUHPerdata/BW)
  const result = useMemo(() => {
    if (state.legalSystem === 'islam') {
      return calculateIslamicInheritance(
        state.financials,
        state.family,
        state.deceasedGender
      );
    }
    return calculateCivilInheritance(
      state.financials,
      state.family,
      state.deceasedGender
    );
  }, [state.legalSystem, state.financials, state.family, state.deceasedGender]);

  // Alternate currency preview for net estate
  const alternateNetEstate = useMemo(() => {
    if (state.exchangeRate <= 0) return 0;
    return state.currency === 'IDR'
      ? result.netEstate / state.exchangeRate
      : result.netEstate * state.exchangeRate;
  }, [result.netEstate, state.currency, state.exchangeRate]);

  // Switch currency (IDR <-> USD)
  const handleCurrencySwitch = (targetCurrency: CurrencyCode) => {
    if (targetCurrency === state.currency) return;
    setState((prev) => ({
      ...prev,
      currency: targetCurrency,
      financials: convertFinancialsBetweenCurrencies(
        prev.financials,
        prev.currency,
        targetCurrency,
        prev.exchangeRate
      ),
    }));
    setRateFeedback(
      `Mata uang diubah ke ${targetCurrency} dengan kurs 1 USD = ${formatRateIdr(state.exchangeRate)}.`
    );
  };

  // Explicit "Terapkan Kurs" submit handler
  const handleApplyRate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleaned = draftRate.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(cleaned);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      setRateFeedback('Masukkan nilai kurs yang valid (lebih dari 0).');
      return;
    }

    const oldRate = state.exchangeRate;
    const newRate = Math.round(parsed);

    setState((prev) => ({
      ...prev,
      exchangeRate: newRate,
      financials: revalueFinancialsForRateChange(
        prev.financials,
        prev.currency,
        oldRate,
        newRate
      ),
    }));
    setDraftRate(String(newRate));

    if (newRate === oldRate) {
      setRateFeedback(`Kurs tetap aktif pada 1 USD = ${formatRateIdr(newRate)}.`);
    } else {
      const direction = newRate > oldRate ? 'naik' : 'turun';
      setRateFeedback(
        `Kurs diterapkan (${direction} dari ${formatRateIdr(oldRate)} ke ${formatRateIdr(
          newRate
        )}). Seluruh nominal & hasil diperbarui.`
      );
    }
  };

  // Switch legal system
  const handleLegalSystemChange = (legalSystem: LegalSystem) => {
    setState((prev) => ({ ...prev, legalSystem }));
  };

  // Switch deceased gender & adapt spouse counter cleanly
  const handleGenderChange = (gender: DeceasedGender) => {
    setState((prev) => {
      if (prev.deceasedGender === gender) return prev;
      const nextFamily = { ...prev.family };
      if (gender === 'male') {
        nextFamily.istri = prev.family.suami > 0 ? 1 : prev.family.istri;
        nextFamily.suami = 0;
      } else {
        nextFamily.suami = prev.family.istri > 0 ? 1 : prev.family.suami;
        nextFamily.istri = 0;
      }
      return { ...prev, deceasedGender: gender, family: nextFamily };
    });
  };

  // Update financial input
  const handleFinancialChange = (field: keyof FinancialInputs, rawValue: string) => {
    const numeric = parseFinancialInput(rawValue, state.currency);
    setState((prev) => ({
      ...prev,
      financials: {
        ...prev.financials,
        [field]: numeric,
      },
    }));
  };

  // Update family member count
  const handleFamilyCountChange = (key: HeirKey, nextValue: number) => {
    setState((prev) => ({
      ...prev,
      family: {
        ...prev.family,
        [key]: nextValue,
      },
    }));
  };

  const handleResetFamily = () => {
    setState((prev) => ({
      ...prev,
      family: {
        suami: 0,
        istri: 0,
        anakL: 0,
        anakP: 0,
        cucuL: 0,
        cucuP: 0,
        cicitL: 0,
        cicitP: 0,
        ibu: 0,
        ayah: 0,
        kakek: 0,
        nenek: 0,
        buyutL: 0,
        buyutP: 0,
        saudaraL: 0,
        saudaraP: 0,
        anakTiri: 0,
        mertua: 0,
        menantu: 0,
      },
    }));
  };

  // Save / Load / Delete localStorage cases
  const handleSaveCase = (name: string, notes: string) => {
    const updated = saveCaseToStorage(name, notes, state, result.netEstate);
    setSavedCases(updated);
  };

  const handleLoadCase = (saved: SavedCase) => {
    setState({
      ...saved.state,
      identity: saved.state.identity ?? DEFAULT_IDENTITY,
    });
    setDraftRate(String(saved.state.exchangeRate));
    setRateFeedback(`Kasus "${saved.name}" berhasil dimuat.`);
  };

  const handleDeleteCase = (id: string) => {
    const updated = deleteCaseFromStorage(id);
    setSavedCases(updated);
  };

  const handleSaveIdentity = (identity: UserIdentity) => {
    setState((prev) => ({
      ...prev,
      identity,
    }));
    setShowIdentityModal(false);
  };

  const financialFields: Array<{
    key: keyof FinancialInputs;
    label: string;
    helper: string;
  }> = [
    {
      key: 'grossAssets',
      label: 'Total Harta Kotor (Gross Assets)',
      helper: 'Seluruh aset peninggalan pewaris (setelah dipisah harta bersama/gono-gini)',
    },
    {
      key: 'debts',
      label: 'Utang / Kewajiban',
      helper: 'Pinjaman, cicilan, atau tanggungan finansial pewaris',
    },
    {
      key: 'funeralCosts',
      label: 'Biaya Pemakaman (Tajhiz)',
      helper: 'Pengurusan jenazah dan biaya pemakaman yang wajar',
    },
    {
      key: 'willAmount',
      label: 'Wasiat / Hibah',
      helper: 'Maksimal 1/3 dari harta bersih sebelum wasiat (KHI Pasal 195)',
    },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900">
      {/* Header with Navy-to-Sky-Blue Gradient */}
      <header className="bg-gradient-to-r from-[#1e3a8a] via-[#1d4ed8] to-[#0284c7] text-white shadow-sm">
        <div className="mx-auto flex max-w-[1250px] flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-4">
            <div
              className="animate-gentle-float flex h-13 w-13 shrink-0 items-center justify-center rounded-xl bg-white/15 text-3xl backdrop-blur-xs"
              aria-hidden="true"
            >
              ⚖️
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                Simulator &amp; Kalkulator Hukum Waris Interaktif
              </h1>
              <p className="mt-0.5 text-xs text-sky-100 sm:text-sm">
                Komparasi Hukum Waris Islam (KHI &amp; Faraid) dan Hukum Waris Perdata Barat (KUHPerdata / BW)
              </p>
            </div>
          </div>

          <div className="no-print flex flex-wrap items-center gap-2.5 self-start sm:self-center">
            <button
              type="button"
              onClick={() => setShowIdentityModal(true)}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-white/25 bg-white/15 px-3.5 py-2 text-xs font-semibold text-white backdrop-blur-xs transition-colors hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-white"
            >
              <UserCheck className="h-4 w-4" />
              {state.identity?.fullName
                ? state.identity.fullName
                : state.identity?.deceasedName
                ? `Pewaris: ${state.identity.deceasedName}`
                : 'Identitas Kasus'}
            </button>
            <div className="rounded-lg bg-white/15 px-3.5 py-2 text-right backdrop-blur-xs">
              <div className="text-[11px] font-medium text-sky-100">Harta Bersih Siap Dibagi</div>
              <div className="font-mono-num text-base font-bold text-white sm:text-lg">
                {formatCurrency(result.netEstate, state.currency)}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Print-only Summary Header */}
      <div className="print-only hidden border-b border-slate-300 px-4 py-3 text-xs text-slate-700">
        {state.identity?.fullName && (
          <>
            <strong>Pengisi:</strong> {state.identity.fullName} ({state.identity.role}) ·{' '}
          </>
        )}
        {state.identity?.deceasedName && (
          <>
            <strong>Pewaris:</strong> {state.identity.deceasedName} ·{' '}
          </>
        )}
        <strong>Sistem Hukum:</strong>{' '}
        {state.legalSystem === 'islam' ? 'Hukum Waris Islam (KHI & Faraid)' : 'Hukum Waris Perdata Barat (KUHPerdata / BW)'}{' '}
        · <strong>Jenis Kelamin Pewaris:</strong> {state.deceasedGender === 'male' ? 'Laki-laki' : 'Perempuan'} ·{' '}
        <strong>Mata Uang:</strong> {state.currency} (1 USD = {formatRateIdr(state.exchangeRate)}) ·{' '}
        <strong>Harta Bersih:</strong> {formatCurrency(result.netEstate, state.currency)}
      </div>

      {/* Main Responsive 2-Column Workspace (max-width: 1250px) */}
      <main className="print-container mx-auto grid max-w-[1250px] grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-12">
        {/* LEFT COLUMN: Configuration, Financials, Family Composition */}
        <div className="space-y-6 lg:col-span-5">
          {/* 1. Basic Settings & Dynamic Exchange Rate */}
          <section className="no-print rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
            <h2 className="border-b border-slate-100 pb-3 text-base font-bold text-[#1e3a8a]">
              Pengaturan Dasar &amp; Kurs Dinamis
            </h2>

            <div className="mt-4 space-y-4">
              {/* Legal System */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Sistem Hukum Waris
                </label>
                <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => handleLegalSystemChange('islam')}
                    className={`rounded-md px-3 py-2 text-xs font-semibold transition-all ${
                      state.legalSystem === 'islam'
                        ? 'bg-[#1e3a8a] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Islam (KHI &amp; Faraid)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLegalSystemChange('civil')}
                    className={`rounded-md px-3 py-2 text-xs font-semibold transition-all ${
                      state.legalSystem === 'civil'
                        ? 'bg-[#1e3a8a] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Perdata (KUHPerdata / BW)
                  </button>
                </div>
              </div>

              {/* Deceased Gender & Currency Row */}
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Jenis Kelamin Pewaris
                  </label>
                  <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
                    <button
                      type="button"
                      onClick={() => handleGenderChange('male')}
                      className={`rounded-md px-2.5 py-2 text-xs font-semibold transition-all ${
                        state.deceasedGender === 'male'
                          ? 'bg-white text-[#1e3a8a] shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Laki-laki
                    </button>
                    <button
                      type="button"
                      onClick={() => handleGenderChange('female')}
                      className={`rounded-md px-2.5 py-2 text-xs font-semibold transition-all ${
                        state.deceasedGender === 'female'
                          ? 'bg-white text-[#1e3a8a] shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Perempuan
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Mata Uang Aktif
                  </label>
                  <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
                    <button
                      type="button"
                      onClick={() => handleCurrencySwitch('IDR')}
                      className={`rounded-md px-2.5 py-2 text-xs font-semibold transition-all ${
                        state.currency === 'IDR'
                          ? 'bg-[#0284c7] text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Rp (IDR)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCurrencySwitch('USD')}
                      className={`rounded-md px-2.5 py-2 text-xs font-semibold transition-all ${
                        state.currency === 'USD'
                          ? 'bg-[#0284c7] text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      $ (USD)
                    </button>
                  </div>
                </div>
              </div>

              {/* Independent Exchange Rate Input + Submit Button */}
              <form
                onSubmit={handleApplyRate}
                className="rounded-lg border border-sky-200/80 bg-[#e0f2fe]/40 p-3.5"
              >
                <label
                  htmlFor="exchange-rate-input"
                  className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#1e3a8a]"
                >
                  <ArrowRightLeft className="h-3.5 w-3.5 text-[#0284c7]" />
                  Konversi Kurs Mandiri (1 USD = Rp ...)
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500">
                      Rp
                    </span>
                    <input
                      id="exchange-rate-input"
                      type="text"
                      inputMode="numeric"
                      value={draftRate}
                      onChange={(e) => setDraftRate(e.target.value)}
                      className="font-mono-num h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm font-semibold text-slate-900 focus:border-[#0284c7] focus:outline-none focus:ring-2 focus:ring-[#0284c7]/20"
                    />
                  </div>
                  <button
                    type="submit"
                    className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#0284c7] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-[#0369a1] focus-visible:outline-2 focus-visible:outline-[#1e3a8a]"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Terapkan Kurs
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-1 text-[11px] text-slate-600">
                  <span>
                    Kurs aktif:{' '}
                    <strong className="font-mono-num text-[#1e3a8a]">
                      1 USD = {formatRateIdr(state.exchangeRate)}
                    </strong>
                  </span>
                  <span className="font-mono-num text-slate-500">
                    ≈ {formatCurrency(alternateNetEstate, state.currency === 'IDR' ? 'USD' : 'IDR')}
                  </span>
                </div>
                {rateFeedback && (
                  <p className="mt-1.5 flex items-start gap-1.5 text-[11px] font-medium text-[#0369a1]">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{rateFeedback}</span>
                  </p>
                )}
              </form>
            </div>
          </section>

          {/* 2. Financial Inputs & Net Estate Deductions */}
          <section className="no-print rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
            <h2 className="border-b border-slate-100 pb-3 text-base font-bold text-[#1e3a8a]">
              Harta Peninggalan &amp; Pengurang ({state.currency})
            </h2>

            <div className="mt-4 space-y-3.5">
              {financialFields.map((field) => (
                <div key={field.key}>
                  <label
                    htmlFor={`fin-${field.key}`}
                    className="mb-1 block text-xs font-semibold text-slate-800"
                  >
                    {field.label}
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                      {state.currency === 'IDR' ? 'Rp' : '$'}
                    </span>
                    <input
                      id={`fin-${field.key}`}
                      type="text"
                      inputMode="decimal"
                      value={formatInputNumber(state.financials[field.key], state.currency)}
                      onChange={(e) => handleFinancialChange(field.key, e.target.value)}
                      className="font-mono-num h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm font-semibold text-slate-900 focus:border-[#0284c7] focus:outline-none focus:ring-2 focus:ring-[#0284c7]/20"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">{field.helper}</p>
                </div>
              ))}
            </div>

            {/* 1/3 Wasiat Warning (KHI) */}
            {result.isWillExcessive && (
              <div
                role="alert"
                className="mt-4 flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 p-3.5 text-xs leading-relaxed text-amber-900"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div>
                  <strong className="font-bold">Peringatan Batas Wasiat 1/3 (KHI Pasal 195):</strong>{' '}
                  Nilai wasiat ({formatCurrency(state.financials.willAmount, state.currency)}) melebihi batas maksimal 1/3 dari harta bersih sebelum wasiat (maksimal{' '}
                  <span className="font-mono-num font-bold">
                    {formatCurrency(result.maxAllowedWill, state.currency)}
                  </span>
                  ). Kelebihan wasiat hanya sah apabila disetujui oleh seluruh ahli waris.
                </div>
              </div>
            )}

            {/* Net Estate Summary Box */}
            <div className="mt-4 rounded-xl border border-sky-200 bg-gradient-to-br from-[#e0f2fe]/60 to-white p-4">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Harta Bersih Siap Dibagi</span>
                <span className="font-mono-num text-[11px] text-slate-500">
                  Gross − Utang − Pemakaman − Wasiat
                </span>
              </div>
              <div className="font-mono-num mt-1 text-2xl font-bold text-[#1e3a8a]">
                {formatCurrency(result.netEstate, state.currency)}
              </div>
              <div className="font-mono-num mt-0.5 text-xs text-[#0284c7]">
                Setara {formatCurrency(alternateNetEstate, state.currency === 'IDR' ? 'USD' : 'IDR')} (kurs{' '}
                {formatRateIdr(state.exchangeRate)}/USD)
              </div>
            </div>
          </section>

          {/* 3. Super Complete Family Composition */}
          <FamilyCompositionPanel
            family={state.family}
            deceasedGender={state.deceasedGender}
            onChangeCount={handleFamilyCountChange}
            onResetFamily={handleResetFamily}
          />
        </div>

        {/* RIGHT COLUMN: Visualization, Results Matrix, AI Legal Coach, Saved Cases */}
        <div className="space-y-6 lg:col-span-7">
          {/* Summary KPI Strip */}
          <div className="print-card grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="text-xs font-medium text-slate-500">Sistem Hukum Aktif</div>
              <div className="mt-1 text-sm font-bold text-[#1e3a8a]">
                {state.legalSystem === 'islam' ? 'Islam (KHI & Faraid)' : 'Perdata (KUHPerdata / BW)'}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500">
                Pewaris: {state.deceasedGender === 'male' ? 'Laki-laki' : 'Perempuan'}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="text-xs font-medium text-slate-500">Ahli Waris Menerima</div>
              <div className="font-mono-num mt-1 text-lg font-bold text-emerald-700">
                {result.rows.filter((r) => r.statusTone === 'eligible').length} Kelompok
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500">
                {result.rows.filter((r) => r.statusTone === 'blocked').length} terhalang ·{' '}
                {result.rows.filter((r) => r.statusTone === 'non_heir').length} non-ahli waris
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="text-xs font-medium text-slate-500">Batas Maks. Wasiat (1/3)</div>
              <div className="font-mono-num mt-1 text-base font-bold text-slate-900">
                {formatCurrency(result.maxAllowedWill, state.currency)}
              </div>
              <div
                className={`mt-0.5 text-[11px] font-medium ${
                  result.isWillExcessive ? 'text-amber-700' : 'text-emerald-700'
                }`}
              >
                {result.isWillExcessive ? 'Melebihi batas 1/3 KHI' : 'Dalam batas aman KHI'}
              </div>
            </div>
          </div>

          {/* Interactive Chart.js Doughnut Visualization */}
          <section className="print-card rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
            <div className="mb-4 border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-[#1e3a8a]">
                Visualisasi Proporsi Pembagian Waris
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Menampilkan ahli waris yang menerima nominal &gt; 0 dalam mata uang {state.currency}.
              </p>
            </div>
            <DistributionChart
              rows={result.rows}
              currency={state.currency}
              netEstate={result.netEstate}
            />
          </section>

          {/* Complete Results Matrix + Print/CSV Export */}
          <ResultsMatrix
            state={state}
            result={result}
            onExportCsv={() => exportResultsToCsv(state, result)}
            onPrint={() => window.print()}
          />

          {/* Interactive AI Legal Coach */}
          <AiLegalCoachPanel state={state} result={result} />

          {/* LocalStorage History Manager */}
          <SavedCasesPanel
            cases={savedCases}
            onSaveCase={handleSaveCase}
            onLoadCase={handleLoadCase}
            onDeleteCase={handleDeleteCase}
          />
        </div>
      </main>

      <footer className="no-print mt-8 border-t border-slate-200 bg-white py-5 text-center text-xs text-slate-500">
        <div className="mx-auto max-w-[1250px] px-4">
          Simulator &amp; Kalkulator Hukum Waris Interaktif · Perhitungan edukatif berbasis KHI/Faraid &amp; KUHPerdata (BW). Untuk penetapan resmi, konsultasikan dengan Pengadilan Agama, Pengadilan Negeri, atau Notaris/PPAT.
        </div>
      </footer>

      {/* Pre-start Dismissible Identity Modal */}
      <IdentityModal
        isOpen={showIdentityModal}
        initialIdentity={state.identity ?? DEFAULT_IDENTITY}
        onSave={handleSaveIdentity}
        onClose={() => setShowIdentityModal(false)}
      />
    </div>
  );
}

export default App;
