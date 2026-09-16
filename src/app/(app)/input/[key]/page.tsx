import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getJenisInput } from "@/lib/kas";
import { KasScreen } from "@/components/kas/KasScreen";

const SYSTEM_KEYS = ["kasKecil", "kasBesar", "bankBuku"];

export default async function CustomInputPage({
  params,
  searchParams,
}: {
  params: { key: string };
  searchParams: { entity?: string; rekening?: string };
}) {
  const session = await getServerSession(authOptions);
  const { role } = session!.user;

  if (role !== "STAF_KEUANGAN") redirect("/dashboard");

  const jenisInput = await getJenisInput(params.key);
  if (!jenisInput || !jenisInput.active || SYSTEM_KEYS.includes(params.key)) {
    redirect("/dashboard");
  }

  const LAPORAN_LABEL: Record<string, string> = {
    JURNAL_UMUM: "Jurnal Umum",
    BUKU_BESAR: "Buku Besar",
    LAPORAN_KEUANGAN: "Laporan Keuangan",
    PIUTANG: "Piutang",
    PAJAK: "Laporan Pajak",
  };

  const extra = jenisInput.extraFieldsJson as Record<string, unknown> | null;
  const arahLaporan = Array.isArray(extra?.arahLaporan) ? (extra.arahLaporan as string[]) : [];
  const subtitle =
    arahLaporan.length > 0
      ? `Dicatat ke: ${arahLaporan.map((k) => LAPORAN_LABEL[k] ?? k).join(", ")}`
      : "Input dan riwayat transaksi";

  return (
    <KasScreen
      jenisInputKey={params.key}
      title={jenisInput.nama}
      subtitle={subtitle}
      pagePath={`/input/${params.key}`}
      searchParams={searchParams}
    />
  );
}
