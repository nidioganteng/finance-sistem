import { prisma } from "./prisma";

export async function getDokumenList(kategori?: string) {
  return prisma.dokumen.findMany({
    where:
      kategori && kategori !== "semua"
        ? { kategori: kategori as "SOP" | "DOKUMEN_PENDUKUNG" }
        : undefined,
    include: { uploadedBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
}
