"use server";

import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function approveUser(userId: string, role: string, entityIds: string[]) {
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
  revalidatePath("/pengguna");
}

export async function rejectUser(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { status: "INACTIVE" } });
  revalidatePath("/pengguna");
}

export async function updateUserEntities(userId: string, entityIds: string[]) {
  await prisma.userEntityAccess.deleteMany({ where: { userId } });
  if (entityIds.length > 0) {
    await prisma.userEntityAccess.createMany({
      data: entityIds.map((entityId) => ({ userId, entityId })),
    });
  }
  revalidatePath("/pengguna");
}

export async function deactivateUser(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { status: "INACTIVE" } });
  revalidatePath("/pengguna");
}

export async function activateUser(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { status: "ACTIVE" } });
  revalidatePath("/pengguna");
}
