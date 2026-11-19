import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Check,
  Database,
  Download,
  Edit3,
  FileSpreadsheet,
  FolderOpen,
  MessageSquare,
  Printer,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  AppState,
  CurrencyCode,
  DeceasedGender,
  FirestoreAdminRecord,
  FirestoreCoachLog,
  FirestoreIdentityRecord,
  FirestoreSimulationLog,
  HEIR_METADATA,
  HeirKey,
  LegalSystem,
  SavedCase,
  UserIdentity,
} from '../types/inheritance';
import { formatCurrency, formatRateIdr } from '../modules/currency';
import { BOOTSTRAPPED_ADMIN_EMAIL } from '../firebase';
import { AppTheme } from '../modules/themes';
import { AdminDatasetType, exportAdminDatasetToExcel } from '../modules/excelTools';

interface AdminDashboardPanelProps {
  isBootstrappedAdmin: boolean;
  theme: AppTheme;
  cases: SavedCase[];
  simulationLogs: FirestoreSimulationLog[];
  identities: FirestoreIdentityRecord[];
  coachLogs: FirestoreCoachLog[];
  admins: FirestoreAdminRecord[];
  onLoadCase: (saved: SavedCase) => void;
  onLoadSimulationLog: (log: FirestoreSimulationLog) => void;
  onUpdateCase: (
    caseId: string,
    payload: {
      name: string;
      notes: string;
      state: AppState;
      netEstateSnapshot: number;
    }
  ) => Promise<void>;
  onDeleteCase: (caseId: string) => Promise<void>;
  onUpdateSimulationLog: (
    logId: string,
    payload: {
      title: string;
      action: string;
      legalSystem: LegalSystem;
      deceasedGender: DeceasedGender;
      currency: CurrencyCode;
      netEstate: number;
      summaryText: string;
    }
  ) => Promise<void>;
  onDeleteSimulationLog: (logId: string) => Promise<void>;
  onUpdateIdentity: (identityId: string, identity: UserIdentity) => Promise<void>;
  onDeleteIdentity: (identityId: string) => Promise<void>;
  onUpdateCoachLog: (
    logId: string,
    payload: { question: string; answer: string; legalSystem: LegalSystem }
  ) => Promise<void>;
  onDeleteCoachLog: (logId: string) => Promise<void>;
  onImportDataset: (type: AdminDatasetType, file: File) => Promise<number>;
  onAddAdmin: (uid: string, email: string, label: string) => Promise<void>;
  onRemoveAdmin: (uid: string) => Promise<void>;
}

type AdminTab = AdminDatasetType | 'admins';

type EditModalState =
  | { type: 'cases'; item: SavedCase }
  | { type: 'simulationLogs'; item: FirestoreSimulationLog }
  | { type: 'identities'; item: FirestoreIdentityRecord }
  | { type: 'coachLogs'; item: FirestoreCoachLog }
  | null;

function summarizeFamily(family?: Record<string, number>): string {
  if (!family) return '-';
  const parts: string[] = [];
  for (const key of Object.keys(HEIR_METADATA) as HeirKey[]) {
    const count = Number(family[key] ?? 0);
    if (count > 0) {
      parts.push(`${HEIR_METADATA[key].shortLabel}: ${count}`);
    }
  }
  return parts.length > 0 ? parts.join(', ') : 'Belum ada anggota keluarga';
}

