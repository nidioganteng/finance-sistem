"use client";

import { PiutangClient } from "@/components/piutang/PiutangClient";
import type { ProjectItem, PiutangSummary } from "@/lib/piutang";

export function PiutangView({
  projectList,
  summary,
  userRole = "MANAJER_KEUANGAN",
  isGrup = false,
}: {
  projectList: ProjectItem[];
  summary: PiutangSummary;
  userRole?: string;
  isGrup?: boolean;
}) {
  return (
    <PiutangClient
      projectList={projectList}
      summary={summary}
      loadingDockList={[]}
      userRole={userRole}
      isUmumEntity={false}
      showTabs={false}
      isGrup={isGrup}
    />
  );
}
