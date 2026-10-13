import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRekonsiliasiPajakGajiData } from "@/lib/rekonsiliasi-pajak-gaji";
import { generateRekonsiliasiPajakGajiExcel } from "@/lib/rekonsiliasi-pajak-gaji-excel";
import { logActivity } from "@/lib/actions/log";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const entityId = searchParams.get("entityId");
  const entityKey = searchParams.get("entityKey");
  const yearParam = searchParams.get("year");
  const year = parseInt(yearParam ?? "") || new Date().getFullYear();

  let targetIds: string[] = [];
  let displayName = "Semua_Entitas_Grup";

  if (entityKey === "grup") {
    const allEntities = await prisma.entity.findMany({
      where: session.user.role !== "SUPER_ADMIN" ? { key: { in: session.user.entityKeys } } : {},
      select: { id: true },
    });
    targetIds = allEntities.map((e) => e.id);
  } else if (entityId) {
    targetIds = [entityId];
    const ent = await prisma.entity.findUnique({ where: { id: entityId }, select: { name: true } });
    if (ent) displayName = ent.name.replace(/[^a-zA-Z0-9_-]/g, "_");
  } else if (entityKey) {
    const ent = await prisma.entity.findUnique({ where: { key: entityKey }, select: { id: true, name: true } });
    if (ent) {
      targetIds = [ent.id];
      displayName = ent.name.replace(/[^a-zA-Z0-9_-]/g, "_");
    }
  }

  if (targetIds.length === 0) {
    return new NextResponse("Entitas tidak ditemukan atau belum dipilih", { status: 400 });
  }

  try {
    const data = await getRekonsiliasiPajakGajiData(targetIds, year);
    const excelBuffer = await generateRekonsiliasiPajakGajiExcel(data);

    const filename = `Rekonsiliasi_Pajak_Gaji_PPh21_${displayName}_${year}.xlsx`;

    try {
      logActivity(
        session.user.id,
        `Ekspor Excel Rekonsiliasi Pajak Gaji & PPh 21 (${displayName} ${year})`,
        "USER_ACTIVITY",
        { year, entityCount: targetIds.length }
      );
    } catch {
      // ignore
    }

    return new NextResponse(excelBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Export Rekonsiliasi Pajak Gaji error:", error);
    return new NextResponse("Gagal menghasilkan file Excel", { status: 500 });
  }
}
