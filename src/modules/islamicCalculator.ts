/**
 * Islamic Inheritance Calculator Module (Hukum Waris Islam — KHI & Faraid).
 * Supports:
 * - Ashabul Furud (fixed shares)
 * - 'Ashabah bin Nafs, 'Ashabah bil Ghair (2:1), 'Ashabah Ma'al Ghair (sisters with daughters)
 * - Hijab Hirman (full blocking with explicit blocker explanations)
 * - 'Aul (proportional reduction when fixed shares exceed 1)
 * - Radd (proportional return when residue remains without 'Ashabah)
 * - Multi-wife equal sharing (1–4 wives)
 * - Non-heir classification (Anak Tiri, Mertua, Menantu)
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

interface InternalAllocation {
  key: HeirKey;
  count: number;
  fixedRatio: number;
  fixedLabel: string;
  isAshabah: boolean;
  ashabahType?: 'Ashabah' | 'Ashabah bil Ghair' | "Ashabah Ma'al Ghair";
  ashabahWeight?: number; // per person weight (2 for male, 1 for female)
  ashabahPriority?: number; // lower = higher priority
  blockedBy?: string;
  isNonHeir?: boolean;
  note: string;
}

const NON_HEIR_KEYS: HeirKey[] = ['anakTiri', 'mertua', 'menantu'];

function formatPercent(ratio: number): string {
  if (ratio <= 0) return '0%';
  const pct = ratio * 100;
  return `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(2)}%`;
}

export function calculateIslamicInheritance(
  financials: FinancialInputs,
  rawFamily: FamilyCounts,
  deceasedGender: DeceasedGender
): CalculationResult {
  const estateBeforeWill = Math.max(0, financials.grossAssets - financials.debts - financials.funeralCosts);
  const maxAllowedWill = estateBeforeWill / 3;
  const isWillExcessive = financials.willAmount > maxAllowedWill + 0.001 && estateBeforeWill > 0;
  const netEstate = Math.max(0, estateBeforeWill - financials.willAmount);

  // Enforce gender-appropriate spouse count
  const family: FamilyCounts = {
    ...rawFamily,
    suami: deceasedGender === 'female' ? Math.min(1, Math.max(0, rawFamily.suami)) : 0,
    istri: deceasedGender === 'male' ? Math.min(4, Math.max(0, rawFamily.istri)) : 0,
  };

  const hasMaleDescendant = family.anakL > 0 || family.cucuL > 0 || family.cicitL > 0;
  const hasFemaleDescendant = family.anakP > 0 || family.cucuP > 0 || family.cicitP > 0;
  const hasAnyDescendant = hasMaleDescendant || hasFemaleDescendant;
  const totalSiblings = family.saudaraL + family.saudaraP;

  const activeKeys = (Object.keys(family) as HeirKey[]).filter((k) => family[k] > 0);
  const allocations: Record<string, InternalAllocation> = {};

  for (const key of activeKeys) {
    const count = family[key];
    if (NON_HEIR_KEYS.includes(key)) {
      allocations[key] = {
        key,
        count,
        fixedRatio: 0,
        fixedLabel: '0',
        isAshabah: false,
        isNonHeir: true,
        note: 'Tidak termasuk ahli waris nasab/sababiyah (hanya dapat melalui wasiat/hibah)',
      };
      continue;
    }

    // 1. Pasangan
    if (key === 'suami') {
      const ratio = hasAnyDescendant ? 1 / 4 : 1 / 2;
      allocations[key] = {
        key,
        count,
        fixedRatio: ratio,
        fixedLabel: hasAnyDescendant ? '1/4' : '1/2',
        isAshabah: false,
        note: hasAnyDescendant ? 'Ashabul Furud (1/4 karena ada keturunan)' : 'Ashabul Furud (1/2 karena tidak ada keturunan)',
      };
      continue;
    }

    if (key === 'istri') {
      const ratio = hasAnyDescendant ? 1 / 8 : 1 / 4;
      allocations[key] = {
        key,
        count,
        fixedRatio: ratio,
        fixedLabel: hasAnyDescendant ? '1/8' : '1/4',
        isAshabah: false,
        note:
          count > 1
            ? `Ashabul Furud (${hasAnyDescendant ? '1/8' : '1/4'} dibagi rata untuk ${count} istri)`
            : `Ashabul Furud (${hasAnyDescendant ? '1/8 karena ada keturunan' : '1/4 karena tidak ada keturunan'})`,
      };
      continue;
    }

    // 2. Keturunan Utama (Anak Kandung)
    if (key === 'anakL') {
      allocations[key] = {
        key,
        count,
        fixedRatio: 0,
        fixedLabel: 'Sisa',
        isAshabah: true,
        ashabahType: family.anakP > 0 ? 'Ashabah bil Ghair' : 'Ashabah',
        ashabahWeight: 2,
        ashabahPriority: 1,
        note: family.anakP > 0 ? "Ashabah bil Ghair bersama Anak P (rasio 2:1)" : 'Ashabah bin Nafs (penerima sisa utama)',
      };
      continue;
    }

    if (key === 'anakP') {
      if (family.anakL > 0) {
        allocations[key] = {
          key,
          count,
          fixedRatio: 0,
          fixedLabel: 'Sisa',
          isAshabah: true,
          ashabahType: 'Ashabah bil Ghair',
          ashabahWeight: 1,
          ashabahPriority: 1,
          note: "Ashabah bil Ghair bersama Anak L (rasio 1:2)",
        };
      } else {
        const ratio = count === 1 ? 1 / 2 : 2 / 3;
        allocations[key] = {
          key,
          count,
          fixedRatio: ratio,
          fixedLabel: count === 1 ? '1/2' : '2/3',
          isAshabah: false,
          note: count === 1 ? 'Ashabul Furud (1/2 karena anak perempuan tunggal)' : 'Ashabul Furud (2/3 dibagi rata)',
        };
      }
      continue;
    }

    // 3. Cucu (Jalur Bawah)
    if (key === 'cucuL') {
      if (family.anakL > 0) {
        allocations[key] = {
          key,
          count,
          fixedRatio: 0,
          fixedLabel: '0',
          isAshabah: false,
          blockedBy: 'Terhalang oleh Anak L',
          note: 'Hijab Hirman oleh Anak Kandung Laki-laki',
        };
      } else {
        allocations[key] = {
          key,
          count,
          fixedRatio: 0,
          fixedLabel: 'Sisa',
          isAshabah: true,
          ashabahType: family.cucuP > 0 ? 'Ashabah bil Ghair' : 'Ashabah',
          ashabahWeight: 2,
          ashabahPriority: 2,
          note: family.cucuP > 0 ? 'Ashabah bil Ghair bersama Cucu P (rasio 2:1)' : 'Ashabah bin Nafs (pengganti jalur anak L)',
        };
      }
      continue;
    }

    if (key === 'cucuP') {
      if (family.anakL > 0) {
        allocations[key] = {
          key,
          count,
          fixedRatio: 0,
          fixedLabel: '0',
          isAshabah: false,
          blockedBy: 'Terhalang oleh Anak L',
          note: 'Hijab Hirman oleh Anak Kandung Laki-laki',
        };
      } else if (family.cucuL > 0) {
        allocations[key] = {
          key,
          count,
          fixedRatio: 0,
          fixedLabel: 'Sisa',
          isAshabah: true,
          ashabahType: 'Ashabah bil Ghair',
          ashabahWeight: 1,
          ashabahPriority: 2,
          note: 'Ashabah bil Ghair bersama Cucu L (rasio 1:2)',
        };
      } else if (family.anakP === 0) {
        const ratio = count === 1 ? 1 / 2 : 2 / 3;
        allocations[key] = {
          key,
          count,
          fixedRatio: ratio,
          fixedLabel: count === 1 ? '1/2' : '2/3',
          isAshabah: false,
          note: count === 1 ? 'Ashabul Furud (1/2 karena tidak ada anak)' : 'Ashabul Furud (2/3 dibagi rata)',
        };
      } else if (family.anakP === 1) {
        allocations[key] = {
          key,
          count,
          fixedRatio: 1 / 6,
          fixedLabel: '1/6',
          isAshabah: false,
          note: 'Ashabul Furud (1/6 sebagai penyempurna 2/3 bersama 1 Anak P)',
        };
      } else {
        allocations[key] = {
          key,
          count,
          fixedRatio: 0,
          fixedLabel: '0',
          isAshabah: false,
          blockedBy: 'Terhalang oleh ≥2 Anak P',
          note: 'Bagian 2/3 telah terpenuhi oleh ≥2 Anak P dan tidak ada Cucu L',
        };
      }
      continue;
    }

    // 4. Cicit (Jalur Bawah Lanjutan)
    if (key === 'cicitL') {
      if (family.anakL > 0) {
        allocations[key] = {
          key,
          count,
          fixedRatio: 0,
          fixedLabel: '0',
          isAshabah: false,
          blockedBy: 'Terhalang oleh Anak L',
          note: 'Hijab Hirman oleh Anak Kandung Laki-laki',
        };
      } else if (family.cucuL > 0) {
        allocations[key] = {
          key,
          count,
          fixedRatio: 0,
          fixedLabel: '0',
          isAshabah: false,
          blockedBy: 'Terhalang oleh Cucu L',
          note: 'Hijab Hirman oleh Cucu Laki-laki',
        };
      } else {
        allocations[key] = {
          key,
          count,
          fixedRatio: 0,
          fixedLabel: 'Sisa',
          isAshabah: true,
          ashabahType: family.cicitP > 0 ? 'Ashabah bil Ghair' : 'Ashabah',
          ashabahWeight: 2,
          ashabahPriority: 3,
          note: family.cicitP > 0 ? 'Ashabah bil Ghair bersama Cicit P (rasio 2:1)' : 'Ashabah bin Nafs (jalur bawah)',
        };
      }
      continue;
    }

    if (key === 'cicitP') {
      if (family.anakL > 0) {
        allocations[key] = {
          key,
          count,
          fixedRatio: 0,
          fixedLabel: '0',
          isAshabah: false,
          blockedBy: 'Terhalang oleh Anak L',
          note: 'Hijab Hirman oleh Anak Kandung Laki-laki',
        };
      } else if (family.cucuL > 0) {
        allocations[key] = {
          key,
          count,
          fixedRatio: 0,
          fixedLabel: '0',
          isAshabah: false,
          blockedBy: 'Terhalang oleh Cucu L',
          note: 'Hijab Hirman oleh Cucu Laki-laki',
        };
      } else if (family.cicitL > 0) {
        allocations[key] = {
          key,
          count,
          fixedRatio: 0,
          fixedLabel: 'Sisa',
          isAshabah: true,
          ashabahType: 'Ashabah bil Ghair',
          ashabahWeight: 1,
          ashabahPriority: 3,
          note: 'Ashabah bil Ghair bersama Cicit L (rasio 1:2)',
        };
      } else {
        const higherFemaleCount = family.anakP + family.cucuP;
        if (higherFemaleCount === 0) {
          const ratio = count === 1 ? 1 / 2 : 2 / 3;
          allocations[key] = {
            key,
            count,
            fixedRatio: ratio,
            fixedLabel: count === 1 ? '1/2' : '2/3',
            isAshabah: false,
            note: count === 1 ? 'Ashabul Furud (1/2)' : 'Ashabul Furud (2/3 dibagi rata)',
          };
        } else if (higherFemaleCount === 1) {
          allocations[key] = {
            key,
            count,
            fixedRatio: 1 / 6,
            fixedLabel: '1/6',
            isAshabah: false,
            note: 'Ashabul Furud (1/6 sebagai penyempurna 2/3)',
          };
        } else {
          allocations[key] = {
            key,
            count,
            fixedRatio: 0,
            fixedLabel: '0',
            isAshabah: false,
            blockedBy: 'Terhalang oleh ≥2 Keturunan P',
            note: 'Bagian 2/3 telah terpenuhi oleh keturunan perempuan di atasnya',
          };
        }
      }
      continue;
    }

    // 5. Leluhur (Ibu, Ayah, Kakek, Nenek, Buyut)
    if (key === 'ibu') {
      if (hasAnyDescendant || totalSiblings >= 2) {
        allocations[key] = {
          key,
          count,
          fixedRatio: 1 / 6,
          fixedLabel: '1/6',
          isAshabah: false,
          note: hasAnyDescendant
            ? 'Ashabul Furud (1/6 karena ada keturunan)'
            : 'Ashabul Furud (1/6 karena ada ≥2 saudara)',
        };
      } else if (family.ayah > 0 && (family.suami > 0 || family.istri > 0)) {
        // Gharawain / Umariyatain: 1/3 dari sisa setelah pasangan
        const spouseShare = family.suami > 0 ? 1 / 2 : 1 / 4;
        const ratio = (1 - spouseShare) / 3;
        allocations[key] = {
          key,
          count,
          fixedRatio: ratio,
          fixedLabel: '1/3 Sisa',
          isAshabah: false,
          note: 'Kasus Gharawain (1/3 dari sisa setelah pasangan bersama Ayah)',
        };
      } else {
        allocations[key] = {
          key,
          count,
          fixedRatio: 1 / 3,
          fixedLabel: '1/3',
          isAshabah: false,
          note: 'Ashabul Furud (1/3 karena tidak ada keturunan & <2 saudara)',
        };
      }
      continue;
    }

    if (key === 'ayah') {
      if (hasMaleDescendant) {
        allocations[key] = {
          key,
          count,
          fixedRatio: 1 / 6,
          fixedLabel: '1/6',
          isAshabah: false,
          note: 'Ashabul Furud (1/6 karena ada keturunan laki-laki)',
        };
      } else if (hasFemaleDescendant) {
        allocations[key] = {
          key,
          count,
          fixedRatio: 1 / 6,
          fixedLabel: '1/6 + Sisa',
          isAshabah: true,
          ashabahType: 'Ashabah',
          ashabahWeight: 1,
          ashabahPriority: 4,
          note: 'Ashabul Furud 1/6 + Ashabah (mengambil sisa karena hanya ada keturunan P)',
        };
      } else {
        allocations[key] = {
          key,
          count,
          fixedRatio: 0,
          fixedLabel: 'Sisa',
          isAshabah: true,
          ashabahType: 'Ashabah',
          ashabahWeight: 1,
          ashabahPriority: 4,
          note: 'Ashabah bin Nafs (tidak ada keturunan)',
        };
      }
      continue;
    }

    if (key === 'kakek') {
      if (family.ayah > 0) {
        allocations[key] = {
          key,
          count,
          fixedRatio: 0,
          fixedLabel: '0',
          isAshabah: false,
          blockedBy: 'Terhalang oleh Ayah',
          note: 'Hijab Hirman oleh Ayah Kandung',
        };
      } else if (hasMaleDescendant) {
        allocations[key] = {
          key,
          count,
          fixedRatio: 1 / 6,
          fixedLabel: '1/6',
          isAshabah: false,
          note: 'Menggantikan posisi Ayah (1/6 karena ada keturunan L)',
        };
      } else if (hasFemaleDescendant) {
        allocations[key] = {
          key,
          count,
          fixedRatio: 1 / 6,
          fixedLabel: '1/6 + Sisa',
          isAshabah: true,
          ashabahType: 'Ashabah',
          ashabahWeight: 1,
          ashabahPriority: 5,
          note: 'Menggantikan Ayah (1/6 + Ashabah sisa)',
        };
      } else {
        allocations[key] = {
          key,
          count,
          fixedRatio: 0,
          fixedLabel: 'Sisa',
          isAshabah: true,
          ashabahType: 'Ashabah',
          ashabahWeight: 1,
          ashabahPriority: 5,
          note: 'Ashabah bin Nafs (menggantikan Ayah)',
        };
      }
      continue;
    }

    if (key === 'nenek') {
      if (family.ibu > 0) {
        allocations[key] = {
          key,
          count,
          fixedRatio: 0,
          fixedLabel: '0',
          isAshabah: false,
          blockedBy: 'Terhalang oleh Ibu',
          note: 'Hijab Hirman oleh Ibu Kandung',
        };
      } else {
        allocations[key] = {
          key,
          count,
          fixedRatio: 1 / 6,
          fixedLabel: '1/6',
          isAshabah: false,
          note: count > 1 ? 'Ashabul Furud (1/6 dibagi rata)' : 'Ashabul Furud (1/6 karena Ibu tiada)',
        };
      }
      continue;
    }

    if (key === 'buyutL') {
      if (family.ayah > 0) {
        allocations[key] = {
          key,
          count,
          fixedRatio: 0,
          fixedLabel: '0',
          isAshabah: false,
          blockedBy: 'Terhalang oleh Ayah',
          note: 'Hijab Hirman oleh Ayah Kandung',
        };
      } else if (family.kakek > 0) {
        allocations[key] = {
          key,
          count,
          fixedRatio: 0,
          fixedLabel: '0',
          isAshabah: false,
          blockedBy: 'Terhalang oleh Kakek',
          note: 'Hijab Hirman oleh Kakek',
        };
      } else if (hasMaleDescendant) {
        allocations[key] = {
          key,
          count,
          fixedRatio: 1 / 6,
          fixedLabel: '1/6',
          isAshabah: false,
          note: 'Ashabul Furud 1/6 (menggantikan jalur kakek)',
        };
      } else {
        allocations[key] = {
          key,
          count,
          fixedRatio: hasFemaleDescendant ? 1 / 6 : 0,
          fixedLabel: hasFemaleDescendant ? '1/6 + Sisa' : 'Sisa',
          isAshabah: true,
          ashabahType: 'Ashabah',
          ashabahWeight: 1,
          ashabahPriority: 6,
          note: 'Ashabah jalur atas (Ayah & Kakek tiada)',
        };
      }
      continue;
    }

    if (key === 'buyutP') {
      if (family.ibu > 0) {
        allocations[key] = {
          key,
          count,
          fixedRatio: 0,
          fixedLabel: '0',
          isAshabah: false,
          blockedBy: 'Terhalang oleh Ibu',
          note: 'Hijab Hirman oleh Ibu Kandung',
        };
      } else if (family.nenek > 0) {
        allocations[key] = {
          key,
          count,
          fixedRatio: 0,
          fixedLabel: '0',
          isAshabah: false,
          blockedBy: 'Terhalang oleh Nenek',
          note: 'Hijab Hirman oleh Nenek',
        };
      } else {
        allocations[key] = {
          key,
          count,
          fixedRatio: 1 / 6,
          fixedLabel: '1/6',
          isAshabah: false,
          note: 'Ashabul Furud (1/6 karena Ibu & Nenek tiada)',
        };
      }
      continue;
    }

    // 6. Sampingan (Saudara Kandung)
    if (key === 'saudaraL' || key === 'saudaraP') {
      let blocker: string | undefined;
      if (family.anakL > 0) blocker = 'Terhalang oleh Anak L';
      else if (family.cucuL > 0) blocker = 'Terhalang oleh Cucu L';
      else if (family.cicitL > 0) blocker = 'Terhalang oleh Cicit L';
      else if (family.ayah > 0) blocker = 'Terhalang oleh Ayah';
      else if (family.kakek > 0) blocker = 'Terhalang oleh Kakek';

      if (blocker) {
        allocations[key] = {
          key,
          count,
          fixedRatio: 0,
          fixedLabel: '0',
          isAshabah: false,
          blockedBy: blocker,
          note: `Hijab Hirman (${blocker})`,
        };
        continue;
      }

      if (key === 'saudaraL') {
        allocations[key] = {
          key,
          count,
          fixedRatio: 0,
          fixedLabel: 'Sisa',
          isAshabah: true,
          ashabahType: family.saudaraP > 0 ? 'Ashabah bil Ghair' : 'Ashabah',
          ashabahWeight: 2,
          ashabahPriority: 7,
          note:
            family.saudaraP > 0
              ? 'Ashabah bil Ghair bersama Saudara P (rasio 2:1)'
              : 'Ashabah bin Nafs (Ayah & keturunan L tiada)',
        };
      } else {
        // Saudara P
        if (family.saudaraL > 0) {
          allocations[key] = {
            key,
            count,
            fixedRatio: 0,
            fixedLabel: 'Sisa',
            isAshabah: true,
            ashabahType: 'Ashabah bil Ghair',
            ashabahWeight: 1,
            ashabahPriority: 7,
            note: 'Ashabah bil Ghair bersama Saudara L (rasio 1:2)',
          };
        } else if (hasFemaleDescendant) {
          // Ashabah Ma'al Ghair!
          allocations[key] = {
            key,
            count,
            fixedRatio: 0,
            fixedLabel: 'Sisa',
            isAshabah: true,
            ashabahType: "Ashabah Ma'al Ghair",
            ashabahWeight: 1,
            ashabahPriority: 7,
            note: "Ashabah Ma'al Ghair (bersama keturunan P saat Ayah & keturunan L tiada)",
          };
        } else {
          const ratio = count === 1 ? 1 / 2 : 2 / 3;
          allocations[key] = {
            key,
            count,
            fixedRatio: ratio,
            fixedLabel: count === 1 ? '1/2' : '2/3',
            isAshabah: false,
            note: count === 1 ? 'Ashabul Furud (1/2 karena tunggal, Kalalah)' : 'Ashabul Furud (2/3 dibagi rata, Kalalah)',
          };
        }
      }
    }
  }

  // Compute totals for Fixed Shares & Ashabah distribution
  const allocList = activeKeys.map((k) => allocations[k]);
  const totalFixed = allocList.reduce((sum, a) => sum + a.fixedRatio, 0);

  // Determine winning Ashabah priority group (lowest priority number)
  const ashabahCandidates = allocList.filter((a) => a.isAshabah && !a.blockedBy && !a.isNonHeir);
  const minAshabahPriority =
    ashabahCandidates.length > 0
      ? Math.min(...ashabahCandidates.map((a) => a.ashabahPriority ?? 99))
      : null;
  const activeAshabahGroup =
    minAshabahPriority !== null
      ? ashabahCandidates.filter((a) => a.ashabahPriority === minAshabahPriority)
      : [];

  const finalRatios: Record<string, number> = {};
  let adjustmentType: CalculationResult['adjustmentType'] = 'normal';
  let adjustmentNote: string | null = null;

  if (activeKeys.length === 0 || allocList.every((a) => a.blockedBy || a.isNonHeir)) {
    adjustmentType = 'empty';
    adjustmentNote = 'Belum ada ahli waris yang berhak menerima pembagian harta.';
    for (const a of allocList) finalRatios[a.key] = 0;
  } else if (totalFixed > 1 + 1e-9) {
    // 'AUL: Total fixed shares exceed 100% -> proportional reduction
    adjustmentType = 'aul';
    const pctBefore = (totalFixed * 100).toFixed(2);
    adjustmentNote = `Mekanisme 'Aul diterapkan: total bagian pasti (Ashabul Furud) mencapai ${pctBefore}% (>100%), sehingga seluruh bagian pasti dikurangi secara proporsional agar total genap 100%.`;
    for (const a of allocList) {
      finalRatios[a.key] = a.fixedRatio > 0 ? a.fixedRatio / totalFixed : 0;
    }
  } else {
    const remainder = Math.max(0, 1 - totalFixed);
    if (remainder > 1e-9 && activeAshabahGroup.length > 0) {
      const totalWeight = activeAshabahGroup.reduce(
        (sum, a) => sum + a.count * (a.ashabahWeight ?? 1),
        0
      );
      for (const a of allocList) {
        let ratio = a.fixedRatio;
        if (activeAshabahGroup.includes(a) && totalWeight > 0) {
          ratio += remainder * ((a.count * (a.ashabahWeight ?? 1)) / totalWeight);
        }
        finalRatios[a.key] = ratio;
      }
    } else if (remainder > 1e-9 && activeAshabahGroup.length === 0) {
      // RADD: Remainder exists and no Ashabah is present
      const nonSpouseFixed = allocList.filter(
        (a) => a.fixedRatio > 0 && a.key !== 'suami' && a.key !== 'istri'
      );
      if (nonSpouseFixed.length > 0) {
        const nonSpouseSum = nonSpouseFixed.reduce((sum, a) => sum + a.fixedRatio, 0);
        adjustmentType = 'radd';
        adjustmentNote = `Mekanisme Radd diterapkan (KHI Pasal 193): sisa harta sebesar ${formatPercent(
          remainder
        )} dikembalikan secara proporsional kepada Ashabul Furud nasab (selain pasangan) karena tidak ada penerima 'Ashabah.`;
        for (const a of allocList) {
          if (nonSpouseFixed.includes(a) && nonSpouseSum > 0) {
            finalRatios[a.key] = a.fixedRatio + remainder * (a.fixedRatio / nonSpouseSum);
          } else {
            finalRatios[a.key] = a.fixedRatio;
          }
        }
      } else {
        // Only spouse exists -> return remainder to spouse with Radd/KHI note
        const spouseFixed = allocList.filter((a) => a.fixedRatio > 0);
        const spouseSum = spouseFixed.reduce((sum, a) => sum + a.fixedRatio, 0);
        adjustmentType = 'radd';
        adjustmentNote = `Mekanisme Radd (Pasangan Tunggal): tidak terdapat ahli waris nasab maupun 'Ashabah lain, sehingga sisa ${formatPercent(
          remainder
        )} dikembalikan ke pasangan (catatan: sebagian pendapat fikih klasik menyalurkan sisa ini ke Baitul Mal).`;
        for (const a of allocList) {
          finalRatios[a.key] = spouseSum > 0 && a.fixedRatio > 0 ? a.fixedRatio / spouseSum : 0;
        }
      }
    } else {
      for (const a of allocList) {
        finalRatios[a.key] = a.fixedRatio;
      }
    }
  }

  // Build final rows for ALL family members with count > 0
  const rows: HeirResultRow[] = allocList.map((a) => {
    const meta = HEIR_METADATA[a.key];
    const ratio = finalRatios[a.key] ?? 0;
    const totalAmount = netEstate * ratio;
    const perPersonAmount = a.count > 0 ? totalAmount / a.count : 0;

    let statusLabel = 'Mendapat Waris';
    let statusTone: HeirResultRow['statusTone'] = 'eligible';
    let reason = a.note;
    let fractionLabel = a.fixedLabel;

    if (a.isNonHeir) {
      statusLabel = 'Bukan Ahli Waris';
      statusTone = 'non_heir';
      fractionLabel = '—';
    } else if (a.blockedBy) {
      statusLabel = 'Terhalang (Mahjub)';
      statusTone = 'blocked';
      reason = a.blockedBy;
      fractionLabel = '0';
    } else if (ratio <= 1e-9 && a.isAshabah) {
      statusLabel = 'Terhalang (Mahjub)';
      statusTone = 'blocked';
      reason =
        adjustmentType === 'aul'
          ? "Sisa habis karena 'Aul"
          : 'Sisa telah habis oleh Ashabul Furud / Ashabah prioritas lebih tinggi';
      fractionLabel = '0';
    } else if (a.isAshabah && activeAshabahGroup.includes(a)) {
      statusLabel = a.ashabahType ?? 'Ashabah';
      statusTone = 'eligible';
      fractionLabel = a.fixedRatio > 0 ? `${a.fixedLabel} (${formatPercent(ratio)})` : formatPercent(ratio);
    } else {
      statusLabel = adjustmentType === 'aul' ? "Mendapat Waris ('Aul)" : adjustmentType === 'radd' && a.key !== 'suami' && a.key !== 'istri' ? 'Mendapat Waris (Radd)' : 'Mendapat Waris';
      statusTone = 'eligible';
      fractionLabel = `${a.fixedLabel} (${formatPercent(ratio)})`;
    }

    return {
      key: a.key,
      label: meta.label,
      category: meta.group,
      count: a.count,
      statusLabel,
      statusTone,
      reason,
      fractionLabel,
      totalShareRatio: ratio,
      totalAmount,
      perPersonAmount,
    };
  });

  const totalDistributedRatio = rows.reduce((s, r) => s + r.totalShareRatio, 0);
  const totalDistributedAmount = rows.reduce((s, r) => s + r.totalAmount, 0);

  return {
    system: 'islam',
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
