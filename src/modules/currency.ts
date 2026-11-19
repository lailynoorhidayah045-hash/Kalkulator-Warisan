/**
 * Currency formatting and dynamic exchange-rate conversion module.
 * - IDR uses dot thousand separators (e.g., Rp 1.500.000.000)
 * - USD uses comma thousand separators and 2 decimals (e.g., $94,936.71)
 */

import { CurrencyCode, FinancialInputs } from '../types/inheritance';

export function formatCurrency(amount: number, currency: CurrencyCode): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  if (currency === 'IDR') {
    const rounded = Math.round(safe);
    return `Rp ${rounded.toLocaleString('id-ID')}`;
  }
  return `$${safe.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatInputNumber(amount: number, currency: CurrencyCode): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  if (currency === 'IDR') {
    return Math.round(safe).toLocaleString('id-ID');
  }
  return safe.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/**
 * Parses user-typed financial strings cleanly according to the active currency.
 */
export function parseFinancialInput(raw: string, currency: CurrencyCode): number {
  const trimmed = raw.trim();
  if (!trimmed) return 0;

  if (currency === 'IDR') {
    // Strip dots/spaces/non-digits for Indonesian integer formatting
    const digitsOnly = trimmed.replace(/[^\d]/g, '');
    const parsed = Number(digitsOnly);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }

  // USD: allow commas as thousand separators and dot as decimal
  const normalized = trimmed.replace(/,/g, '').replace(/[^\d.]/g, '');
  const parts = normalized.split('.');
  const clean = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : normalized;
  const parsed = parseFloat(clean);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : 0;
}

/**
 * Converts financial inputs when toggling between IDR and USD at a given exchange rate.
 */
export function convertFinancialsBetweenCurrencies(
  financials: FinancialInputs,
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode,
  exchangeRate: number
): FinancialInputs {
  if (fromCurrency === toCurrency || exchangeRate <= 0) {
    return financials;
  }

  const convertVal = (val: number): number => {
    if (fromCurrency === 'IDR' && toCurrency === 'USD') {
      return Math.round((val / exchangeRate) * 100) / 100;
    }
    return Math.round(val * exchangeRate);
  };

  return {
    grossAssets: convertVal(financials.grossAssets),
    debts: convertVal(financials.debts),
    funeralCosts: convertVal(financials.funeralCosts),
    willAmount: convertVal(financials.willAmount),
  };
}

/**
 * Revalues financial inputs when the user explicitly applies a new exchange rate.
 * - In USD mode: IDR-denominated wealth is revalued in USD (ratio = oldRate / newRate).
 * - In IDR mode: USD-referenced wealth is revalued in IDR (ratio = newRate / oldRate).
 */
export function revalueFinancialsForRateChange(
  financials: FinancialInputs,
  currency: CurrencyCode,
  oldRate: number,
  newRate: number
): FinancialInputs {
  if (oldRate <= 0 || newRate <= 0 || oldRate === newRate) {
    return financials;
  }

  const factor = currency === 'USD' ? oldRate / newRate : newRate / oldRate;
  const adjust = (val: number): number => {
    const next = val * factor;
    return currency === 'IDR' ? Math.round(next) : Math.round(next * 100) / 100;
  };

  return {
    grossAssets: adjust(financials.grossAssets),
    debts: adjust(financials.debts),
    funeralCosts: adjust(financials.funeralCosts),
    willAmount: adjust(financials.willAmount),
  };
}

export function formatRateIdr(rate: number): string {
  const safe = Number.isFinite(rate) && rate > 0 ? Math.round(rate) : 0;
  return `Rp ${safe.toLocaleString('id-ID')}`;
}
