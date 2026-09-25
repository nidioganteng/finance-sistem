import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Ambil semua COA, group by code — simpan yang urutan-nya terkecil (pertama), hapus sisanya
  const all = await prisma.coaAccount.findMany({ orderBy: { urutan: "asc" } });

  const seen = new Map<string, string>(); // code -> id yang dipertahankan
  const toDelete: string[] = [];

  for (const coa of all) {
    if (seen.has(coa.code)) {
      toDelete.push(coa.id);
    } else {
      seen.set(coa.code, coa.id);
    }
  }

  if (toDelete.length === 0) {
    return NextResponse.json({ ok: true, deleted: 0, message: "Tidak ada duplikat." });
  }

  // Pindahkan transaksi yang referensi ke id duplikat ke id yang dipertahankan
  for (const dupId of toDelete) {
    const dup = all.find((c) => c.id === dupId)!;
    const keepId = seen.get(dup.code)!;
    await prisma.transaction.updateMany({
      where: { coaAccountId: dupId },
      data: { coaAccountId: keepId },
    });
  }

  const { count } = await prisma.coaAccount.deleteMany({ where: { id: { in: toDelete } } });

  return NextResponse.json({ ok: true, deleted: count, message: `${count} duplikat dihapus.` });
}
