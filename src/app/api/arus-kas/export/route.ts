import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getArusKasPresisiData } from "@/lib/arus-kas-presisi";
import { generateArusKasExcel } from "@/lib/arus-kas-excel";
import type { ReportVersion } from "@/lib/laba-rugi";

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
  const versionParam = searchParams.get("version");
  const version: ReportVersion = versionParam?.toUpperCase() === "UMUM" ? "UMUM" : "INTERNAL";

  let targetEntityId = entityId;

  if (!targetEntityId && entityKey) {
    const ent = await prisma.entity.findUnique({
      where: { key: entityKey },
      select: { id: true, key: true },
    });
    if (ent) targetEntityId = ent.id;
  }

  if (!targetEntityId) {
    return new NextResponse("Entity ID is required", { status: 400 });
  }

  // Validasi otorisasi entitas
  const entity = await prisma.entity.findUnique({
    where: { id: targetEntityId },
    select: { id: true, key: true, name: true },
  });

  if (!entity) {
    return new NextResponse("Entity not found", { status: 404 });
  }

  const { role, entityKeys } = session.user;
  const isSuperAdmin = role === "SUPER_ADMIN";
  if (!isSuperAdmin && !entityKeys.includes(entity.key)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const data = await getArusKasPresisiData(targetEntityId, year, version);
    const excelBuffer = await generateArusKasExcel(data);

    const safeName = entity.name.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `Laporan_Arus_Kas_${safeName}_${year}.xlsx`;

    return new NextResponse(new Uint8Array(excelBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Gagal export laporan arus kas ke Excel:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
