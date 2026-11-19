import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'Terjadi kesalahan tidak terduga pada aplikasi.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      let friendlyMessage = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message) as {
          error?: string;
          operationType?: string;
          path?: string;
        };
        if (parsed.error && parsed.operationType) {
          friendlyMessage = `Akses database (${parsed.operationType}${
            parsed.path ? ` pada ${parsed.path}` : ''
          }) ditolak atau gagal: ${parsed.error}`;
        }
      } catch {
        // Not JSON, keep message as-is
      }

      return (
        <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] p-6">
          <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 text-amber-700">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h1 className="text-base font-bold text-slate-900">
                Terjadi Gangguan Koneksi / Izin Database
              </h1>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-600">
              {friendlyMessage}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#1e3a8a] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#172e6e]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Muat Ulang Aplikasi
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
