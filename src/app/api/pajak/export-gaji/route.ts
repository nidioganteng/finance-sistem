import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { phpFetch, getPhpToken } from "@/lib/api-client";
import { getRekonsiliasiPajakGajiData } from "@/lib/rekonsiliasi-pajak-gaji";
import { generateRekonsiliasiPajakGajiExcel } from "@/lib/rekonsiliasi-pajak-gaji-excel";
import { logActivity } from "@/lib/actions/log";

type EntityListItem = { id: string; key: string; name: string };

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

  try {
    const token = await getPhpToken();

    if (entityKey === "grup") {
      const entities = await phpFetch<EntityListItem[]>("/api/entities", token);
      const accessible =
        session.user.role !== "SUPER_ADMIN"
          ? entities.filter((e) => session.user.entityKeys.includes(e.key))
          : entities;
      targetIds = accessible.map((e) => e.id);
    } else if (entityId) {
      targetIds = [entityId];
      const entities = await phpFetch<EntityListItem[]>("/api/entities", token);
      const ent = entities.find((e) => e.id === entityId);
      if (ent) displayName = ent.name.replace(/[^a-zA-Z0-9_-]/g, "_");
    } else if (entityKey) {
      const entities = await phpFetch<EntityListItem[]>("/api/entities", token);
      const ent = entities.find((e) => e.key === entityKey);
      if (ent) {
        targetIds = [ent.id];
        displayName = ent.name.replace(/[^a-zA-Z0-9_-]/g, "_");
      }
    }

    if (targetIds.length === 0) {
      return new NextResponse("Entitas tidak ditemukan atau belum dipilih", { status: 400 });
    }

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
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Export Rekonsiliasi Pajak Gaji error:", error);
    return new NextResponse("Gagal menghasilkan file Excel", { status: 500 });
  }
}
