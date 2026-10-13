import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { resolveEntityKey } from "@/lib/entity-prefs";

export default async function PajakPage({
  searchParams,
}: {
  searchParams: { entity?: string; year?: string; tab?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const { entityKeys } = session.user;
  const selectedKey = resolveEntityKey(searchParams.entity, entityKeys);
  const year = parseInt(searchParams.year ?? "") || new Date().getFullYear();

  const params = new URLSearchParams();
  if (selectedKey) params.set("entity", selectedKey);
  if (year) params.set("year", year.toString());
  params.set("tab", "rekonsiliasi");

  redirect(`/payroll?${params.toString()}`);
}
