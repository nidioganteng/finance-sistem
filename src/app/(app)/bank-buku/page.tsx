"use client";

import { Suspense } from "react";
import { KasScreen } from "@/components/kas/KasScreen";
import { PageTransition } from "@/components/layout/PageTransition";

function BankBukuContent() {
  return (
    <PageTransition>
      <KasScreen
        jenisInputKey="bankBuku"
        title="Buku Bank"
        subtitle="Input dan riwayat transaksi rekening bank"
        pagePath="/bank-buku"
      />
    </PageTransition>
  );
}

export default function BankBukuPage() {
  return (
    <Suspense fallback={<div className="mt-8 p-6 text-sm text-muted animate-pulse">Memuat data…</div>}>
      <BankBukuContent />
    </Suspense>
  );
}
