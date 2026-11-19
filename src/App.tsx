import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  Cloud,
  LogIn,
  LogOut,
  Palette,
  RefreshCw,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import {
  AppState,
  CurrencyCode,
  DEFAULT_EXCHANGE_RATE,
  DeceasedGender,
  FinancialInputs,
  FirestoreAdminRecord,
  FirestoreCoachLog,
  FirestoreIdentityRecord,
  FirestoreSimulationLog,
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
import { auth, googleProvider, isBootstrappedAdminUser } from './firebase';
import {
  addAdminRecord,
  checkIsAdminInDb,
  deleteCaseFromFirestore,
  deleteCoachLogFromFirestore,
  deleteIdentityFromFirestore,
  deleteSimulationLogFromFirestore,
  removeAdminRecord,
  saveCaseToFirestore,
  saveCoachLogToFirestore,
  saveIdentityToFirestore,
  saveSimulationLogToFirestore,
  subscribeToAdmins,
  subscribeToCases,
  subscribeToCoachLogs,
  subscribeToIdentities,
  subscribeToSimulationLogs,
  syncUserProfile,
  updateCaseInFirestore,
  updateCoachLogInFirestore,
  updateIdentityInFirestore,
  updateSimulationLogInFirestore,
} from './modules/firestoreService';
import {
  APP_THEMES,
  getThemeById,
  loadSavedThemeId,
  saveThemeId,
  ThemeId,
} from './modules/themes';
import { AdminDatasetType, parseExcelImportFile } from './modules/excelTools';
import { FamilyCompositionPanel } from './components/FamilyCompositionPanel';
import { DistributionChart } from './components/DistributionChart';
import { ResultsMatrix } from './components/ResultsMatrix';
import { AiLegalCoachPanel } from './components/AiLegalCoachPanel';
import { SavedCasesPanel } from './components/SavedCasesPanel';
import { IdentityModal } from './components/IdentityModal';
import { AuthModal } from './components/AuthModal';
import { AdminDashboardPanel } from './components/AdminDashboardPanel';

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

  // Theme state
  const [themeId, setThemeId] = useState<ThemeId>(() => loadSavedThemeId());
  const theme = useMemo(() => getThemeById(themeId), [themeId]);

  const handleSelectTheme = (nextId: ThemeId) => {
    setThemeId(nextId);
    saveThemeId(nextId);
  };

  // Local fallback cases (for pre-login drafts)
  const [localCases, setLocalCases] = useState<SavedCase[]>(() => loadSavedCases());

  // Modals
  const [showIdentityModal, setShowIdentityModal] = useState<boolean>(true);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);

  // Pending identity filled before login so it automatically enters Firestore on sign-in
  const pendingIdentityRef = useRef<UserIdentity | null>(null);

  // Firebase Auth & Role State
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isBootstrappedAdmin, setIsBootstrappedAdmin] = useState<boolean>(false);
  const [dbSyncNotice, setDbSyncNotice] = useState<string | null>(null);
  const [asyncError, setAsyncError] = useState<Error | null>(null);

  // Firestore Real-time Data
  const [firestoreCases, setFirestoreCases] = useState<SavedCase[]>([]);
  const [firestoreSimulationLogs, setFirestoreSimulationLogs] = useState<FirestoreSimulationLog[]>([]);
  const [firestoreIdentities, setFirestoreIdentities] = useState<FirestoreIdentityRecord[]>([]);
  const [firestoreCoachLogs, setFirestoreCoachLogs] = useState<FirestoreCoachLog[]>([]);
  const [firestoreAdmins, setFirestoreAdmins] = useState<FirestoreAdminRecord[]>([]);

  const lastLoggedSignatureRef = useRef<string>('');

  // Surface Firestore async listener errors to ErrorBoundary cleanly
  if (asyncError) {
    throw asyncError;
  }

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user && user.emailVerified) {
        try {
          await syncUserProfile(user);
          const bootstrapped = isBootstrappedAdminUser(user);
          const adminFlag = bootstrapped || (await checkIsAdminInDb(user));
          setIsBootstrappedAdmin(bootstrapped);
          setIsAdmin(adminFlag);

          // Automatically push pending pre-login identity into Firestore
          if (pendingIdentityRef.current) {
            const pending = pendingIdentityRef.current;
            pendingIdentityRef.current = null;
            await saveIdentityToFirestore(user, pending);
            setDbSyncNotice('Identitas Anda berhasil disimpan ke Database Firestore.');
            window.setTimeout(() => setDbSyncNotice(null), 4000);
          }
        } catch (err) {
          setAsyncError(err instanceof Error ? err : new Error(String(err)));
        }
      } else {
        setIsAdmin(false);
        setIsBootstrappedAdmin(false);
        setFirestoreCases([]);
        setFirestoreSimulationLogs([]);
        setFirestoreIdentities([]);
        setFirestoreCoachLogs([]);
        setFirestoreAdmins([]);
      }
      setAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  // Attach Firestore real-time listeners once auth is ready & user is authenticated
  useEffect(() => {
    if (!authReady || !currentUser || !currentUser.emailVerified) return;

    const unsubCases = subscribeToCases(
      currentUser,
      isAdmin,
      (items) => setFirestoreCases(items),
      (err) => setAsyncError(err)
    );

    const unsubSimLogs = subscribeToSimulationLogs(
      currentUser,
      isAdmin,
      (items) => setFirestoreSimulationLogs(items),
      (err) => setAsyncError(err)
    );

    const unsubIdentities = subscribeToIdentities(
      currentUser,
      isAdmin,
      (items) => setFirestoreIdentities(items),
      (err) => setAsyncError(err)
    );

    const unsubLogs = subscribeToCoachLogs(
      currentUser,
      isAdmin,
      (items) => setFirestoreCoachLogs(items),
      (err) => setAsyncError(err)
    );

    let unsubAdmins: (() => void) | undefined;
    if (isBootstrappedAdmin) {
      unsubAdmins = subscribeToAdmins(
        (items) => setFirestoreAdmins(items),
        (err) => setAsyncError(err)
      );
    }

    return () => {
      unsubCases();
      unsubSimLogs();
      unsubIdentities();
      unsubLogs();
      if (unsubAdmins) unsubAdmins();
    };
  }, [authReady, currentUser, isAdmin, isBootstrappedAdmin]);

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

  // Helper to record simulation activity to Firestore
  const recordSimulationActivity = (action: string, titleOverride?: string) => {
    if (!currentUser || !currentUser.emailVerified) return;
    const eligibleCount = result.rows.filter((r) => r.statusTone === 'eligible').length;
    const blockedCount = result.rows.filter((r) => r.statusTone === 'blocked').length;
    const title =
      titleOverride ||
      (state.identity?.deceasedName
        ? `Simulasi Waris ${state.identity.deceasedName}`
        : `Simulasi ${state.legalSystem === 'islam' ? 'Islam (KHI)' : 'Perdata (BW)'}`);
    const summaryText = `${eligibleCount} kelompok menerima waris, ${blockedCount} terhalang. Total terdistribusi ${formatCurrency(
      result.totalDistributedAmount,
      state.currency
    )}.`;
    void saveSimulationLogToFirestore(
      currentUser,
      action,
      title,
      state,
      result.netEstate,
      summaryText
    );
  };

  // Debounced automatic simulation log whenever authenticated user modifies simulation parameters
  useEffect(() => {
    if (!currentUser || !currentUser.emailVerified) return;
    const signature = JSON.stringify({
      s: state.legalSystem,
      g: state.deceasedGender,
      c: state.currency,
      r: state.exchangeRate,
      f: state.financials,
      fam: state.family,
    });
    if (!lastLoggedSignatureRef.current) {
      lastLoggedSignatureRef.current = signature;
      return;
    }
    if (signature === lastLoggedSignatureRef.current) return;

    const timer = window.setTimeout(() => {
      lastLoggedSignatureRef.current = signature;
      recordSimulationActivity('Simulasi Otomatis');
    }, 2800);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentUser,
    state.legalSystem,
    state.deceasedGender,
    state.currency,
    state.exchangeRate,
    state.financials,
    state.family,
  ]);

  // Alternate currency preview for net estate
  const alternateNetEstate = useMemo(() => {
    if (state.exchangeRate <= 0) return 0;
    return state.currency === 'IDR'
      ? result.netEstate / state.exchangeRate
      : result.netEstate * state.exchangeRate;
  }, [result.netEstate, state.currency, state.exchangeRate]);

  // Cases displayed in SavedCasesPanel (Firestore for logged-in user, localStorage otherwise)
  const displayedCases = useMemo(() => {
    if (currentUser && currentUser.emailVerified) {
      if (isAdmin) {
        return firestoreCases.filter((c) => c.ownerId === currentUser.uid);
      }
      return firestoreCases;
    }
    return localCases;
  }, [currentUser, isAdmin, firestoreCases, localCases]);

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
      recordSimulationActivity('Terapkan Kurs', `Kurs Baru ${formatRateIdr(newRate)}/USD`);
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

  // Google Sign-In & Sign-Out handlers
  const handleGoogleLogin = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const handleLogout = async () => {
    await signOut(auth);
    setDbSyncNotice('Anda telah keluar dari akun.');
    window.setTimeout(() => setDbSyncNotice(null), 3000);
  };

  // Identity save (saves to Firestore immediately if logged in, or queues for login sync)
  const handleSaveIdentity = async (identity: UserIdentity) => {
    setState((prev) => ({
      ...prev,
      identity,
    }));
    setShowIdentityModal(false);

    if (currentUser && currentUser.emailVerified) {
      await saveIdentityToFirestore(currentUser, identity);
      recordSimulationActivity(
        'Simpan Identitas',
        identity.deceasedName ? `Identitas ${identity.deceasedName}` : 'Identitas Pengguna'
      );
      setDbSyncNotice('Identitas tersimpan ke Database Firestore.');
      window.setTimeout(() => setDbSyncNotice(null), 3500);
    } else {
      pendingIdentityRef.current = identity;
    }
  };

  // Case save/load/delete handlers (Firestore when authenticated, localStorage fallback when offline/guest)
  const handleSaveCase = async (name: string, notes: string) => {
    if (currentUser && currentUser.emailVerified) {
      await saveCaseToFirestore(currentUser, name, notes, state, result.netEstate);
      recordSimulationActivity('Simpan Kasus', name || 'Kasus Tersimpan');
      return;
    }
    const updated = saveCaseToStorage(name, notes, state, result.netEstate);
    setLocalCases(updated);
  };

  const handleLoadCase = (saved: SavedCase) => {
    setState({
      ...saved.state,
      identity: saved.state.identity ?? DEFAULT_IDENTITY,
    });
    setDraftRate(String(saved.state.exchangeRate));
    setRateFeedback(`Kasus "${saved.name}" berhasil dimuat.`);
  };

  const handleLoadSimulationLog = (log: FirestoreSimulationLog) => {
    setState({
      currency: log.currency,
      exchangeRate: log.exchangeRate,
      legalSystem: log.legalSystem,
      deceasedGender: log.deceasedGender,
      financials: log.financials,
      family: log.family,
      identity: log.identity ?? DEFAULT_IDENTITY,
    });
    setDraftRate(String(log.exchangeRate));
    setRateFeedback(`Log simulasi "${log.title}" berhasil dimuat ke simulator.`);
  };

  const handleDeleteCase = async (saved: SavedCase) => {
    if (saved.source === 'firestore' || (currentUser && currentUser.emailVerified)) {
      await deleteCaseFromFirestore(saved.id);
      return;
    }
    const updated = deleteCaseFromStorage(saved.id);
    setLocalCases(updated);
  };

  const handleSyncLocalCasesToFirestore = async () => {
    if (!currentUser || !currentUser.emailVerified || localCases.length === 0) return;
    for (const item of localCases) {
      await saveCaseToFirestore(
        currentUser,
        item.name,
        item.notes,
        item.state,
        item.netEstateSnapshot
      );
      deleteCaseFromStorage(item.id);
    }
    setLocalCases([]);
    setDbSyncNotice('Seluruh kasus lokal berhasil dikirim ke Database Firestore.');
    window.setTimeout(() => setDbSyncNotice(null), 4000);
  };

  const handleCoachLog = (question: string, answer: string) => {
    if (currentUser && currentUser.emailVerified) {
      void saveCoachLogToFirestore(currentUser, question, answer, state.legalSystem);
    }
  };

  const handleImportDataset = async (
    type: AdminDatasetType,
    file: File
  ): Promise<number> => {
    if (!currentUser || !currentUser.emailVerified) {
      throw new Error('Harus login sebagai admin terverifikasi untuk mengimpor data.');
    }
    const parsed = await parseExcelImportFile(file, type);
    let count = 0;

    if (type === 'cases') {
      for (const c of parsed.cases) {
        await saveCaseToFirestore(
          currentUser,
          c.name,
          c.notes,
          {
            currency: c.currency,
            exchangeRate: c.exchangeRate,
            legalSystem: c.legalSystem,
            deceasedGender: c.deceasedGender,
            financials: c.financials,
            family: c.family,
            identity: c.identity,
          },
          c.netEstateSnapshot
        );
        count++;
      }
    } else if (type === 'simulationLogs') {
      for (const l of parsed.simulationLogs) {
        await saveSimulationLogToFirestore(
          currentUser,
          l.action,
          l.title,
          {
            currency: l.currency,
            exchangeRate: l.exchangeRate,
            legalSystem: l.legalSystem,
            deceasedGender: l.deceasedGender,
            financials: l.financials,
            family: l.family,
            identity: l.identity,
          },
          l.netEstate,
          l.summaryText
        );
        count++;
      }
    } else if (type === 'identities') {
      for (const idn of parsed.identities) {
        await saveIdentityToFirestore(currentUser, idn);
        count++;
      }
    } else if (type === 'coachLogs') {
      for (const log of parsed.coachLogs) {
        await saveCoachLogToFirestore(currentUser, log.question, log.answer, log.legalSystem);
        count++;
      }
    }

    return count;
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

  const isSignedInVerified = Boolean(currentUser && currentUser.emailVerified);

  // Bright, unmistakable active selection style
  const brightActiveStyle: React.CSSProperties = {
    backgroundColor: theme.bright,
    color: theme.brightText,
    boxShadow: `0 2px 8px ${theme.bright}55`,
  };

  return (
    <div className="min-h-screen text-slate-900" style={{ backgroundColor: theme.pageBg }}>
      {/* Dynamic Themed Header */}
      <header
        className="text-white shadow-sm"
        style={{
          backgroundImage: `linear-gradient(to right, ${theme.headerFrom}, ${theme.headerVia}, ${theme.headerTo})`,
        }}
      >
        <div className="mx-auto flex max-w-[1250px] flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
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
              <p className="mt-0.5 text-xs text-white/85 sm:text-sm">
                Komparasi Hukum Waris Islam (KHI &amp; Faraid) dan Hukum Waris Perdata Barat (KUHPerdata / BW)
              </p>
            </div>
          </div>

          <div className="no-print flex flex-wrap items-center gap-2.5 self-start lg:self-center">
            {/* Theme Picker */}
            <div
              className="flex h-10 items-center gap-1.5 rounded-lg border border-white/25 bg-white/15 px-2.5 backdrop-blur-xs"
              title={`Tema aktif: ${theme.name}`}
            >
              <Palette className="h-3.5 w-3.5 text-white/90" />
              <div className="flex items-center gap-1.5">
                {APP_THEMES.map((t) => {
                  const isActive = t.id === themeId;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleSelectTheme(t.id)}
                      aria-label={`Pilih tema ${t.name}`}
                      title={t.name}
                      className={`h-5 w-5 rounded-full border-2 transition-transform ${
                        isActive
                          ? 'scale-115 border-white ring-2 ring-white/70'
                          : 'border-white/50 opacity-80 hover:scale-105 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: t.swatch }}
                    />
                  );
                })}
              </div>
            </div>

            {/* Identity Modal Trigger */}
            <button
              type="button"
              onClick={() => setShowIdentityModal(true)}
              className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-lg border border-white/25 bg-white/15 px-3.5 text-xs font-semibold text-white backdrop-blur-xs transition-colors hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-white"
            >
              <UserCheck className="h-4 w-4" />
              {state.identity?.fullName
                ? state.identity.fullName
                : state.identity?.deceasedName
                ? `Pewaris: ${state.identity.deceasedName}`
                : 'Identitas Kasus'}
            </button>

            {/* Auth / Admin Login Controls */}
            {isSignedInVerified ? (
              <div className="flex items-center gap-2">
                <div className="flex h-10 items-center gap-2 rounded-lg border border-white/25 bg-white/15 px-3 text-xs backdrop-blur-xs">
                  {isAdmin ? (
                    <ShieldCheck className="h-4 w-4 text-emerald-300" />
                  ) : (
                    <Cloud className="h-4 w-4 text-sky-200" />
                  )}
                  <span className="max-w-[140px] truncate font-semibold">
                    {currentUser?.displayName || currentUser?.email}
                  </span>
                  <span className="text-[11px] text-white/85">
                    ({isAdmin ? 'Admin' : 'Terhubung'})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  title="Keluar akun"
                  className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/25 bg-white/10 px-3 text-xs font-semibold text-white transition-colors hover:bg-white/20"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Keluar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-lg px-3.5 text-xs font-bold shadow-xs transition-opacity hover:opacity-95 focus-visible:outline-2 focus-visible:outline-white"
                style={{ backgroundColor: theme.bright, color: theme.brightText }}
              >
                <LogIn className="h-4 w-4" />
                Login Admin / Akun
              </button>
            )}

            {/* Net Estate Readout */}
            <div className="rounded-lg bg-white/15 px-3.5 py-1.5 text-right backdrop-blur-xs">
              <div className="text-[10px] font-medium text-white/85">Harta Bersih Siap Dibagi</div>
              <div className="font-mono-num text-sm font-bold text-white sm:text-base">
                {formatCurrency(result.netEstate, state.currency)}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Sync / Auth Feedback Banner */}
      {dbSyncNotice && (
        <div className="no-print border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-center text-xs font-medium text-emerald-800">
          {dbSyncNotice}
        </div>
      )}

      {/* Print-only Summary Header (for normal Simulator PDF print) */}
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

      {/* Admin Real-Time Database Panel (Visible exclusively when logged in as Admin) */}
      {isSignedInVerified && isAdmin && (
        <AdminDashboardPanel
          isBootstrappedAdmin={isBootstrappedAdmin}
          theme={theme}
          cases={firestoreCases}
          simulationLogs={firestoreSimulationLogs}
          identities={firestoreIdentities}
          coachLogs={firestoreCoachLogs}
          admins={firestoreAdmins}
          onLoadCase={handleLoadCase}
          onLoadSimulationLog={handleLoadSimulationLog}
          onUpdateCase={updateCaseInFirestore}
          onDeleteCase={deleteCaseFromFirestore}
          onUpdateSimulationLog={updateSimulationLogInFirestore}
          onDeleteSimulationLog={deleteSimulationLogFromFirestore}
          onUpdateIdentity={updateIdentityInFirestore}
          onDeleteIdentity={deleteIdentityFromFirestore}
          onUpdateCoachLog={updateCoachLogInFirestore}
          onDeleteCoachLog={deleteCoachLogFromFirestore}
          onImportDataset={handleImportDataset}
          onAddAdmin={async (uid, email, label) => {
            if (currentUser) {
              await addAdminRecord(currentUser, uid, email, label);
            }
          }}
          onRemoveAdmin={removeAdminRecord}
        />
      )}

      {/* Main Responsive 2-Column Workspace (max-width: 1250px) */}
      <main className="simulator-workspace print-container mx-auto grid max-w-[1250px] grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-12">
        {/* LEFT COLUMN: Configuration, Financials, Family Composition */}
        <div className="space-y-6 lg:col-span-5">
          {/* 1. Basic Settings & Dynamic Exchange Rate */}
          <section className="no-print rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold" style={{ color: theme.primary }}>
                Pengaturan Dasar &amp; Kurs Dinamis
              </h2>
              <span
                className="rounded px-2 py-0.5 text-[10px] font-bold"
                style={{ backgroundColor: theme.tint, color: theme.primary }}
              >
                Tema: {theme.name}
              </span>
            </div>

            <div className="mt-4 space-y-4">
              {/* Legal System (Bright Selection Highlight) */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Sistem Hukum Waris
                </label>
                <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => handleLegalSystemChange('islam')}
                    style={state.legalSystem === 'islam' ? brightActiveStyle : undefined}
                    className={`rounded-md px-3 py-2 text-xs font-bold transition-all ${
                      state.legalSystem === 'islam'
                        ? ''
                        : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
                    }`}
                  >
                    Islam (KHI &amp; Faraid)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLegalSystemChange('civil')}
                    style={state.legalSystem === 'civil' ? brightActiveStyle : undefined}
                    className={`rounded-md px-3 py-2 text-xs font-bold transition-all ${
                      state.legalSystem === 'civil'
                        ? ''
                        : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
                    }`}
                  >
                    Perdata (KUHPerdata / BW)
                  </button>
                </div>
              </div>

              {/* Deceased Gender & Currency Row (Bright Selection Highlights) */}
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Jenis Kelamin Pewaris
                  </label>
                  <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
                    <button
                      type="button"
                      onClick={() => handleGenderChange('male')}
                      style={state.deceasedGender === 'male' ? brightActiveStyle : undefined}
                      className={`rounded-md px-2.5 py-2 text-xs font-bold transition-all ${
                        state.deceasedGender === 'male'
                          ? ''
                          : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
                      }`}
                    >
                      Laki-laki
                    </button>
                    <button
                      type="button"
                      onClick={() => handleGenderChange('female')}
                      style={state.deceasedGender === 'female' ? brightActiveStyle : undefined}
                      className={`rounded-md px-2.5 py-2 text-xs font-bold transition-all ${
                        state.deceasedGender === 'female'
                          ? ''
                          : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
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
                      style={state.currency === 'IDR' ? brightActiveStyle : undefined}
                      className={`rounded-md px-2.5 py-2 text-xs font-bold transition-all ${
                        state.currency === 'IDR'
                          ? ''
                          : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
                      }`}
                    >
                      Rp (IDR)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCurrencySwitch('USD')}
                      style={state.currency === 'USD' ? brightActiveStyle : undefined}
                      className={`rounded-md px-2.5 py-2 text-xs font-bold transition-all ${
                        state.currency === 'USD'
                          ? ''
                          : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
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
                className="rounded-lg border p-3.5"
                style={{
                  backgroundColor: theme.tint,
                  borderColor: theme.border,
                }}
              >
                <label
                  htmlFor="exchange-rate-input"
                  className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold"
                  style={{ color: theme.primary }}
                >
                  <ArrowRightLeft className="h-3.5 w-3.5" />
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
                      className="font-mono-num h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2"
                    />
                  </div>
                  <button
                    type="submit"
                    className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 text-xs font-bold transition-opacity hover:opacity-90"
                    style={{ backgroundColor: theme.bright, color: theme.brightText }}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Terapkan Kurs
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-1 text-[11px] text-slate-600">
                  <span>
                    Kurs aktif:{' '}
                    <strong className="font-mono-num" style={{ color: theme.primary }}>
                      1 USD = {formatRateIdr(state.exchangeRate)}
                    </strong>
                  </span>
                  <span className="font-mono-num text-slate-600">
                    ≈ {formatCurrency(alternateNetEstate, state.currency === 'IDR' ? 'USD' : 'IDR')}
                  </span>
                </div>
                {rateFeedback && (
                  <p
                    className="mt-1.5 flex items-start gap-1.5 text-[11px] font-medium"
                    style={{ color: theme.primary }}
                  >
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{rateFeedback}</span>
                  </p>
                )}
              </form>
            </div>
          </section>

          {/* 2. Financial Inputs & Net Estate Deductions */}
          <section className="no-print rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
            <h2 className="border-b border-slate-100 pb-3 text-base font-bold" style={{ color: theme.primary }}>
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
                      className="font-mono-num h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2"
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
            <div
              className="mt-4 rounded-xl border p-4"
              style={{
                background: `linear-gradient(135deg, ${theme.tint}, #ffffff)`,
                borderColor: theme.border,
              }}
            >
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Harta Bersih Siap Dibagi</span>
                <span className="font-mono-num text-[11px] text-slate-500">
                  Gross − Utang − Pemakaman − Wasiat
                </span>
              </div>
              <div className="font-mono-num mt-1 text-2xl font-bold" style={{ color: theme.primary }}>
                {formatCurrency(result.netEstate, state.currency)}
              </div>
              <div className="font-mono-num mt-0.5 text-xs font-medium" style={{ color: theme.primary }}>
                Setara {formatCurrency(alternateNetEstate, state.currency === 'IDR' ? 'USD' : 'IDR')} (kurs{' '}
                {formatRateIdr(state.exchangeRate)}/USD)
              </div>
            </div>
          </section>

          {/* 3. Super Complete Family Composition */}
          <FamilyCompositionPanel
            family={state.family}
            deceasedGender={state.deceasedGender}
            theme={theme}
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
              <div className="mt-1 text-sm font-bold" style={{ color: theme.primary }}>
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
              <h2 className="text-base font-bold" style={{ color: theme.primary }}>
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
              palette={theme.chartPalette}
              primaryColor={theme.primary}
            />
          </section>

          {/* Complete Results Matrix + Print/CSV Export */}
          <ResultsMatrix
            state={state}
            result={result}
            theme={theme}
            onExportCsv={() => {
              exportResultsToCsv(state, result);
              recordSimulationActivity('Ekspor CSV', 'Ekspor Laporan CSV');
            }}
            onPrint={() => {
              recordSimulationActivity('Cetak PDF', 'Cetak Laporan Simulasi');
              window.print();
            }}
          />

          {/* Interactive AI Legal Coach */}
          <AiLegalCoachPanel
            state={state}
            result={result}
            theme={theme}
            onLogInteraction={handleCoachLog}
          />

          {/* Database / LocalStorage History Manager */}
          <SavedCasesPanel
            cases={displayedCases}
            isAuthenticated={isSignedInVerified}
            localPendingCount={localCases.length}
            theme={theme}
            onSaveCase={handleSaveCase}
            onLoadCase={handleLoadCase}
            onDeleteCase={handleDeleteCase}
            onLoginClick={() => setShowAuthModal(true)}
            onSyncLocalCases={handleSyncLocalCasesToFirestore}
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
        onSave={(identity) => void handleSaveIdentity(identity)}
        onClose={() => setShowIdentityModal(false)}
      />

      {/* Google Login & Admin Access Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onGoogleLogin={handleGoogleLogin}
      />
    </div>
  );
}

export default App;
