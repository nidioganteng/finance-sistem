import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { phpFetch, getPhpToken } from "@/lib/api-client";
import { getLaporanPajakData } from "@/lib/pajak";
import { generateLaporanPajakExcel } from "@/lib/pajak-excel";

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
  const version = versionParam?.toUpperCase() === "UMUM" ? "UMUM" : "INTERNAL";

  const token = await getPhpToken().catch(() => null);
  if (!token) return new NextResponse("Unauthorized", { status: 401 });

  let targetEntityId = entityId;

  if (!targetEntityId && entityKey) {
    try {
      const ent = await phpFetch<{ id: string; key: string }>(`/api/entities?key=${encodeURIComponent(entityKey)}`, token);
      if (ent?.id) targetEntityId = ent.id;
    } catch { /* entity not found */ }
  }

  if (!targetEntityId) {
    return new NextResponse("Entity ID is required", { status: 400 });
  }

  let entity: { id: string; key: string; name: string } | null = null;
  try {
    const all = await phpFetch<{ id: string; key: string; name: string }[]>("/api/entities", token);
    entity = (Array.isArray(all) ? all : []).find((e) => e.id === targetEntityId) ?? null;
  } catch { /* ignore */ }

  if (!entity) {
    return new NextResponse("Entity not found", { status: 404 });
  }

  const { role, entityKeys } = session.user;
  const isPrivileged = role === "SUPER_ADMIN" || role === "MANAJER_KEUANGAN";
  if (!isPrivileged && !entityKeys.includes(entity.key)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const data = await getLaporanPajakData(targetEntityId, year, version);
    const excelBuffer = await generateLaporanPajakExcel(data, version);

    const safeName = entity.name.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `Laporan_Laba_Rugi_${safeName}_${year}_${version.toLowerCase()}.xlsx`;

    const versionLabel = version === "UMUM" ? "Umum" : "Internal";
    phpFetch("/api/log", token, {
      method: "POST",
      body: JSON.stringify({
        actorId: session.user.id,
        action: `Export Excel Laporan Laba Rugi (${versionLabel}) – ${entity.name} (${year})`,
        category: "USER_ACTIVITY",
        detail: { format: "Excel", jenis: "Laba Rugi", version: versionLabel, entitas: entity.name, entityKey: entity.key, year },
      }),
    }).catch(() => {});

    return new NextResponse(new Uint8Array(excelBuffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error generating tax excel:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
