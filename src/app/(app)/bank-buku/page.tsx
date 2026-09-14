import { KasScreen } from "@/components/kas/KasScreen";

export default function BankBukuPage({ searchParams }: { searchParams: { entity?: string; rekening?: string } }) {
  return (
    <KasScreen
      jenisInputKey="bankBuku"
      title="Bank Buku"
      subtitle="Input dan riwayat transaksi rekening bank"
      pagePath="/bank-buku"
      searchParams={searchParams}
    />
  );
}
