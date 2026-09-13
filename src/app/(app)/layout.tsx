import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Sidebar } from "@/components/layout/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen bg-surface-page">
      <Sidebar role={session.user.role} />
      <main className="flex-1 min-w-0 px-8 py-7 pb-16 flex flex-col gap-5">{children}</main>
    </div>
  );
}
