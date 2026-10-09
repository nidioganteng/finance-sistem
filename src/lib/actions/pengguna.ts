"use server";

import { phpFetch, getPhpToken, ApiError } from "@/lib/api-client";

export async function approveUser(userId: string, role: string, entityIds: string[]) {
  const token = await getPhpToken();
  try {
    await phpFetch("/api/pengguna/approve", token, {
      method: "POST",
      body: JSON.stringify({ userId, role, entityIds }),
    });
  } catch (e) {
    if (e instanceof ApiError) throw new Error(e.message);
    throw e;
  }
}

export async function rejectUser(userId: string) {
  const token = await getPhpToken();
  try {
    await phpFetch("/api/pengguna/reject", token, {
      method: "POST",
      body: JSON.stringify({ userId }),
    });
  } catch (e) {
    if (e instanceof ApiError) throw new Error(e.message);
    throw e;
  }
}

export async function updateUserEntities(userId: string, entityIds: string[]) {
  const token = await getPhpToken();
  try {
    await phpFetch("/api/pengguna/entities", token, {
      method: "POST",
      body: JSON.stringify({ userId, entityIds }),
    });
  } catch (e) {
    if (e instanceof ApiError) throw new Error(e.message);
    throw e;
  }
}

export async function deactivateUser(userId: string) {
  const token = await getPhpToken();
  try {
    await phpFetch("/api/pengguna/deactivate", token, {
      method: "POST",
      body: JSON.stringify({ userId }),
    });
  } catch (e) {
    if (e instanceof ApiError) throw new Error(e.message);
    throw e;
  }
}

export async function activateUser(userId: string) {
  const token = await getPhpToken();
  try {
    await phpFetch("/api/pengguna/activate", token, {
      method: "POST",
      body: JSON.stringify({ userId }),
    });
  } catch (e) {
    if (e instanceof ApiError) throw new Error(e.message);
    throw e;
  }
}
