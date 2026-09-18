"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/actions/log";

export async function approveUser(userId: string, role: string, entityIds: string[]) {
  const session = await getServerSession(authOptions);
  if (role === "SUPER_ADMIN" && session?.user.role !== "SUPER_ADMIN") throw new Error("Tidak bisa assign role Super Admin.");
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true, role: true } });
  if (target?.role === "SUPER_ADMIN" && session?.user.role !== "SUPER_ADMIN") throw new Error("Tidak bisa mengubah akun Super Admin.");
  await prisma.user.update({
    where: { id: userId },
    data: { role: role as Role, status: "ACTIVE" },
  });
  await prisma.userEntityAccess.deleteMany({ where: { userId } });
  if (entityIds.length > 0) {
    await prisma.userEntityAccess.createMany({
      data: entityIds.map((entityId) => ({ userId, entityId })),
    });
  }
  if (session?.user.id) {
    logActivity(session.user.id, `Approve pengguna ${target?.name ?? userId} sebagai ${role}`, "USER_ACTIVITY", { userId, role, entityIds });
  }
  revalidatePath("/pengguna");
}

export async function rejectUser(userId: string) {
  const session = await getServerSession(authOptions);
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, role: true } });
  if (target?.role === "SUPER_ADMIN" && session?.user.role !== "SUPER_ADMIN") throw new Error("Tidak bisa mengubah akun Super Admin.");
  await prisma.user.update({ where: { id: userId }, data: { status: "INACTIVE" } });
  if (session?.user.id) {
    logActivity(session.user.id, `Tolak pendaftaran pengguna ${target?.name ?? userId}`, "USER_ACTIVITY", { userId });
  }
  revalidatePath("/pengguna");
}

export async function updateUserEntities(userId: string, entityIds: string[]) {
  const session = await getServerSession(authOptions);
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, role: true } });
  if (target?.role === "SUPER_ADMIN" && session?.user.role !== "SUPER_ADMIN") throw new Error("Tidak bisa mengubah akun Super Admin.");
  await prisma.userEntityAccess.deleteMany({ where: { userId } });
  if (entityIds.length > 0) {
    await prisma.userEntityAccess.createMany({
      data: entityIds.map((entityId) => ({ userId, entityId })),
    });
  }
  if (session?.user.id) {
    logActivity(session.user.id, `Update akses entitas pengguna ${target?.name ?? userId}`, "USER_ACTIVITY", { userId, entityIds });
  }
  revalidatePath("/pengguna");
}

export async function deactivateUser(userId: string) {
  const session = await getServerSession(authOptions);
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, role: true } });
  if (target?.role === "SUPER_ADMIN" && session?.user.role !== "SUPER_ADMIN") throw new Error("Tidak bisa mengubah akun Super Admin.");
  await prisma.user.update({ where: { id: userId }, data: { status: "INACTIVE" } });
  if (session?.user.id) {
    logActivity(session.user.id, `Nonaktifkan pengguna ${target?.name ?? userId}`, "USER_ACTIVITY", { userId });
  }
  revalidatePath("/pengguna");
}

export async function activateUser(userId: string) {
  const session = await getServerSession(authOptions);
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, role: true } });
  if (target?.role === "SUPER_ADMIN" && session?.user.role !== "SUPER_ADMIN") throw new Error("Tidak bisa mengubah akun Super Admin.");
  await prisma.user.update({ where: { id: userId }, data: { status: "ACTIVE" } });
  if (session?.user.id) {
    logActivity(session.user.id, `Aktifkan kembali pengguna ${target?.name ?? userId}`, "USER_ACTIVITY", { userId });
  }
  revalidatePath("/pengguna");
}
