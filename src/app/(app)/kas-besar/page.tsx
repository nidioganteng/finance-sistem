import { KasScreen } from "@/components/kas/KasScreen";

export default function KasBesarPage({ searchParams }: { searchParams: { entity?: string } }) {
  return (
    <KasScreen
      jenisInputKey="kasBesar"
      title="Kas Besar"
      subtitle="Input dan riwayat transaksi kas besar"
      pagePath="/kas-besar"
      searchParams={searchParams}
      excludeEntityKeys={["umum"]}
    />
  );
}
