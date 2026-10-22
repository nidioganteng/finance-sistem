import { getPhpToken, phpFetch } from "@/lib/api-client";

export const TRANSITORY_CATEGORIES = { GAJI_HOLD: "Gaji di-hold", MARKETING: "Biaya marketing", UANG_MUKA_PROYEK: "Uang muka proyek", OPERASIONAL_TERTUNDA: "Operasional tertunda" } as const;
export type TransitoryEvent = { id: string; kind: "RELEASE" | "REVERSAL"; amount: number; eventDate: string; receipt: string; note: string; reversalNoBukti: string | null; accountingNoBukti?: string | null; actorId: string; createdAt: string };
export type TransitoryItem = {
  id: string; entityId: string; sourceTransactionId: string; sourceNoBukti: string; sourceDate: string; projectId: string | null; projectCode: string | null; projectName: string | null;
  category: keyof typeof TRANSITORY_CATEGORIES; recipient: string; amount: number; location: string; reason: string; targetDate: string; payrollType: string | null; payrollId: string | null;
  revision: number; createdAt: string; released: number; reversed: number; remaining: number; status: "HELD" | "OVERDUE" | "RELEASED" | "REVERSED"; balanced: boolean; balanceIssue: string; events: TransitoryEvent[];
};
export type TransitoryData = {
  today: string;
  items: TransitoryItem[];
  sources: { id: string; noBukti: string; date: string; description: string; amount: number; available: number; projectCode: string | null; projectName: string | null }[];
  payroll: { id: string; type: "HONOR" | "PEGAWAI"; name: string; month: number; year: number; amount: number }[];
  summary: { held: number; released: number; reversed: number; overdue: number; unbalanced: number; ledgerHeld?: number; ledgerBalanced?: boolean };
};
export function getKasTransitory(entityId: string): Promise<TransitoryData> {
  return getPhpToken().then(token => phpFetch<TransitoryData>(`/api/kas-transitory?entityId=${encodeURIComponent(entityId)}`, token, { cache: "no-store" }));
}
