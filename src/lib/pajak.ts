import { phpFetch, getPhpToken } from "./api-client";
import type { ReportVersion } from "./laba-rugi";

// ── Types consumed by LabaRugiUmumView, pajak-excel, and page components ─────
// These form the "Laporan Laba Rugi" structure (income statement).
// The `koreksi` and `fiskal` columns are remnants of an earlier fiscal-
// correction design; the UI currently only reads `komersial`.  We keep the
// shape so existing components don't break.

export interface TaxReportRow {
  code: string;
  name: string;
  komersial: number;
  koreksi: number;
  fiskal: number;
  isCustom?: boolean;
}

export interface TaxReportSection {
  title: string;
  items: TaxReportRow[];
  totalKomersial: number;
  totalKoreksi: number;
  totalFiskal: number;
}

export interface LaporanPajakData {
  entityId: string;
  entityName: string;
  year: number;
  pendapatan: {
    items: TaxReportRow[];
    totalKomersial: number;
    totalKoreksi: number;
    totalFiskal: number;
  };
  biayaLangsung: {
    items: TaxReportRow[];
    totalKomersial: number;
    totalKoreksi: number;
    totalFiskal: number;
  };
  labaKotor: {
    komersial: number;
    koreksi: number;
    fiskal: number;
  };
  biayaOperasional: {
    items: TaxReportRow[];
    totalKomersial: number;
    totalKoreksi: number;
    totalFiskal: number;
  };
  labaOperasional: {
    komersial: number;
    koreksi: number;
    fiskal: number;
  };
  pphFinal: {
    items: TaxReportRow[];
    totalKomersial: number;
    totalKoreksi: number;
    totalFiskal: number;
  };
  labaSetelahPajak: {
    komersial: number;
    koreksi: number;
    fiskal: number;
  };
  pendapatanBiayaLain: {
    items: TaxReportRow[];
    totalKomersial: number;
    totalKoreksi: number;
    totalFiskal: number;
  };
  labaBersih: {
    komersial: number;
    koreksi: number;
    fiskal: number;
  };
}

export function formatAccounting(val: number): string {
  if (!val || Math.round(val) === 0) return "Rp -";
  const rounded = Math.round(val);
  const formatted = Math.abs(rounded).toLocaleString("id-ID");
  return rounded < 0 ? `Rp (${formatted})` : `Rp ${formatted}`;
}

// ── PHP /api/laba-rugi item shape ─────────────────────────────────────────────
type PhpLRItem = {
  id: string | null;
  code: string;
  name: string;
  kategori: string;
  debit: number;
  kredit: number;
  saldo: number;
  isAuto?: boolean;
};

