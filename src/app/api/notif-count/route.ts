import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPhpToken } from "@/lib/api-client";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ count: 0 });
  }

  try {
    const token = await getPhpToken();
    const phpApiUrl = process.env.PHP_API_URL ?? "";
    const res = await fetch(`${phpApiUrl}/api/notifikasi/count`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return NextResponse.json({ count: 0 });
    const data = await res.json();
    return NextResponse.json({ count: data.count ?? 0 });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