export const AdminDashboardPanel: React.FC<AdminDashboardPanelProps> = ({
  isBootstrappedAdmin,
  theme,
  cases,
  simulationLogs,
  identities,
  coachLogs,
  admins,
  onLoadCase,
  onLoadSimulationLog,
  onUpdateCase,
  onDeleteCase,
  onUpdateSimulationLog,
  onDeleteSimulationLog,
  onUpdateIdentity,
  onDeleteIdentity,
  onUpdateCoachLog,
  onDeleteCoachLog,
  onImportDataset,
  onAddAdmin,
  onRemoveAdmin,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('simulationLogs');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [editModal, setEditModal] = useState<EditModalState>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Edit form fields
  const [editField1, setEditField1] = useState('');
  const [editField2, setEditField2] = useState('');
  const [editField3, setEditField3] = useState('');
  const [editField4, setEditField4] = useState('');
  const [editField5, setEditField5] = useState('');
  const [editField6, setEditField6] = useState('');
  const [editSystem, setEditSystem] = useState<LegalSystem>('islam');
  const [editGender, setEditGender] = useState<DeceasedGender>('male');
  const [editCurrency, setEditCurrency] = useState<CurrencyCode>('IDR');
  const [editNumber, setEditNumber] = useState<string>('0');

  // Admin management inputs
  const [newAdminUid, setNewAdminUid] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminLabel, setNewAdminLabel] = useState('');
  const [adminMsg, setAdminMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Clear selection when tab changes
  useEffect(() => {
    setSelectedIds(new Set());
    setConfirmBulkDelete(false);
    setSearchTerm('');
  }, [activeTab]);

  // Filtered datasets
  const filteredCases = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return cases;
    return cases.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.ownerName ?? '').toLowerCase().includes(q) ||
        (c.state.identity?.deceasedName ?? '').toLowerCase().includes(q) ||
        c.notes.toLowerCase().includes(q)
    );
  }, [cases, searchTerm]);

  const filteredSimLogs = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return simulationLogs;
    return simulationLogs.filter(
      (l) =>
        l.title.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q) ||
        l.ownerName.toLowerCase().includes(q) ||
        (l.ownerEmail ?? '').toLowerCase().includes(q) ||
        (l.identity?.deceasedName ?? '').toLowerCase().includes(q) ||
        l.summaryText.toLowerCase().includes(q)
    );
  }, [simulationLogs, searchTerm]);

  const filteredIdentities = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return identities;
    return identities.filter(
      (i) =>
        i.fullName.toLowerCase().includes(q) ||
        i.role.toLowerCase().includes(q) ||
        i.deceasedName.toLowerCase().includes(q) ||
        i.city.toLowerCase().includes(q) ||
        (i.ownerEmail ?? '').toLowerCase().includes(q)
    );
  }, [identities, searchTerm]);

  const filteredCoachLogs = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return coachLogs;
    return coachLogs.filter(
      (l) =>
        l.ownerName.toLowerCase().includes(q) ||
        l.question.toLowerCase().includes(q) ||
        l.answer.toLowerCase().includes(q)
    );
  }, [coachLogs, searchTerm]);

  const activeVisibleIds = useMemo(() => {
    if (activeTab === 'cases') return filteredCases.map((c) => c.id);
    if (activeTab === 'simulationLogs') return filteredSimLogs.map((l) => l.id);
    if (activeTab === 'identities') return filteredIdentities.map((i) => i.id);
    if (activeTab === 'coachLogs') return filteredCoachLogs.map((l) => l.id);
    return [];
  }, [activeTab, filteredCases, filteredSimLogs, filteredIdentities, filteredCoachLogs]);

  const allVisibleSelected =
    activeVisibleIds.length > 0 && activeVisibleIds.every((id) => selectedIds.has(id));

  const showTempStatus = (msg: string) => {
    setActionStatus(msg);
    window.setTimeout(() => setActionStatus(null), 4500);
  };

  const toggleSelectId = (id: string) => {
    setConfirmBulkDelete(false);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setConfirmBulkDelete(false);
    if (allVisibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(activeVisibleIds));
    }
  };

  // Resolve target items for Export / Print (selected items if any, otherwise all filtered items)
  const getTargetCases = () =>
    selectedIds.size > 0
      ? filteredCases.filter((c) => selectedIds.has(c.id))
      : filteredCases;
  const getTargetSimLogs = () =>
    selectedIds.size > 0
      ? filteredSimLogs.filter((l) => selectedIds.has(l.id))
      : filteredSimLogs;
  const getTargetIdentities = () =>
    selectedIds.size > 0
      ? filteredIdentities.filter((i) => selectedIds.has(i.id))
      : filteredIdentities;
  const getTargetCoachLogs = () =>
    selectedIds.size > 0
      ? filteredCoachLogs.filter((l) => selectedIds.has(l.id))
      : filteredCoachLogs;

  const handleExportExcel = () => {
    if (activeTab === 'admins') return;
    if (activeTab === 'cases') {
      exportAdminDatasetToExcel('cases', { cases: getTargetCases() });
    } else if (activeTab === 'simulationLogs') {
      exportAdminDatasetToExcel('simulationLogs', { simulationLogs: getTargetSimLogs() });
    } else if (activeTab === 'identities') {
      exportAdminDatasetToExcel('identities', { identities: getTargetIdentities() });
    } else if (activeTab === 'coachLogs') {
      exportAdminDatasetToExcel('coachLogs', { coachLogs: getTargetCoachLogs() });
    }
    showTempStatus('File Excel (.xlsx) berhasil diunduh.');
  };

  const handleTriggerImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || activeTab === 'admins') return;
    setIsImporting(true);
    try {
      const importedCount = await onImportDataset(activeTab, file);
      showTempStatus(`Berhasil mengimpor ${importedCount} data dari "${file.name}" ke Firestore.`);
    } catch (err) {
      showTempStatus(
        err instanceof Error ? err.message : 'Gagal mengimpor file Excel/CSV.'
      );
    } finally {
      setIsImporting(false);
    }
  };

  const handlePrintSelectedPdf = () => {
    if (activeTab === 'admins') return;
    document.body.classList.add('admin-print-mode');
    const cleanup = () => {
      document.body.classList.remove('admin-print-mode');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.setTimeout(() => {
      window.print();
      window.setTimeout(cleanup, 1200);
    }, 60);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0 || activeTab === 'admins') return;
    if (!confirmBulkDelete) {
      setConfirmBulkDelete(true);
      return;
    }
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      if (activeTab === 'cases') await onDeleteCase(id);
      else if (activeTab === 'simulationLogs') await onDeleteSimulationLog(id);
      else if (activeTab === 'identities') await onDeleteIdentity(id);
      else if (activeTab === 'coachLogs') await onDeleteCoachLog(id);
    }
    setSelectedIds(new Set());
    setConfirmBulkDelete(false);
    showTempStatus(`${ids.length} data terpilih berhasil dihapus dari database.`);
  };

  const openEditForCase = (item: SavedCase) => {
    setEditField1(item.name);
    setEditField2(item.notes);
    setEditField3(item.state.identity?.deceasedName ?? '');
    setEditSystem(item.state.legalSystem);
    setEditGender(item.state.deceasedGender);
    setEditCurrency(item.state.currency);
    setEditNumber(String(item.netEstateSnapshot));
    setEditModal({ type: 'cases', item });
  };

  const openEditForSimLog = (item: FirestoreSimulationLog) => {
    setEditField1(item.title);
    setEditField2(item.action);
    setEditField3(item.summaryText);
    setEditSystem(item.legalSystem);
    setEditGender(item.deceasedGender);
    setEditCurrency(item.currency);
    setEditNumber(String(item.netEstate));
    setEditModal({ type: 'simulationLogs', item });
  };

  const openEditForIdentity = (item: FirestoreIdentityRecord) => {
    setEditField1(item.fullName);
    setEditField2(item.role);
    setEditField3(item.deceasedName);
    setEditField4(item.city);
    setEditField5(item.contact);
    setEditField6(item.notes);
    setEditModal({ type: 'identities', item });
  };

  const openEditForCoachLog = (item: FirestoreCoachLog) => {
    setEditField1(item.question);
    setEditField2(item.answer);
    setEditSystem(item.legalSystem);
    setEditModal({ type: 'coachLogs', item });
  };

  const handleEditSelectedToolbar = () => {
    if (selectedIds.size !== 1 || activeTab === 'admins') return;
    const onlyId = Array.from(selectedIds)[0];
    if (activeTab === 'cases') {
      const found = cases.find((c) => c.id === onlyId);
      if (found) openEditForCase(found);
    } else if (activeTab === 'simulationLogs') {
      const found = simulationLogs.find((l) => l.id === onlyId);
      if (found) openEditForSimLog(found);
    } else if (activeTab === 'identities') {
      const found = identities.find((i) => i.id === onlyId);
      if (found) openEditForIdentity(found);
    } else if (activeTab === 'coachLogs') {
      const found = coachLogs.find((l) => l.id === onlyId);
      if (found) openEditForCoachLog(found);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModal) return;
    setIsSavingEdit(true);
    try {
      if (editModal.type === 'cases') {
        const parsedNet = Math.max(0, Number(editNumber) || 0);
        await onUpdateCase(editModal.item.id, {
          name: editField1,
          notes: editField2,
          netEstateSnapshot: parsedNet,
          state: {
            ...editModal.item.state,
            legalSystem: editSystem,
            deceasedGender: editGender,
            currency: editCurrency,
            identity: {
              ...(editModal.item.state.identity ?? {
                fullName: '',
                role: 'Ahli Waris / Anggota Keluarga',
                deceasedName: '',
                city: '',
                contact: '',
                notes: '',
              }),
              deceasedName: editField3,
            },
          },
        });
        showTempStatus('Data kasus berhasil diperbarui.');
      } else if (editModal.type === 'simulationLogs') {
        const parsedNet = Math.max(0, Number(editNumber) || 0);
        await onUpdateSimulationLog(editModal.item.id, {
          title: editField1,
          action: editField2,
          summaryText: editField3,
          legalSystem: editSystem,
          deceasedGender: editGender,
          currency: editCurrency,
          netEstate: parsedNet,
        });
        showTempStatus('Log simulasi berhasil diperbarui.');
      } else if (editModal.type === 'identities') {
        await onUpdateIdentity(editModal.item.id, {
          fullName: editField1,
          role: editField2,
          deceasedName: editField3,
          city: editField4,
          contact: editField5,
          notes: editField6,
        });
        showTempStatus('Data identitas berhasil diperbarui.');
      } else if (editModal.type === 'coachLogs') {
        await onUpdateCoachLog(editModal.item.id, {
          question: editField1,
          answer: editField2,
          legalSystem: editSystem,
        });
        showTempStatus('Log AI Legal Coach berhasil diperbarui.');
      }
      setEditModal(null);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleAddAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminUid.trim() || !newAdminEmail.trim()) {
      setAdminMsg('UID Firebase dan Email wajib diisi.');
      return;
    }
    try {
      await onAddAdmin(newAdminUid.trim(), newAdminEmail.trim(), newAdminLabel.trim());
      setNewAdminUid('');
      setNewAdminEmail('');
      setNewAdminLabel('');
      setAdminMsg('Admin baru berhasil ditambahkan ke database.');
    } catch {
      setAdminMsg('Gagal menambahkan admin. Periksa format UID.');
    }
  };

  const islamCount = cases.filter((c) => c.state.legalSystem === 'islam').length;
  const civilCount = cases.filter((c) => c.state.legalSystem === 'civil').length;

  const targetCasesForPrint = getTargetCases();
  const targetSimLogsForPrint = getTargetSimLogs();
  const targetIdentitiesForPrint = getTargetIdentities();
  const targetCoachLogsForPrint = getTargetCoachLogs();

  const tabButtonStyle = (isActive: boolean) =>
    isActive
      ? {
          backgroundColor: theme.bright,
          color: theme.brightText,
          boxShadow: '0 2px 6px rgba(15,23,42,0.14)',
        }
      : undefined;

  const rowCardStyle = (isSelected: boolean) =>
    isSelected
      ? {
          backgroundColor: theme.tint,
          borderColor: theme.bright,
          boxShadow: `0 0 0 2px ${theme.bright}55`,
        }
      : {
          backgroundColor: '#f8fafc',
          borderColor: '#e2e8f0',
        };

  return (
    <>
      <section className="admin-screen-ui no-print mx-auto mt-6 max-w-[1250px] px-4 sm:px-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
          {/* Header */}
          <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl text-white"
                style={{ backgroundColor: theme.primary }}
              >
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold" style={{ color: theme.primary }}>
                  Dasbor Admin Database &amp; Log Simulasi (Firestore Real-Time)
                </h2>
                <p className="text-xs text-slate-500">
                  Pilih, edit, hapus, cetak PDF, ekspor &amp; impor Excel (.xlsx) untuk seluruh data pengguna.
                </p>
              </div>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-xl border border-slate-200 bg-[#f8fafc] p-3.5">
              <div className="text-xs text-slate-500">Log Simulasi</div>
              <div className="font-mono-num mt-1 text-xl font-bold" style={{ color: theme.primary }}>
                {simulationLogs.length}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500">Aktivitas pengguna</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-[#f8fafc] p-3.5">
              <div className="text-xs text-slate-500">Kasus Tersimpan</div>
              <div className="font-mono-num mt-1 text-xl font-bold text-slate-900">
                {cases.length}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500">
                {islamCount} Islam · {civilCount} Perdata
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-[#f8fafc] p-3.5">
              <div className="text-xs text-slate-500">Identitas Masuk</div>
              <div className="font-mono-num mt-1 text-xl font-bold text-sky-700">
                {identities.length}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500">Form identitas awal</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-[#f8fafc] p-3.5">
              <div className="text-xs text-slate-500">Log AI Coach</div>
              <div className="font-mono-num mt-1 text-xl font-bold text-slate-900">
                {coachLogs.length}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500">Tanya-jawab hukum</div>
            </div>
            <div className="col-span-2 rounded-xl border border-slate-200 bg-[#f8fafc] p-3.5 sm:col-span-1">
              <div className="text-xs text-slate-500">Admin Terdaftar</div>
              <div className="font-mono-num mt-1 text-xl font-bold text-emerald-700">
                {admins.length + 1}
              </div>
              <div className="mt-0.5 truncate text-[11px] text-slate-500">
                {BOOTSTRAPPED_ADMIN_EMAIL}
              </div>
            </div>
          </div>

          {/* Bright Highlight Tabs */}
          <div className="mt-5 flex flex-wrap gap-1.5 rounded-xl bg-slate-100 p-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('simulationLogs')}
              style={tabButtonStyle(activeTab === 'simulationLogs')}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-bold transition-all ${
                activeTab === 'simulationLogs' ? '' : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
              }`}
            >
              <Activity className="h-3.5 w-3.5" />
              Log Simulasi Pengguna ({simulationLogs.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('cases')}
              style={tabButtonStyle(activeTab === 'cases')}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-bold transition-all ${
                activeTab === 'cases' ? '' : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
              }`}
            >
              <Database className="h-3.5 w-3.5" />
              Semua Kasus ({cases.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('identities')}
              style={tabButtonStyle(activeTab === 'identities')}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-bold transition-all ${
                activeTab === 'identities' ? '' : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              Identitas Masuk ({identities.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('coachLogs')}
              style={tabButtonStyle(activeTab === 'coachLogs')}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-bold transition-all ${
                activeTab === 'coachLogs' ? '' : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Log AI Coach ({coachLogs.length})
            </button>

            {isBootstrappedAdmin && (
              <button
                type="button"
                onClick={() => setActiveTab('admins')}
                style={tabButtonStyle(activeTab === 'admins')}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-bold transition-all ${
                  activeTab === 'admins' ? '' : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
                }`}
              >
                <UserPlus className="h-3.5 w-3.5" />
                Kelola Admin
              </button>
            )}
          </div>

          {/* Selection, Search, CRUD, Print PDF, Excel Export/Import Toolbar */}
          {activeTab !== 'admins' && (
            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-xs font-bold transition-all"
                  style={
                    allVisibleSelected
                      ? { backgroundColor: theme.bright, borderColor: theme.bright, color: theme.brightText }
                      : { backgroundColor: '#ffffff', borderColor: '#cbd5e1', color: '#334155' }
                  }
                >
                  <Check className="h-3.5 w-3.5" />
                  {allVisibleSelected ? 'Batal Pilih Semua' : 'Pilih Semua'}
                </button>

                <span
                  className="font-mono-num rounded-lg px-2.5 py-1.5 text-xs font-bold"
                  style={
                    selectedIds.size > 0
                      ? { backgroundColor: theme.tint, color: theme.primary }
                      : { backgroundColor: '#e2e8f0', color: '#475569' }
                  }
                >
                  {selectedIds.size} dipilih
                </span>

                <div className="relative min-w-[200px] flex-1 sm:w-56">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Cari nama, pewaris, aksi..."
                    className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 text-xs text-slate-900 focus:outline-none focus:ring-2"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {selectedIds.size === 1 && (
                  <button
                    type="button"
                    onClick={handleEditSelectedToolbar}
                    className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-xs font-bold transition-opacity hover:opacity-90"
                    style={{ backgroundColor: theme.bright, color: theme.brightText }}
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Edit Terpilih
                  </button>
                )}

                {selectedIds.size > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleBulkDelete()}
                      className={`inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-xs font-bold text-white transition-colors ${
                        confirmBulkDelete ? 'bg-red-700 hover:bg-red-800' : 'bg-red-600 hover:bg-red-700'
                      }`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {confirmBulkDelete
                        ? `Konfirmasi Hapus (${selectedIds.size})`
                        : `Hapus (${selectedIds.size})`}
                    </button>
                    {confirmBulkDelete && (
                      <button
                        type="button"
                        onClick={() => setConfirmBulkDelete(false)}
                        className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                      >
                        Batal
                      </button>
                    )}
                  </>
                )}

                <button
                  type="button"
                  onClick={handlePrintSelectedPdf}
                  className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-100"
                >
                  <Printer className="h-3.5 w-3.5" style={{ color: theme.primary }} />
                  Cetak / PDF {selectedIds.size > 0 ? `(${selectedIds.size})` : '(Semua)'}
                </button>

                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: theme.primary }}
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Ekspor Excel (.xlsx)
                </button>

                <button
                  type="button"
                  onClick={handleTriggerImport}
                  disabled={isImporting}
                  className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-xs font-bold transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={{
                    backgroundColor: theme.tint,
                    borderColor: theme.border,
                    color: theme.primary,
                  }}
                >
                  <Upload className="h-3.5 w-3.5" />
                  {isImporting ? 'Mengimpor...' : 'Impor Excel (.xlsx/.csv)'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => void handleFileChange(e)}
                  className="hidden"
                />
              </div>
            </div>
          )}

          {actionStatus && (
            <div
              className="mt-3 rounded-lg border px-3.5 py-2 text-xs font-semibold"
              style={{
                backgroundColor: theme.tint,
                borderColor: theme.border,
                color: theme.primary,
              }}
            >
              {actionStatus}
            </div>
          )}

          {/* Tab Content */}
          <div className="mt-4">
            {/* TAB 1: LOG SIMULASI PENGGUNA */}
            {activeTab === 'simulationLogs' && (
              <div className="max-h-[420px] space-y-2.5 overflow-y-auto pr-1">
                {filteredSimLogs.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
                    Belum ada log simulasi pengguna yang tercatat atau sesuai pencarian.
                  </p>
                ) : (
                  filteredSimLogs.map((log) => {
                    const isSelected = selectedIds.has(log.id);
                    return (
                      <div
                        key={log.id}
                        style={rowCardStyle(isSelected)}
                        className="flex flex-col justify-between gap-3 rounded-xl border p-3.5 transition-all sm:flex-row sm:items-center"
                      >
                        <div className="flex min-w-0 items-start gap-3">
                          <button
                            type="button"
                            onClick={() => toggleSelectId(log.id)}
                            aria-label={`Pilih log ${log.title}`}
                            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-all"
                            style={
                              isSelected
                                ? { backgroundColor: theme.bright, borderColor: theme.bright, color: theme.brightText }
                                : { backgroundColor: '#ffffff', borderColor: '#cbd5e1' }
                            }
                          >
                            {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                          </button>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className="rounded px-2 py-0.5 text-[10px] font-bold uppercase"
                                style={{ backgroundColor: theme.bright, color: theme.brightText }}
                              >
                                {log.action}
                              </span>
                              <span className="text-sm font-bold text-slate-900">{log.title}</span>
                              <span className="text-[11px] text-slate-500">
                                oleh {log.ownerName} {log.ownerEmail ? `(${log.ownerEmail})` : ''}
                              </span>
                            </div>

                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-600">
                              <span>
                                {log.legalSystem === 'islam' ? 'Islam (KHI/Faraid)' : 'Perdata (BW)'}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>Pewaris: {log.deceasedGender === 'male' ? 'Laki-laki' : 'Perempuan'}</span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono-num font-bold" style={{ color: theme.primary }}>
                                Harta Bersih: {formatCurrency(log.netEstate, log.currency)}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{new Date(log.createdAtMs).toLocaleString('id-ID')}</span>
                            </div>

                            <div className="mt-1 text-xs text-slate-600">
                              {log.summaryText} ·{' '}
                              <span className="text-slate-500">
                                Keluarga: {summarizeFamily(log.family as unknown as Record<string, number>)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-1.5 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => onLoadSimulationLog(log)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <FolderOpen className="h-3.5 w-3.5" style={{ color: theme.primary }} />
                            Muat
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditForSimLog(log)}
                            aria-label={`Edit log ${log.title}`}
                            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-100"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void onDeleteSimulationLog(log.id)}
                            aria-label={`Hapus log ${log.title}`}
                            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* TAB 2: SEMUA KASUS */}
            {activeTab === 'cases' && (
              <div className="max-h-[420px] space-y-2.5 overflow-y-auto pr-1">
                {filteredCases.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
                    Belum ada kasus tersimpan di database Firestore.
                  </p>
                ) : (
                  filteredCases.map((item) => {
                    const isSelected = selectedIds.has(item.id);
                    return (
                      <div
                        key={item.id}
                        style={rowCardStyle(isSelected)}
                        className="flex flex-col justify-between gap-3 rounded-xl border p-3.5 transition-all sm:flex-row sm:items-center"
                      >
                        <div className="flex min-w-0 items-start gap-3">
                          <button
                            type="button"
                            onClick={() => toggleSelectId(item.id)}
                            aria-label={`Pilih kasus ${item.name}`}
                            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-all"
                            style={
                              isSelected
                                ? { backgroundColor: theme.bright, borderColor: theme.bright, color: theme.brightText }
                                : { backgroundColor: '#ffffff', borderColor: '#cbd5e1' }
                            }
                          >
                            {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                          </button>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-bold text-slate-900">{item.name}</span>
                              <span className="text-[11px] text-slate-500">
                                oleh {item.ownerName || 'Pengguna'}
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-600">
                              <span>
                                {item.state.legalSystem === 'islam' ? 'Islam (KHI/Faraid)' : 'Perdata (BW)'}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono-num font-bold" style={{ color: theme.primary }}>
                                {formatCurrency(item.netEstateSnapshot, item.state.currency)}
                              </span>
                              {item.state.identity?.deceasedName && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span>Pewaris: {item.state.identity.deceasedName}</span>
                                </>
                              )}
                              <span aria-hidden="true">·</span>
                              <span>{new Date(item.savedAt).toLocaleString('id-ID')}</span>
                            </div>
                            {item.notes && (
                              <div className="mt-0.5 text-xs text-slate-500">Catatan: {item.notes}</div>
                            )}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-1.5 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => onLoadCase(item)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <FolderOpen className="h-3.5 w-3.5" style={{ color: theme.primary }} />
                            Muat
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditForCase(item)}
                            aria-label={`Edit kasus ${item.name}`}
                            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-100"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void onDeleteCase(item.id)}
                            aria-label={`Hapus kasus ${item.name}`}
                            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* TAB 3: IDENTITAS MASUK */}
            {activeTab === 'identities' && (
              <div className="max-h-[420px] space-y-2.5 overflow-y-auto pr-1">
                {filteredIdentities.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
                    Belum ada data identitas masuk di Firestore.
                  </p>
                ) : (
                  filteredIdentities.map((idn) => {
                    const isSelected = selectedIds.has(idn.id);
                    return (
                      <div
                        key={idn.id}
                        style={rowCardStyle(isSelected)}
                        className="flex flex-col justify-between gap-3 rounded-xl border p-3.5 transition-all sm:flex-row sm:items-center"
                      >
                        <div className="flex min-w-0 items-start gap-3">
                          <button
                            type="button"
                            onClick={() => toggleSelectId(idn.id)}
                            aria-label={`Pilih identitas ${idn.fullName}`}
                            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-all"
                            style={
                              isSelected
                                ? { backgroundColor: theme.bright, borderColor: theme.bright, color: theme.brightText }
                                : { backgroundColor: '#ffffff', borderColor: '#cbd5e1' }
                            }
                          >
                            {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                          </button>

                          <div className="min-w-0">
                            <div className="text-sm font-bold text-slate-900">
                              {idn.fullName || '(Tanpa Nama Pengisi)'}{' '}
                              <span className="text-xs font-normal text-slate-500">— {idn.role}</span>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-600">
                              {idn.deceasedName && <span>Pewaris: {idn.deceasedName}</span>}
                              {idn.city && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span>{idn.city}</span>
                                </>
                              )}
                              {idn.contact && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span>Kontak: {idn.contact}</span>
                                </>
                              )}
                              {idn.ownerEmail && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span>Akun: {idn.ownerEmail}</span>
                                </>
                              )}
                            </div>
                            {idn.notes && (
                              <div className="mt-1 text-xs text-slate-500">Catatan: {idn.notes}</div>
                            )}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-1.5 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => openEditForIdentity(idn)}
                            aria-label="Edit data identitas"
                            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-100"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void onDeleteIdentity(idn.id)}
                            aria-label="Hapus data identitas"
                            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* TAB 4: LOG AI COACH */}
            {activeTab === 'coachLogs' && (
              <div className="max-h-[420px] space-y-2.5 overflow-y-auto pr-1">
                {filteredCoachLogs.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
                    Belum ada log konsultasi AI Legal Coach tersimpan di Firestore.
                  </p>
                ) : (
                  filteredCoachLogs.map((log) => {
                    const isSelected = selectedIds.has(log.id);
                    return (
                      <div
                        key={log.id}
                        style={rowCardStyle(isSelected)}
                        className="flex items-start justify-between gap-3 rounded-xl border p-3.5 transition-all"
                      >
                        <div className="flex min-w-0 items-start gap-3">
                          <button
                            type="button"
                            onClick={() => toggleSelectId(log.id)}
                            aria-label="Pilih log coach"
                            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-all"
                            style={
                              isSelected
                                ? { backgroundColor: theme.bright, borderColor: theme.bright, color: theme.brightText }
                                : { backgroundColor: '#ffffff', borderColor: '#cbd5e1' }
                            }
                          >
                            {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                          </button>

                          <div className="min-w-0">
                            <div className="text-xs font-bold" style={{ color: theme.primary }}>
                              {log.ownerName} ·{' '}
                              {log.legalSystem === 'islam' ? 'Islam (KHI/Faraid)' : 'Perdata (BW)'} ·{' '}
                              {new Date(log.createdAtMs).toLocaleString('id-ID')}
                            </div>
                            <div className="mt-1 text-xs font-semibold text-slate-900">
                              Tanya: {log.question}
                            </div>
                            <div className="mt-1 line-clamp-2 text-xs text-slate-600">
                              Jawab: {log.answer}
                            </div>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditForCoachLog(log)}
                            aria-label="Edit log coach"
                            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-100"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void onDeleteCoachLog(log.id)}
                            aria-label="Hapus log coach"
                            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* TAB 5: KELOLA ADMIN */}
            {activeTab === 'admins' && isBootstrappedAdmin && (
              <div className="space-y-4">
                <form onSubmit={handleAddAdminSubmit} className="grid grid-cols-1 gap-2.5 sm:grid-cols-4">
                  <input
                    type="text"
                    value={newAdminUid}
                    onChange={(e) => setNewAdminUid(e.target.value)}
                    placeholder="Firebase UID Admin Baru"
                    className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:outline-none focus:ring-2"
                  />
                  <input
                    type="email"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    placeholder="Email Google Admin"
                    className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:outline-none focus:ring-2"
                  />
                  <input
                    type="text"
                    value={newAdminLabel}
                    onChange={(e) => setNewAdminLabel(e.target.value)}
                    placeholder="Label (misal: Notaris)"
                    className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:outline-none focus:ring-2"
                  />
                  <button
                    type="submit"
                    className="h-10 rounded-lg px-4 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: theme.primary }}
                  >
                    Tambah Admin
                  </button>
                </form>
                {adminMsg && (
                  <p className="text-xs font-medium" style={{ color: theme.primary }}>
                    {adminMsg}
                  </p>
                )}

                <div className="space-y-2">
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5 text-xs text-emerald-900">
                    <strong>Admin Utama (Bootstrapped):</strong> {BOOTSTRAPPED_ADMIN_EMAIL}
                  </div>
                  {admins.map((adm) => (
                    <div
                      key={adm.uid}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-[#f8fafc] px-3.5 py-2.5 text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-900">{adm.email}</span>
                        {adm.label && <span className="ml-2 text-slate-500">({adm.label})</span>}
                        <div className="font-mono-num text-[11px] text-slate-500">UID: {adm.uid}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void onRemoveAdmin(adm.uid)}
                        className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Edit Modal */}
        {editModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-xs">
            <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl">
              <div
                className="flex items-center justify-between rounded-t-2xl px-5 py-4 text-white"
                style={{ backgroundColor: theme.primary }}
              >
                <h3 className="text-sm font-bold">
                  {editModal.type === 'cases' && 'Edit Data Kasus'}
                  {editModal.type === 'simulationLogs' && 'Edit Log Simulasi'}
                  {editModal.type === 'identities' && 'Edit Identitas Pengguna'}
                  {editModal.type === 'coachLogs' && 'Edit Log AI Legal Coach'}
                </h3>
                <button
                  type="button"
                  onClick={() => setEditModal(null)}
                  className="rounded-lg p-1 text-white/80 hover:bg-white/15 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-3 p-5 text-xs">
                {(editModal.type === 'cases' || editModal.type === 'simulationLogs') && (
                  <>
                    <div>
                      <label className="mb-1 block font-semibold text-slate-700">
                        {editModal.type === 'cases' ? 'Nama Kasus' : 'Judul Simulasi'}
                      </label>
                      <input
                        type="text"
                        required
                        value={editField1}
                        onChange={(e) => setEditField1(e.target.value)}
                        className="h-9 w-full rounded-lg border border-slate-300 px-3 text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold text-slate-700">
                        {editModal.type === 'cases' ? 'Catatan' : 'Jenis Aksi'}
                      </label>
                      <input
                        type="text"
                        value={editField2}
                        onChange={(e) => setEditField2(e.target.value)}
                        className="h-9 w-full rounded-lg border border-slate-300 px-3 text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold text-slate-700">
                        {editModal.type === 'cases' ? 'Nama Pewaris' : 'Ringkasan Simulasi'}
                      </label>
                      <input
                        type="text"
                        value={editField3}
                        onChange={(e) => setEditField3(e.target.value)}
                        className="h-9 w-full rounded-lg border border-slate-300 px-3 text-slate-900"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block font-semibold text-slate-700">Sistem Hukum</label>
                        <select
                          value={editSystem}
                          onChange={(e) => setEditSystem(e.target.value as LegalSystem)}
                          className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-slate-900"
                        >
                          <option value="islam">Islam (KHI &amp; Faraid)</option>
                          <option value="civil">Perdata (KUHPerdata / BW)</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block font-semibold text-slate-700">Gender Pewaris</label>
                        <select
                          value={editGender}
                          onChange={(e) => setEditGender(e.target.value as DeceasedGender)}
                          className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-slate-900"
                        >
                          <option value="male">Laki-laki</option>
                          <option value="female">Perempuan</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block font-semibold text-slate-700">Mata Uang</label>
                        <select
                          value={editCurrency}
                          onChange={(e) => setEditCurrency(e.target.value as CurrencyCode)}
                          className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-slate-900"
                        >
                          <option value="IDR">Rp (IDR)</option>
                          <option value="USD">$ (USD)</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block font-semibold text-slate-700">Harta Bersih</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={editNumber}
                          onChange={(e) => setEditNumber(e.target.value)}
                          className="font-mono-num h-9 w-full rounded-lg border border-slate-300 px-3 text-slate-900"
                        />
                      </div>
                    </div>
                  </>
                )}

                {editModal.type === 'identities' && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block font-semibold text-slate-700">Nama Pengisi</label>
                        <input
                          type="text"
                          value={editField1}
                          onChange={(e) => setEditField1(e.target.value)}
                          className="h-9 w-full rounded-lg border border-slate-300 px-3 text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block font-semibold text-slate-700">Peran</label>
                        <input
                          type="text"
                          value={editField2}
                          onChange={(e) => setEditField2(e.target.value)}
                          className="h-9 w-full rounded-lg border border-slate-300 px-3 text-slate-900"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block font-semibold text-slate-700">Nama Pewaris</label>
                        <input
                          type="text"
                          value={editField3}
                          onChange={(e) => setEditField3(e.target.value)}
                          className="h-9 w-full rounded-lg border border-slate-300 px-3 text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block font-semibold text-slate-700">Kota / Domisili</label>
                        <input
                          type="text"
                          value={editField4}
                          onChange={(e) => setEditField4(e.target.value)}
                          className="h-9 w-full rounded-lg border border-slate-300 px-3 text-slate-900"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold text-slate-700">Kontak</label>
                      <input
                        type="text"
                        value={editField5}
                        onChange={(e) => setEditField5(e.target.value)}
                        className="h-9 w-full rounded-lg border border-slate-300 px-3 text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold text-slate-700">Catatan</label>
                      <textarea
                        rows={2}
                        value={editField6}
                        onChange={(e) => setEditField6(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 p-2.5 text-slate-900"
                      />
                    </div>
                  </>
                )}

                {editModal.type === 'coachLogs' && (
                  <>
                    <div>
                      <label className="mb-1 block font-semibold text-slate-700">Sistem Hukum</label>
                      <select
                        value={editSystem}
                        onChange={(e) => setEditSystem(e.target.value as LegalSystem)}
                        className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-slate-900"
                      >
                        <option value="islam">Islam (KHI &amp; Faraid)</option>
                        <option value="civil">Perdata (KUHPerdata / BW)</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold text-slate-700">Pertanyaan</label>
                      <input
                        type="text"
                        required
                        value={editField1}
                        onChange={(e) => setEditField1(e.target.value)}
                        className="h-9 w-full rounded-lg border border-slate-300 px-3 text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold text-slate-700">Jawaban</label>
                      <textarea
                        rows={4}
                        required
                        value={editField2}
                        onChange={(e) => setEditField2(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 p-2.5 text-slate-900"
                      />
                    </div>
                  </>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditModal(null)}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingEdit}
                    className="rounded-lg px-4 py-2 font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                    style={{ backgroundColor: theme.primary }}
                  >
                    {isSavingEdit ? 'Menyimpan...' : 'Simpan Perubahan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </section>

      {/* Isolated Admin Printable Sheet for Selected / Active Dataset PDF */}
      <div className="admin-print-sheet bg-white p-6 text-slate-900">
        <div className="border-b-2 border-slate-800 pb-3">
          <h1 className="text-lg font-bold">
            LAPORAN ADMINISTRATOR — SIMULATOR &amp; KALKULATOR HUKUM WARIS
          </h1>
          <p className="mt-1 text-xs text-slate-600">
            Kategori:{' '}
            <strong>
              {activeTab === 'simulationLogs' && 'Log Simulasi Pengguna'}
              {activeTab === 'cases' && 'Data Kasus Waris'}
              {activeTab === 'identities' && 'Data Identitas Pengguna'}
              {activeTab === 'coachLogs' && 'Log Konsultasi AI Legal Coach'}
            </strong>{' '}
            · Dicetak: {new Date().toLocaleString('id-ID')}
          </p>
        </div>

        {activeTab === 'simulationLogs' && (
          <div className="mt-4 space-y-3">
            {targetSimLogsForPrint.map((log, i) => (
              <div key={log.id} className="rounded-lg border border-slate-300 p-3 text-xs">
                <div className="flex items-center justify-between font-bold">
                  <span>
                    {i + 1}. [{log.action}] {log.title}
                  </span>
                  <span>{new Date(log.createdAtMs).toLocaleString('id-ID')}</span>
                </div>
                <div className="mt-1 text-slate-700">
                  <strong>Pengguna:</strong> {log.ownerName} ({log.ownerEmail || '-'}) ·{' '}
                  <strong>Sistem:</strong>{' '}
                  {log.legalSystem === 'islam' ? 'Islam (KHI/Faraid)' : 'Perdata (BW)'} ·{' '}
                  <strong>Pewaris:</strong> {log.deceasedGender === 'male' ? 'Laki-laki' : 'Perempuan'}{' '}
                  ({log.identity?.deceasedName || 'Anonim'})
                </div>
                <div className="mt-1 text-slate-700">
                  <strong>Harta Kotor:</strong>{' '}
                  {formatCurrency(log.financials?.grossAssets ?? 0, log.currency)} ·{' '}
                  <strong>Utang:</strong> {formatCurrency(log.financials?.debts ?? 0, log.currency)} ·{' '}
                  <strong>Pemakaman:</strong>{' '}
                  {formatCurrency(log.financials?.funeralCosts ?? 0, log.currency)} ·{' '}
                  <strong>Wasiat:</strong> {formatCurrency(log.financials?.willAmount ?? 0, log.currency)}{' '}
                  · <strong>Harta Bersih:</strong> {formatCurrency(log.netEstate, log.currency)} (Kurs{' '}
                  {formatRateIdr(log.exchangeRate)}/USD)
                </div>
                <div className="mt-1 text-slate-700">
                  <strong>Komposisi Keluarga:</strong>{' '}
                  {summarizeFamily(log.family as unknown as Record<string, number>)}
                </div>
                <div className="mt-1 text-slate-600">
                  <strong>Ringkasan:</strong> {log.summaryText}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'cases' && (
          <table className="mt-4 w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b-2 border-slate-400 bg-slate-100">
                <th className="p-2">No</th>
                <th className="p-2">Nama Kasus</th>
                <th className="p-2">Pemilik</th>
                <th className="p-2">Sistem</th>
                <th className="p-2">Pewaris</th>
                <th className="p-2 text-right">Harta Bersih</th>
                <th className="p-2">Waktu</th>
              </tr>
            </thead>
            <tbody>
              {targetCasesForPrint.map((c, i) => (
                <tr key={c.id} className="border-b border-slate-200">
                  <td className="p-2">{i + 1}</td>
                  <td className="p-2 font-semibold">{c.name}</td>
                  <td className="p-2">{c.ownerName || '-'}</td>
                  <td className="p-2">
                    {c.state.legalSystem === 'islam' ? 'Islam (KHI/Faraid)' : 'Perdata (BW)'}
                  </td>
                  <td className="p-2">{c.state.identity?.deceasedName || '-'}</td>
                  <td className="p-2 text-right font-semibold">
                    {formatCurrency(c.netEstateSnapshot, c.state.currency)}
                  </td>
                  <td className="p-2">{new Date(c.savedAt).toLocaleString('id-ID')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === 'identities' && (
          <table className="mt-4 w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b-2 border-slate-400 bg-slate-100">
                <th className="p-2">No</th>
                <th className="p-2">Nama Pengisi</th>
                <th className="p-2">Peran</th>
                <th className="p-2">Nama Pewaris</th>
                <th className="p-2">Kota</th>
                <th className="p-2">Kontak</th>
                <th className="p-2">Waktu</th>
              </tr>
            </thead>
            <tbody>
              {targetIdentitiesForPrint.map((idn, i) => (
                <tr key={idn.id} className="border-b border-slate-200">
                  <td className="p-2">{i + 1}</td>
                  <td className="p-2 font-semibold">{idn.fullName}</td>
                  <td className="p-2">{idn.role}</td>
                  <td className="p-2">{idn.deceasedName || '-'}</td>
                  <td className="p-2">{idn.city || '-'}</td>
                  <td className="p-2">{idn.contact || '-'}</td>
                  <td className="p-2">{new Date(idn.createdAtMs).toLocaleString('id-ID')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === 'coachLogs' && (
          <div className="mt-4 space-y-3">
            {targetCoachLogsForPrint.map((log, i) => (
              <div key={log.id} className="rounded-lg border border-slate-300 p-3 text-xs">
                <div className="font-bold">
                  {i + 1}. {log.ownerName} ·{' '}
                  {log.legalSystem === 'islam' ? 'Islam (KHI/Faraid)' : 'Perdata (BW)'} ·{' '}
                  {new Date(log.createdAtMs).toLocaleString('id-ID')}
                </div>
                <div className="mt-1 font-semibold">Tanya: {log.question}</div>
                <div className="mt-1 whitespace-pre-line text-slate-700">Jawab: {log.answer}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};
