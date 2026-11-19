/**
 * Local & Extensible AI Legal Coach Module.
 * Designed to answer critical inheritance law questions directly, analytically,
 * and concisely without rambling through case numbers.
 */

import { AppState, CalculationResult } from '../types/inheritance';
import { formatCurrency } from './currency';

export const QUICK_COACH_QUESTIONS: string[] = [
  'Mengapa Faraid memakai rasio 2:1, sedangkan BW 1:1?',
  "Apa itu mekanisme 'Aul dan Radd dalam waris Islam?",
  'Bagaimana status saudara perempuan saat Ayah ada vs tiada?',
  'Bagaimana hak anak angkat, anak tiri, dan anak luar kawin?',
  'Mengapa wasiat dibatasi maksimal 1/3 harta bersih?',
];

export function generateLegalCoachResponse(
  rawQuery: string,
  state: AppState,
  result: CalculationResult
): string {
  const q = rawQuery.toLowerCase().trim();

  // 1. Rasio 2:1 vs Kesetaraan 1:1 (BW)
  if (
    q.includes('2:1') ||
    q.includes('1:1') ||
    q.includes('setara') ||
    q.includes('laki-laki lebih besar') ||
    q.includes('perbedaan islam dan perdata') ||
    q.includes('beda faraid') ||
    q.includes('beda bw')
  ) {
    return [
      '**Rasio 2:1 (Faraid/KHI) vs Kesetaraan 1:1 (KUHPerdata/BW):**',
      '1. **Hukum Waris Islam (QS. An-Nisa: 11 & KHI Pasal 176):** Rasio 2:1 bagi anak laki-laki dibanding anak perempuan berakar pada prinsip *tanggung jawab finansial* (nafkah keluarga, mahar, dan tanggungan kerabat dibebankan secara syar\'i pada laki-laki, sementara harta perempuan sepenuhnya miliknya sendiri).',
      '2. **Hukum Perdata Barat (KUHPerdata Pasal 852):** Menganut asas *kesetaraan individual (egaliter)* — seluruh anak dan pasangan di Golongan I mendapat bagian sama rata **1:1** tanpa membedakan jenis kelamin atau urutan kelahiran.',
      '3. **Catatan Praktis di Indonesia:** Dalam KHI Pasal 183, ahli waris Muslim tetap dimungkinkan melakukan pembagian secara damai (*tashaluh*) dengan porsi berbeda setelah masing-masing mengetahui hak pastinya secara sadar.',
    ].join('\n\n');
  }

  // 2. Mekanisme 'Aul dan Radd
  if (q.includes('aul') || q.includes('radd') || q.includes('lebih dari 100') || q.includes('kelebihan') || q.includes('sisa harta')) {
    return [
      "**Mekanisme 'Aul dan Radd dalam Ilmu Faraid:**",
      "• **'Aul (Pengurangan Proporsional):** Terjadi ketika total bagian pasti (*Ashabul Furud*) melebihi 100% (misal: Suami 1/2 + 2 Saudara Perempuan 2/3 = 7/6). Penyebut dinaikkan sebesar jumlah pembilang agar seluruh Ashabul Furud terpotong secara adil dan proporsional, sementara *'Ashabah* tidak menerima sisa.",
      "• **Radd (Pengembalian Sisa):** Kebalikan dari 'Aul — terjadi saat total bagian pasti < 100% dan **tidak ada** ahli waris *'Ashabah*. Berdasarkan **KHI Pasal 193**, sisa harta dikembalikan secara proporsional kepada para *Ashabul Furud* nasab (selain pasangan). Jika hanya ada pasangan tunggal tanpa kerabat lain, sebagian ulama menyalurkan sisa ke Baitul Mal, namun praktik KHI modern mengembalikannya kepada pasangan.",
    ].join('\n\n');
  }

  // 3. Status Saudara Perempuan saat Ayah ada vs tiada (Hijab & Ashabah Ma'al Ghair)
  if (
    q.includes('saudara') ||
    q.includes("ma'al ghair") ||
    q.includes('maal ghair') ||
    q.includes('kalalah')
  ) {
    return [
      '**Kedudukan Saudara Kandung (Saat Ayah Ada vs Tiada):**',
      '1. **Saat Ayah (atau Keturunan Laki-laki) Masih Hidup:** Saudara kandung laki-laki maupun perempuan **terhalang penuh (*Hijab Hirman*)** dalam Faraid dan tidak mendapat bagian waris.',
      "2. **Saat Ayah & Keturunan Laki-laki Tiada, namun Ada Anak/Cucu Perempuan:** Saudara kandung perempuan naik status menjadi **'Ashabah Ma'al Ghair** (mengambil seluruh sisa harta setelah Ashabul Furud, sesuai hadis riwayat Bukhari tentang keputusan Ibnu Mas'ud).",
      '3. **Saat Ayah & Keturunan Sama Sekali Tiada (*Kalalah*):** 1 saudara perempuan mendapat **1/2**, ≥2 saudara perempuan mendapat **2/3**, atau berbagi sisa **2:1** (*Ashabah bil Ghair*) bila bersama saudara laki-laki.',
      '4. **Dalam KUHPerdata (BW):** Saudara kandung berada di **Golongan II** bersama orang tua, sehingga baru mewaris jika **Golongan I** (pasangan & keturunan) kosong.',
    ].join('\n\n');
  }

  // 4. Anak Angkat, Anak Tiri, Anak Luar Kawin, Mertua, Menantu
  if (
    q.includes('angkat') ||
    q.includes('tiri') ||
    q.includes('luar kawin') ||
    q.includes('mertua') ||
    q.includes('menantu') ||
    q.includes('bukan ahli waris') ||
    q.includes('wasiat wajibah')
  ) {
    return [
      '**Status Hukum Anak Angkat, Anak Tiri, Anak Luar Kawin, Mertua & Menantu:**',
      '• **Anak Tiri, Mertua, dan Menantu:** Baik di KHI/Faraid maupun KUHPerdata (BW), ketiganya **bukan ahli waris** karena tidak memiliki hubungan nasab/darah langsung dengan pewaris. Pemberian harta kepada mereka hanya sah melalui **hibah** (saat hidup) atau **wasiat** (maksimal 1/3 harta bersih).',
      '• **Anak Angkat (Adopsi):** Tidak memutus nasab orang tua kandung, sehingga bukan ahli waris langsung di Faraid. Namun **KHI Pasal 209** memberikan hak **Wasiat Wajibah** maksimal **1/3 harta warisan** secara timbal balik antara anak angkat dan orang tua angkat.',
      '• **Anak Luar Kawin:** Menurut KHI Pasal 186 hanya memiliki hubungan nasab dengan ibu & keluarga ibunya; namun berdasarkan **Putusan MK No. 46/PUU-VIII/2010**, anak luar kawin juga memiliki hubungan keperdataan dengan ayah biologisnya apabila dapat dibuktikan secara ilmu pengetahuan/teknologi (tes DNA) atau bukti hukum lain.',
    ].join('\n\n');
  }

  // 5. Batas Wasiat 1/3 & Wasiat untuk Ahli Waris
  if (q.includes('wasiat') || q.includes('1/3') || q.includes('hibah') || q.includes('sepertiga')) {
    const statusNote = result.isWillExcessive
      ? `\n\n**Catatan Simulasi Aktif:** Nilai wasiat Anda saat ini (${formatCurrency(
          state.financials.willAmount,
          state.currency
        )}) melebihi batas 1/3 (${formatCurrency(result.maxAllowedWill, state.currency)}). Kelebihannya hanya sah jika disetujui seluruh ahli waris.`
      : '';
    return [
      '**Aturan Batas Maksimal Wasiat 1/3 (KHI Pasal 195 & Hadis Sa\'ad bin Abi Waqqash):**',
      '1. **Maksimal 1/3 Harta Bersih:** Wasiat dihitung dari harta peninggalan setelah dikurangi biaya pemakaman dan pelunasan utang. Tujuannya melindungi hak ekonomi ahli waris agar tidak terlantar.',
      '2. **Larangan Wasiat untuk Ahli Waris:** Wasiat pada dasarnya ditujukan kepada *non-ahli waris*. Jika ditujukan kepada salah satu ahli waris, atau nominalnya melebihi 1/3, maka pelaksanaannya **wajib mendapat persetujuan seluruh ahli waris lain** (*KHI Pasal 195 ayat 2–3*).',
      '3. **Batas di KUHPerdata (BW):** BW melindungi ahli waris garis lurus melalui *Legitieme Portie* (bagian mutlak yang tidak boleh dilanggar oleh wasiat/hibah).',
    ].join('\n\n') + statusNote;
  }

  // 6. Hak Pasangan (Suami / Istri / Poligami)
  if (q.includes('suami') || q.includes('istri') || q.includes('pasangan') || q.includes('poligami') || q.includes('gono-gini') || q.includes('harta bersama')) {
    return [
      '**Hak Pasangan (Suami/Istri) & Pemisahan Harta Bersama:**',
      '1. **Keluarkan Harta Bersama (Gono-gini) Terlebih Dahulu:** Sebelum menghitung warisan, 50% harta bersama yang diperoleh selama perkawinan adalah hak milik pasangan yang masih hidup (KHI Pasal 96–97). Hanya 50% sisanya + harta bawaan pewaris yang menjadi *harta warisan*.',
      '2. **Porsi Faraid/KHI:** Suami mendapat **1/2** (tanpa keturunan) atau **1/4** (ada keturunan). Istri mendapat **1/4** (tanpa keturunan) atau **1/8** (ada keturunan). Pada pernikahan poligami (2–4 istri), porsi 1/4 atau 1/8 tersebut **dibagi rata** di antara para istri.',
      '3. **Porsi KUHPerdata (BW):** Pasangan sah berada di **Golongan I** dan menerima bagian **sama rata (1:1)** dengan setiap anak kandung.',
    ].join('\n\n');
  }

  // 7. Hijab / Terhalang / Mahjub / Cucu / Kakek / Nenek
  if (
    q.includes('hijab') ||
    q.includes('mahjub') ||
    q.includes('terhalang') ||
    q.includes('cucu') ||
    q.includes('kakek') ||
    q.includes('nenek') ||
    q.includes('golongan')
  ) {
    const blockedRows = result.rows.filter((r) => r.statusTone === 'blocked');
    const activeBlockedSummary =
      blockedRows.length > 0
        ? `\n\n**Status Terhalang di Simulasi Anda Saat Ini:** ${blockedRows
            .map((r) => `${r.label} (${r.reason})`)
            .join('; ')}.`
        : '';

    return [
      '**Prinsip Hijab (Penghalangan) dalam Hukum Waris:**',
      '• **Hijab Hirman (Penghalangan Total — Faraid):** Ahli waris berderajat lebih dekat menutup ahli waris lebih jauh pada jalur yang sama. Contoh utama: **Anak L** menghalangi Cucu, Cicit, dan Saudara; **Ayah** menghalangi Kakek, Buyut L, dan Saudara; **Ibu** menghalangi Nenek dan Buyut P.',
      '• **Hijab Nuqshan (Pengurangan Porsi):** Keberadaan keturunan menurunkan bagian Suami (1/2 → 1/4), Istri (1/4 → 1/8), dan Ibu (1/3 → 1/6).',
      '• **Sistem Golongan (BW):** Golongan I menutup total Golongan II–IV; Golongan II menutup Golongan III–IV.',
    ].join('\n\n') + activeBlockedSummary;
  }

  // 8. Utang & Pemakaman
  if (q.includes('utang') || q.includes('hutang') || q.includes('pemakaman') || q.includes('tajhiz') || q.includes('kewajiban')) {
    return [
      '**Urutan Prioritas Pengurang Harta Sebelum Pembagian Waris (KHI Pasal 175):**',
      '1. **Biaya Pemakaman (*Tajhiz*):** Pengurusan jenazah secara wajar.',
      '2. **Pelunasan Utang Pewaris:** Baik utang kepada sesama manusia (*dainul ibad*) maupun kewajiban finansial yang jatuh tempo, termasuk biaya perawatan medis terakhir.',
      '3. **Pelaksanaan Wasiat:** Maksimal 1/3 dari harta bersih setelah utang & pemakaman.',
      '4. **Pembagian Waris:** Hanya **sisa bersih** yang dibagikan kepada ahli waris. Jika utang melebihi harta, ahli waris tidak wajib menanggung utang dengan harta pribadinya (di BW, ahli waris dapat menolak warisan atau menerima secara *beneficiair*).',
    ].join('\n\n');
  }

  // 9. Contextual analytical answer for general / current-case questions
  const eligibleRows = result.rows.filter((r) => r.statusTone === 'eligible');
  const blockedRows = result.rows.filter((r) => r.statusTone === 'blocked');
  const sysLabel = state.legalSystem === 'islam' ? 'Hukum Waris Islam (KHI & Faraid)' : 'Hukum Waris Perdata (KUHPerdata / BW)';

  return [
    `**Analisis Ringkas (${sysLabel}):**`,
    `• **Harta Bersih Siap Dibagi:** ${formatCurrency(result.netEstate, state.currency)} untuk **${eligibleRows.length} kelompok ahli waris aktif**${
      blockedRows.length > 0 ? ` (${blockedRows.length} kelompok terhalang/mahjub)` : ''
    }.`,
    result.adjustmentNote ? `• **Kaidah Berlaku:** ${result.adjustmentNote}` : '',
    '• **Topik yang Dapat Anda Tanyakan Lebih Lanjut:** rasio `2:1` vs `1:1` BW, mekanisme `\'Aul` & `Radd`, status saudara perempuan (*Ashabah Ma\'al Ghair*), batas wasiat `1/3`, hak pasangan/harta bersama, atau status anak angkat/tiri/luar kawin.',
  ]
    .filter(Boolean)
    .join('\n\n');
}
