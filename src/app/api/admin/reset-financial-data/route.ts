import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [transactions, termin, loadingDock, notifikasi, activityLog] =
    await prisma.$transaction([
      prisma.transaction.deleteMany({}),
      prisma.termin.deleteMany({}),
      prisma.loadingDockTransaksi.deleteMany({}),
      prisma.notifikasi.deleteMany({}),
      prisma.activityLog.deleteMany({}),
    ]);

  return NextResponse.json({
    ok: true,
    deleted: {
      transactions: transactions.count,
      termin: termin.count,
      loadingDock: loadingDock.count,
      notifikasi: notifikasi.count,
      activityLog: activityLog.count,
    },
  });
}
