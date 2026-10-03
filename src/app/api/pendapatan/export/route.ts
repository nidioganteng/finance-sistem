import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLaporanPendapatanData } from "@/lib/pendapatan";
import { generateLaporanPendapatanExcel } from "@/lib/pendapatan-excel";

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
  const masaPajakParam = searchParams.get("masaPajak");
  const masaPajak = masaPajakParam ? parseInt(masaPajakParam) : null;

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

  const entity = await prisma.entity.findUnique({
    where: { id: targetEntityId },
    select: { id: true, key: true, name: true },
  });

  if (!entity) {
    return new NextResponse("Entity not found", { status: 404 });
  }

  const { role, entityKeys } = session.user;
  const isPrivileged = role === "SUPER_ADMIN" || role === "MANAJER_KEUANGAN";
  if (!isPrivileged && !entityKeys.includes(entity.key)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const data = await getLaporanPendapatanData(targetEntityId, year, masaPajak);
    if (!data) {
      return new NextResponse("Data not found", { status: 404 });
    }

    const excelBuffer = await generateLaporanPendapatanExcel(data);

    const safeName = entity.name.replace(/[^a-zA-Z0-9_-]/g, "_");
    const monthSuffix = masaPajak ? `_Masa_${masaPajak}` : "_Tahunan";
    const filename = `Laporan_Pendapatan_${safeName}_${year}${monthSuffix}.xlsx`;

    return new NextResponse(excelBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": excelBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Export Laporan Pendapatan Excel error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
