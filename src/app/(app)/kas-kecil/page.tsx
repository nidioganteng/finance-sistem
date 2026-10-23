"use client";

import { Suspense } from "react";
import { KasScreen } from "@/components/kas/KasScreen";
import { PageTransition } from "@/components/layout/PageTransition";

function KasKecilContent() {
  return (
    <PageTransition>
      <KasScreen
        jenisInputKey="kasKecil"
        title="Kas Kecil"
        subtitle="Input dan riwayat transaksi kas kecil"
        pagePath="/kas-kecil"
      />
    </PageTransition>
  );
}

export default function KasKecilPage() {
  return (
    <Suspense fallback={<div className="mt-8 p-6 text-sm text-muted animate-pulse">Memuat data…</div>}>
      <KasKecilContent />
    </Suspense>
  );
}
