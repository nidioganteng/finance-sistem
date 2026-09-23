import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageTransition } from "@/components/layout/PageTransition";
import { Landmark } from "lucide-react";
import Link from "next/link";

export default async function PajakPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  return (
    <PageTransition>
      <PageHeader
        title="Laporan Pajak"
        subtitle="Modul pelaporan pajak entitas dan rekapitulasi perpajakan"
      />

      <div className="bg-surface-card rounded-[22px] border border-border-soft p-12 text-center max-w-xl mx-auto my-12 shadow-xs">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4 border border-amber-200 dark:border-amber-500/20">
          <Landmark size={32} />
        </div>
        <h3 className="text-lg font-bold text-navy-text mb-2">
          Format Laporan Pajak Sedang Disesuaikan
        </h3>
        <p className="text-sm text-muted leading-relaxed mb-6">
          Format Rekonsiliasi Laba Rugi Komersial & Fiskal telah dipindahkan ke menu <strong>Laporan Keuangan (Versi Umum)</strong>. Halaman ini dipersiapkan untuk format laporan perpajakan resmi berikutnya.
        </p>
        <Link
          href="/laporan?version=umum"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-navy hover:bg-navy/90 transition-all shadow-sm"
        >
          Buka Laporan Keuangan (Versi Umum)
        </Link>
      </div>
    </PageTransition>
  );
}
