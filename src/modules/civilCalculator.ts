/**
 * Civil Law Inheritance Calculator Module (Hukum Waris Perdata Barat — KUHPerdata / BW).
 * Implements Golongan I, II, and III hierarchy with equal 1:1 distribution
 * among eligible heirs in the active class, while displaying all blocked and non-heir relatives.
 */

import {
  CalculationResult,
  DeceasedGender,
  FamilyCounts,
  FinancialInputs,
  HEIR_METADATA,
  HeirKey,
  HeirResultRow,
} from '../types/inheritance';

const NON_HEIR_KEYS: HeirKey[] = ['anakTiri', 'mertua', 'menantu'];

function formatPercent(ratio: number): string {
  if (ratio <= 0) return '0%';
  const pct = ratio * 100;
  return `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(2)}%`;
}

export function calculateCivilInheritance(
  financials: FinancialInputs,
  rawFamily: FamilyCounts,
  deceasedGender: DeceasedGender
): CalculationResult {
  const estateBeforeWill = Math.max(0, financials.grossAssets - financials.debts - financials.funeralCosts);
  const maxAllowedWill = estateBeforeWill / 3;
  const isWillExcessive = financials.willAmount > maxAllowedWill + 0.001 && estateBeforeWill > 0;
  const netEstate = Math.max(0, estateBeforeWill - financials.willAmount);

  const family: FamilyCounts = {
    ...rawFamily,
    suami: deceasedGender === 'female' ? Math.min(1, Math.max(0, rawFamily.suami)) : 0,
    istri: deceasedGender === 'male' ? Math.min(4, Math.max(0, rawFamily.istri)) : 0,
  };

  const activeKeys = (Object.keys(family) as HeirKey[]).filter((k) => family[k] > 0);

  // Determine which Golongan is active
  const hasSpouse = family.suami > 0 || family.istri > 0;
  const hasAnak = family.anakL > 0 || family.anakP > 0;
  const hasCucu = family.cucuL > 0 || family.cucuP > 0;
  const hasCicit = family.cicitL > 0 || family.cicitP > 0;
  const hasGol1 = hasSpouse || hasAnak || hasCucu || hasCicit;

  const hasGol2 = family.ayah > 0 || family.ibu > 0 || family.saudaraL > 0 || family.saudaraP > 0;
  const hasKakekNenek = family.kakek > 0 || family.nenek > 0;
  const hasBuyut = family.buyutL > 0 || family.buyutP > 0;
  const hasGol3 = hasKakekNenek || hasBuyut;

  const winningGolongan = hasGol1 ? 1 : hasGol2 ? 2 : hasGol3 ? 3 : 0;

  // Determine eligible keys in the winning Golongan
  const eligibleKeys = new Set<HeirKey>();
  const blockReasons: Partial<Record<HeirKey, string>> = {};

  for (const key of activeKeys) {
    if (NON_HEIR_KEYS.includes(key)) continue;

    if (winningGolongan === 1) {
      if (key === 'suami' || key === 'istri') {
        eligibleKeys.add(key);
      } else if (key === 'anakL' || key === 'anakP') {
        eligibleKeys.add(key);
      } else if (key === 'cucuL' || key === 'cucuP') {
        if (hasAnak) {
          blockReasons[key] = 'Terhalang oleh Anak Kandung (Gol I)';
        } else {
          eligibleKeys.add(key);
        }
      } else if (key === 'cicitL' || key === 'cicitP') {
        if (hasAnak) {
          blockReasons[key] = 'Terhalang oleh Anak Kandung (Gol I)';
        } else if (hasCucu) {
          blockReasons[key] = 'Terhalang oleh Cucu (Gol I)';
        } else {
          eligibleKeys.add(key);
        }
      } else {
        blockReasons[key] = 'Terhalang (Ada Gol I)';
      }
    } else if (winningGolongan === 2) {
      if (key === 'ayah' || key === 'ibu' || key === 'saudaraL' || key === 'saudaraP') {
        eligibleKeys.add(key);
      } else {
        blockReasons[key] = 'Terhalang (Ada Gol II)';
      }
    } else if (winningGolongan === 3) {
      if (key === 'kakek' || key === 'nenek') {
        eligibleKeys.add(key);
      } else if (key === 'buyutL' || key === 'buyutP') {
        if (hasKakekNenek) {
          blockReasons[key] = 'Terhalang oleh Kakek/Nenek (Gol III)';
        } else {
          eligibleKeys.add(key);
        }
      }
    }
  }

  // Equal 1:1 split across all eligible individuals in the winning Golongan
  const totalEligibleHeads = Array.from(eligibleKeys).reduce((sum, key) => sum + family[key], 0);

  const rows: HeirResultRow[] = activeKeys.map((key) => {
    const meta = HEIR_METADATA[key];
    const count = family[key];

    if (NON_HEIR_KEYS.includes(key)) {
      return {
        key,
        label: meta.label,
        category: meta.group,
        count,
        statusLabel: 'Bukan Ahli Waris',
        statusTone: 'non_heir',
        reason: 'Tidak memiliki hubungan darah/perkawinan sebagai ahli waris ab intestato (BW)',
        fractionLabel: '—',
        totalShareRatio: 0,
        totalAmount: 0,
        perPersonAmount: 0,
      };
    }

    if (eligibleKeys.has(key) && totalEligibleHeads > 0) {
      const ratio = count / totalEligibleHeads;
      const totalAmount = netEstate * ratio;
      const perPersonAmount = totalAmount / count;
      const golLabel = winningGolongan === 1 ? 'Golongan I' : winningGolongan === 2 ? 'Golongan II' : 'Golongan III';

      return {
        key,
        label: meta.label,
        category: meta.group,
        count,
        statusLabel: golLabel,
        statusTone: 'eligible',
        reason: `Pembagian merata rasio 1:1 antar ${totalEligibleHeads} ahli waris ${golLabel} (KUHPerdata)`,
        fractionLabel: `${count}/${totalEligibleHeads} (${formatPercent(ratio)})`,
        totalShareRatio: ratio,
        totalAmount,
        perPersonAmount,
      };
    }

    return {
      key,
      label: meta.label,
      category: meta.group,
      count,
      statusLabel: 'Terhalang (Mahjub)',
      statusTone: 'blocked',
      reason: blockReasons[key] ?? 'Terhalang oleh golongan lebih tinggi',
      fractionLabel: '0',
      totalShareRatio: 0,
      totalAmount: 0,
      perPersonAmount: 0,
    };
  });

  const totalDistributedRatio = rows.reduce((s, r) => s + r.totalShareRatio, 0);
  const totalDistributedAmount = rows.reduce((s, r) => s + r.totalAmount, 0);

  let adjustmentNote: string | null = null;
  let adjustmentType: CalculationResult['adjustmentType'] = 'normal';

  if (totalEligibleHeads === 0) {
    adjustmentType = 'empty';
    adjustmentNote = 'Belum ada ahli waris KUHPerdata (Golongan I–III) yang aktif.';
  } else {
    const golText =
      winningGolongan === 1
        ? 'Golongan I (Pasangan & Keturunan)'
        : winningGolongan === 2
        ? 'Golongan II (Orang Tua & Saudara Kandung)'
        : 'Golongan III (Leluhur / Kakek-Nenek-Buyut)';
    adjustmentNote = `Aktif: ${golText} — seluruh ${totalEligibleHeads} ahli waris yang berhak memperoleh porsi merata (rasio 1:1) tanpa membedakan jenis kelamin.`;
  }

  return {
    system: 'civil',
    netEstate,
    estateBeforeWill,
    maxAllowedWill,
    isWillExcessive,
    rows,
    adjustmentNote,
    adjustmentType,
    totalDistributedRatio,
    totalDistributedAmount,
  };
}
