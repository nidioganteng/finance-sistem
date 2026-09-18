import { KasScreen } from "@/components/kas/KasScreen";
import { PageTransition } from "@/components/layout/PageTransition";

export default function BankBukuPage({ searchParams }: { searchParams: { entity?: string; rekening?: string } }) {
  return (
    <PageTransition>
      <KasScreen
        jenisInputKey="bankBuku"
        title="Bank Buku"
        subtitle="Input dan riwayat transaksi rekening bank"
        pagePath="/bank-buku"
        searchParams={searchParams}
      />
    </PageTransition>
  );
}