type PhpLabaRugiResponse = {
  entityId: string;
  dari: string;
  sampai: string;
  version: string;
  pendapatan: PhpLRItem[];
  beban: PhpLRItem[];
  totalPendapatan: number;
  totalBeban: number;
  labaBersih: number;
  bebanPenyusutan: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRow(item: PhpLRItem): TaxReportRow {
  return {
    code:       item.code,
    name:       item.name,
    komersial:  item.saldo,
    koreksi:    0,
    fiskal:     item.saldo,
    isCustom:   item.isAuto ?? false,
  };
}

function makeSection(items: TaxReportRow[]) {
  const totalKomersial = items.reduce((s, r) => s + r.komersial, 0);
  return {
    items,
    totalKomersial,
    totalKoreksi: 0,
    totalFiskal:  totalKomersial,
  };
}

/**
 * Classify a beban COA item into one of four section buckets:
 *   - "langsung"    → COA codes starting with 6 (project-level direct costs)
 *   - "operasional" → COA codes starting with 5 (overhead / admin)
 *   - "pph"         → COA name contains "PPh" / "pph" / "pajak final"
 *   - "lain"        → anything else
 */
function classifyBeban(item: PhpLRItem): "langsung" | "operasional" | "pph" | "lain" {
  const code = item.code.trim();
  const nameLower = item.name.toLowerCase();

  // PPh final recognition (by name keyword — no dedicated code range in seed)
  if (
    nameLower.includes("pph") ||
    nameLower.includes("ppfinal") ||
    nameLower.includes("pajak final") ||
    nameLower.includes("pajak penghasilan final")
  ) {
    return "pph";
  }

  // Code-based classification
  const firstChar = code[0];
  if (firstChar === "6") return "langsung";
  if (firstChar === "5") return "operasional";

  // 4xx beban (rare but possible for contra-revenue items) → lain
  return "lain";
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function getLaporanPajakData(
  entityId: string | string[],
  year: number,
  version: ReportVersion = "INTERNAL",
  entityName?: string
): Promise<LaporanPajakData> {
  const token = await getPhpToken();

  // Normalise to array; for multiple entities we aggregate by fetching each
  // individually and summing saldo values.
  const ids = Array.isArray(entityId) ? entityId : [entityId];

  // Fetch all entities concurrently
  const responses = await Promise.all(
    ids.map((id) => {
      const params = new URLSearchParams({
        entityId: id,
        dari:     `${year}-01-01`,
        sampai:   `${year}-12-31`,
        version:  version,
      });
      return phpFetch<PhpLabaRugiResponse>(
        `/api/laba-rugi?${params.toString()}`,
        token
      );
    })
  );

  // Aggregate rows across entities
  // Key = code; accumulate saldo
  const pendapatanMap = new Map<string, PhpLRItem>();
  const bebanMap = new Map<string, PhpLRItem>();

  for (const resp of responses) {
    for (const item of resp.pendapatan) {
      const existing = pendapatanMap.get(item.code);
      if (existing) {
        existing.saldo  += item.saldo;
        existing.debit  += item.debit;
        existing.kredit += item.kredit;
      } else {
        pendapatanMap.set(item.code, { ...item });
      }
    }
    for (const item of resp.beban) {
      const existing = bebanMap.get(item.code);
      if (existing) {
        existing.saldo  += item.saldo;
        existing.debit  += item.debit;
        existing.kredit += item.kredit;
      } else {
        bebanMap.set(item.code, { ...item });
      }
    }
  }

  // --- Pendapatan ---
  // Split: "main" revenue (4xx code) vs "pendapatan lain-lain" (jasa giro etc.)
  const pendapatanItems: TaxReportRow[] = [];
  const pendapatanLainItems: TaxReportRow[] = [];

  for (const item of pendapatanMap.values()) {
    const row = makeRow(item);
    // "Pendapatan Jasa Giro" (code 410 etc.) → lain-lain; 400 → main pendapatan
    if (item.code === "400" || item.code.startsWith("40")) {
      pendapatanItems.push(row);
    } else {
      // Pendapatan non-400: put into pendapatanBiayaLain (income from other sources)
      pendapatanLainItems.push(row);
    }
  }

  // If pendapatanItems is empty (all were "other"), move them to main
  if (pendapatanItems.length === 0 && pendapatanLainItems.length > 0) {
    pendapatanItems.push(...pendapatanLainItems.splice(0));
  }

  const pendapatanSection = makeSection(pendapatanItems);

  // --- Beban classification ---
  const langsungRows: TaxReportRow[] = [];
  const operasionalRows: TaxReportRow[] = [];
  const pphRows: TaxReportRow[] = [];
  const bebanLainRows: TaxReportRow[] = [];

  for (const item of bebanMap.values()) {
    const bucket = classifyBeban(item);
    const row = makeRow(item);
    if (bucket === "langsung")    langsungRows.push(row);
    else if (bucket === "operasional") operasionalRows.push(row);
    else if (bucket === "pph")    pphRows.push(row);
    else                          bebanLainRows.push(row);
  }

  const biayaLangsungSection    = makeSection(langsungRows);
  const biayaOperasionalSection = makeSection(operasionalRows);
  const pphFinalSection         = makeSection(pphRows);

  // Merge beban lain-lain with pendapatan lain-lain (both go into the same section)
  // Sign convention: income is positive, expense is negative for the "lain" section
  const pendapatanBiayaLainItems: TaxReportRow[] = [
    ...pendapatanLainItems,
    // negate beban items so they reduce the net
    ...bebanLainRows.map((r) => ({ ...r, komersial: -r.komersial, fiskal: -r.fiskal })),
  ];
  const pendapatanBiayaLainSection = makeSection(pendapatanBiayaLainItems);

  // --- Computed subtotals ---
  const labaKotor = {
    komersial: pendapatanSection.totalKomersial - biayaLangsungSection.totalKomersial,
    koreksi:   0,
    fiskal:    pendapatanSection.totalKomersial - biayaLangsungSection.totalKomersial,
  };

  const labaOperasional = {
    komersial: labaKotor.komersial - biayaOperasionalSection.totalKomersial,
    koreksi:   0,
    fiskal:    labaKotor.fiskal    - biayaOperasionalSection.totalFiskal,
  };

  const labaSetelahPajak = {
    komersial: labaOperasional.komersial - pphFinalSection.totalKomersial,
    koreksi:   0,
    fiskal:    labaOperasional.fiskal    - pphFinalSection.totalFiskal,
  };

  const labaBersih = {
    komersial: labaSetelahPajak.komersial + pendapatanBiayaLainSection.totalKomersial,
    koreksi:   0,
    fiskal:    labaSetelahPajak.fiskal    + pendapatanBiayaLainSection.totalFiskal,
  };

  // Entity name: use the caller-provided name if given, otherwise fall back to
  // the entityId string (callers that have the entity object should pass .name).
  const resolvedEntityName = entityName ?? (ids.length === 1 ? ids[0] : "Grup");

  return {
    entityId: ids[0],
    entityName: resolvedEntityName,
    year,
    pendapatan:           pendapatanSection,
    biayaLangsung:        biayaLangsungSection,
    labaKotor,
    biayaOperasional:     biayaOperasionalSection,
    labaOperasional,
    pphFinal:             pphFinalSection,
    labaSetelahPajak,
    pendapatanBiayaLain:  pendapatanBiayaLainSection,
    labaBersih,
  };
}
