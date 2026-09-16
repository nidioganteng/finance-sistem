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

  const extra = jenisInput.extraFieldsJson as Record<string, unknown> | null;
  const subtitle =
    Array.isArray(extra?.arahLaporan) && (extra.arahLaporan as string[]).length > 0
      ? `Dicatat ke: ${(extra.arahLaporan as string[]).join(", ")}`
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
