import { KasScreen } from "@/components/kas/KasScreen";
import { PageTransition } from "@/components/layout/PageTransition";

export default function KasBesarPage({ searchParams }: { searchParams: { entity?: string } }) {
  return (
    <PageTransition>
      <KasScreen
        jenisInputKey="kasBesar"
        title="Kas Besar"
        subtitle="Input dan riwayat transaksi kas besar"
        pagePath="/kas-besar"
        searchParams={searchParams}
      />
    </PageTransition>
  );
}
