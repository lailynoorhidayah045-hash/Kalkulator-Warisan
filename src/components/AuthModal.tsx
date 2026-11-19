import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  ExternalLink,
  LogIn,
  ShieldCheck,
  X,
} from 'lucide-react';
import firebaseConfig from '../../firebase-applet-config.json';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoogleLogin: () => Promise<void>;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onGoogleLogin,
}) => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [unauthorizedHost, setUnauthorizedHost] = useState<string | null>(null);
  const [copiedHost, setCopiedHost] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setUnauthorizedHost(null);
    setCopiedHost(false);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleLogin = async () => {
    setLoading(true);
    setErrorMsg(null);
    setUnauthorizedHost(null);
    try {
      await onGoogleLogin();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal masuk dengan Google.';
      if (msg.includes('popup-closed-by-user')) {
        setErrorMsg('Jendela login Google ditutup sebelum selesai.');
      } else if (msg.includes('auth/popup-blocked')) {
        setErrorMsg(
          'Pop-up login diblokir oleh browser. Izinkan pop-up untuk situs ini lalu coba lagi.'
        );
      } else if (msg.includes('auth/unauthorized-domain')) {
        const currentHost =
          typeof window !== 'undefined' ? window.location.hostname : '';
        setUnauthorizedHost(currentHost);
        setErrorMsg(
          `Domain "${currentHost}" belum terdaftar di Authorized Domains Firebase Auth.`
        );
      } else {
        setErrorMsg(`Login gagal: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopyHost = async () => {
    if (!unauthorizedHost) return;
    try {
      await navigator.clipboard.writeText(unauthorizedHost);
      setCopiedHost(true);
      window.setTimeout(() => setCopiedHost(false), 2500);
    } catch {
      // ignore clipboard errors
    }
  };

  const firebaseAuthSettingsUrl = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`;

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 bg-gradient-to-r from-[#1e3a8a] to-[#0284c7] px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 id="auth-modal-title" className="text-base font-bold sm:text-lg">
                Login Akun &amp; Akses Admin
              </h2>
              <p className="mt-0.5 text-xs text-sky-100">
                Masuk dengan Google untuk sinkronisasi database Firestore.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pop-up login"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white transition-colors hover:bg-white/25"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div className="space-y-2 rounded-xl border border-slate-200 bg-[#f8fafc] p-4 text-xs leading-relaxed text-slate-700">
            <p>
              <strong>Pengguna Umum:</strong> Seluruh data Identitas, Kasus Simulasi Waris, dan riwayat konsultasi AI Legal Coach Anda otomatis tersimpan aman di database Firestore.
            </p>
          </div>

          {errorMsg && (
            <div className="space-y-2.5 rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs text-red-900">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                <span className="font-medium">{errorMsg}</span>
              </div>

              {unauthorizedHost && (
                <div className="space-y-2 border-t border-red-200/80 pt-2.5 text-[11px] leading-relaxed text-red-800">
                  <p>
                    Karena Anda menjalankan aplikasi di domain eksternal, tambahkan domain berikut ke{' '}
                    <strong>Authentication → Settings → Authorized domains</strong> pada Firebase Console:
                  </p>
                  <div className="flex items-center justify-between gap-2 rounded-md border border-red-200 bg-white px-2.5 py-1.5">
                    <code className="font-mono-num truncate font-semibold text-slate-900">
                      {unauthorizedHost}
                    </code>
                    <button
                      type="button"
                      onClick={() => void handleCopyHost()}
                      className="inline-flex shrink-0 items-center gap-1 rounded bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200"
                    >
                      {copiedHost ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-600" />
                          Tersalin
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          Salin
                        </>
                      )}
                    </button>
                  </div>
                  <a
                    href={firebaseAuthSettingsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-[#1e3a8a] underline hover:text-[#0284c7]"
                  >
                    Buka Authorized Domains di Firebase Console
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => void handleLogin()}
            disabled={loading}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1e3a8a] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#172e6e] disabled:opacity-60"
          >
            <LogIn className="h-4 w-4" />
            {loading ? 'Menghubungkan ke Google...' : 'Masuk dengan Google'}
          </button>
        </div>
      </div>
    </div>
  );
};
