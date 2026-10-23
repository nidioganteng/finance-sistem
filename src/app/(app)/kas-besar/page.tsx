"use client";

import { Suspense } from "react";
import { KasScreen } from "@/components/kas/KasScreen";
import { PageTransition } from "@/components/layout/PageTransition";

function KasBesarContent() {
  return (
    <PageTransition>
      <KasScreen
        jenisInputKey="kasBesar"
        title="Kas Besar"
        subtitle="Input dan riwayat transaksi kas besar"
        pagePath="/kas-besar"
      />
    </PageTransition>
  );
}

export default function KasBesarPage() {
  return (
    <Suspense fallback={<div className="mt-8 p-6 text-sm text-muted animate-pulse">Memuat data…</div>}>
      <KasBesarContent />
    </Suspense>
  );
}
