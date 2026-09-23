import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getAccessibleEntities } from "@/lib/dashboard-data";
import { getLaporanPajakData } from "@/lib/pajak";
import { resolveEntityKey } from "@/lib/entity-prefs";
import { PageHeader } from "@/components/layout/PageHeader";
import { EntitySwitcher } from "@/components/layout/EntitySwitcher";
import { YearSelect } from "@/components/shared/YearSelect";
import { logActivity } from "@/lib/actions/log";
import { PageTransition } from "@/components/layout/PageTransition";
import { LaporanPajakClient } from "@/components/pajak/LaporanPajakClient";

export default async function PajakPage({
  searchParams,
}: {
  searchParams: { entity?: string; year?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const { role, entityKeys } = session.user;
  logActivity(session.user.id, "Buka halaman Laporan Pajak", "USER_ACTIVITY", { path: "/pajak" });
  if (role !== "MANAJER_KEUANGAN" && role !== "SUPER_ADMIN" && role !== "STAF_KEUANGAN") redirect("/dashboard");

  const entities = await getAccessibleEntities(entityKeys);
  const selectedKey = resolveEntityKey(searchParams.entity, entityKeys);
  const selectedEntity = entities.find((e) => e.key === selectedKey);
  const currentYear = parseInt(searchParams.year ?? "") || new Date().getFullYear();

  if (!selectedEntity) {
    return <p className="text-sm text-muted">Kamu belum punya akses ke entitas manapun.</p>;
  }

  const taxData = await getLaporanPajakData(selectedEntity.id, currentYear);

  return (
    <PageTransition>
      <PageHeader
        title="Rekonsiliasi Laporan Pajak"
        subtitle={`Laba Rugi Komersial vs Fiskal — ${selectedEntity.name} ${currentYear}`}
        rightSlot={
          <>
            <YearSelect currentYear={currentYear} />
            <EntitySwitcher
              entities={entities.map((e) => ({ key: e.key, name: e.name }))}
              showGrupOption={false}
              currentEntityKey={selectedKey}
            />
          </>
        }
      />

      <div className="px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 text-[13px] text-amber-800 dark:text-amber-300">
        <strong>Ketentuan Perpajakan:</strong> Kolom <strong>Komersial</strong> mencerminkan pembukuan riil manajemen (versi internal), sedangkan kolom <strong>Fiskal</strong> adalah rekonsiliasi laporan keuangan untuk pelaporan pajak resmi (versi umum). Selisih antara keduanya dicatat pada kolom <strong>Koreksi Fiskal</strong> sesuai ketentuan peraturan perundang-undangan perpajakan DJP.
      </div>

      <LaporanPajakClient data={taxData} entityKey={selectedKey} />
    </PageTransition>
  );
}
