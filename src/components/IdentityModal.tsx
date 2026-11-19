import React, { useEffect, useState } from 'react';
import { UserCheck, X } from 'lucide-react';
import { UserIdentity } from '../types/inheritance';

interface IdentityModalProps {
  isOpen: boolean;
  initialIdentity: UserIdentity;
  onSave: (identity: UserIdentity) => void;
  onClose: () => void;
}

const ROLE_OPTIONS = [
  'Ahli Waris / Anggota Keluarga',
  'Pasangan Pewaris (Suami / Istri)',
  'Kuasa Hukum / Notaris / PPAT',
  'Mediator / Konsultan Syariah',
  'Akademisi / Mahasiswa Hukum',
  'Lainnya',
];

export const IdentityModal: React.FC<IdentityModalProps> = ({
  isOpen,
  initialIdentity,
  onSave,
  onClose,
}) => {
  const [form, setForm] = useState<UserIdentity>(initialIdentity);

  useEffect(() => {
    if (isOpen) {
      setForm(initialIdentity);
    }
  }, [isOpen, initialIdentity]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      fullName: form.fullName.trim(),
      role: form.role,
      deceasedName: form.deceasedName.trim(),
      city: form.city.trim(),
      contact: form.contact.trim(),
      notes: form.notes.trim(),
    });
  };

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="identity-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 bg-gradient-to-r from-[#1e3a8a] to-[#0284c7] px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
              <UserCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 id="identity-modal-title" className="text-base font-bold sm:text-lg">
                Informasi &amp; Identitas Simulasi
              </h2>
              <p className="mt-0.5 text-xs text-sky-100">
                Opsional — data ini digunakan untuk kelengkapan laporan cetak PDF &amp; Excel, atau tutup dengan tombol silang (×).
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pop-up identitas"
            title="Tutup (Silang)"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white transition-colors hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-white"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="space-y-3.5 p-6">
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="id-fullName"
                className="mb-1 block text-xs font-semibold text-slate-700"
              >
                Nama Lengkap Pengisi
              </label>
              <input
                id="id-fullName"
                type="text"
                value={form.fullName}
                onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                placeholder="Contoh: Ahmad Fauzi"
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0284c7] focus:outline-none focus:ring-2 focus:ring-[#0284c7]/20"
              />
            </div>

            <div>
              <label
                htmlFor="id-role"
                className="mb-1 block text-xs font-semibold text-slate-700"
              >
                Peran / Kapasitas
              </label>
              <select
                id="id-role"
                value={form.role}
                onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-[#0284c7] focus:outline-none focus:ring-2 focus:ring-[#0284c7]/20"
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="id-deceasedName"
                className="mb-1 block text-xs font-semibold text-slate-700"
              >
                Nama Pewaris (Alm./Almh.)
              </label>
              <input
                id="id-deceasedName"
                type="text"
                value={form.deceasedName}
                onChange={(e) => setForm((p) => ({ ...p, deceasedName: e.target.value }))}
                placeholder="Contoh: Alm. H. Sulaiman"
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0284c7] focus:outline-none focus:ring-2 focus:ring-[#0284c7]/20"
              />
            </div>

            <div>
              <label
                htmlFor="id-city"
                className="mb-1 block text-xs font-semibold text-slate-700"
              >
                Kota / Domisili
              </label>
              <input
                id="id-city"
                type="text"
                value={form.city}
                onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                placeholder="Contoh: Jakarta Selatan"
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0284c7] focus:outline-none focus:ring-2 focus:ring-[#0284c7]/20"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="id-contact"
              className="mb-1 block text-xs font-semibold text-slate-700"
            >
              Email atau Nomor Kontak (Opsional)
            </label>
            <input
              id="id-contact"
              type="text"
              value={form.contact}
              onChange={(e) => setForm((p) => ({ ...p, contact: e.target.value }))}
              placeholder="Contoh: email@domain.com / 0812xxxx"
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0284c7] focus:outline-none focus:ring-2 focus:ring-[#0284c7]/20"
            />
          </div>

          <div>
            <label
              htmlFor="id-notes"
              className="mb-1 block text-xs font-semibold text-slate-700"
            >
              Catatan / Konteks Kasus (Opsional)
            </label>
            <textarea
              id="id-notes"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Misal: Simulasi pembagian aset rumah & tabungan keluarga"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0284c7] focus:outline-none focus:ring-2 focus:ring-[#0284c7]/20"
            />
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              Lewati &amp; Langsung Simulasi
            </button>
            <button
              type="submit"
              className="h-10 rounded-lg bg-[#1e3a8a] px-5 text-xs font-semibold text-white transition-colors hover:bg-[#172e6e] focus-visible:outline-2 focus-visible:outline-[#0284c7]"
            >
              Simpan Identitas &amp; Mulai
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
