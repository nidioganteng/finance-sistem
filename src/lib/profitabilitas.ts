import { phpFetch, getPhpToken } from "./api-client";

// ── Shape returned by the PHP backend ────────────────────────────────────────
type PhpProfitabilitasProject = {
  id: string;
  code: string;
  name: string;
  contractValue: number;
  spend: number;
  profit: number;
  marginPersen: number;
  status: string;
  deadline: string | null;
  createdAt: string;
  maxTerminPct: number | null;
  terminCount: number;
};

type PhpProfitabilitasResponse = {
  entityId: string;
  year: number | null;
  projects: PhpProfitabilitasProject[];
  summary: {
    totalProyek: number;
    countByStatus: { ACTIVE: number; COMPLETED: number; CANCELLED: number };
    totalContract: number;
    totalSpend: number;
    totalProfit: number;
    avgMarginPersen: number;
  };
};

// ── Shape consumed by the frontend ───────────────────────────────────────────
export type ProfitabilitasProject = {
  code: string;
  name: string;
  kontrakFmt: string;
  terpakaiiFmt: string;
  laba: number;
  labaFmt: string;
  labaPositive: boolean;
  margin: string;
  terminStatus: string | null;
  terminPct: number | null;
};

export type ProfitabilitasData = {
  projects: ProfitabilitasProject[];
  summary: {
    totalKontrakFmt: string;
    totalTerpakaiiFmt: string;
    totalLaba: number;
    totalLabaFmt: string;
    totalLabaPositive: boolean;
    avgMargin: string;
    projectCount: number;
  };
};

function fmtRupiah(n: number): string {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

export async function getProfitabilitasData(entityId: string, year?: number): Promise<ProfitabilitasData> {
  const token = await getPhpToken();
  const params = new URLSearchParams();
  params.set("entityId", entityId);
  if (year) params.set("year", String(year));

  const raw = await phpFetch<PhpProfitabilitasResponse>(
    `/api/profitabilitas?${params.toString()}`,
    token
  );

  // Transform each project row to the shape the page expects
  const projects: ProfitabilitasProject[] = raw.projects.map((p) => {
    const labaPositive = p.profit >= 0;
    return {
      code:         p.code,
      name:         p.name,
      kontrakFmt:   fmtRupiah(p.contractValue),
      terpakaiiFmt: fmtRupiah(p.spend),
      laba:         p.profit,
      labaFmt:      fmtRupiah(Math.abs(p.profit)),
      labaPositive,
      margin:       String(p.marginPersen),
      // PHP doesn't return a termin status string; expose the percentage only.
      // terminStatus is used for an ON_TRACK/AT_RISK/NEEDS_AUDIT badge — PHP
      // doesn't aggregate that per-project, so leave it null here.
      terminStatus: null,
      terminPct:    p.maxTerminPct,
    };
  });

  const { summary: s } = raw;
  const totalLabaPositive = s.totalProfit >= 0;

  return {
    projects,
    summary: {
      totalKontrakFmt:   fmtRupiah(s.totalContract),
      totalTerpakaiiFmt: fmtRupiah(s.totalSpend),
      totalLaba:         s.totalProfit,
      totalLabaFmt:      fmtRupiah(Math.abs(s.totalProfit)),
      totalLabaPositive,
      avgMargin:         String(s.avgMarginPersen),
      projectCount:      s.totalProyek,
    },
  };
}
