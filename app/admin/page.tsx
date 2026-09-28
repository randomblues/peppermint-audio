import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { AdminConsole } from "@/components/admin-console";

export const dynamic = "force-dynamic";
export default async function AdminPage() {
  const session = await requireAdmin();
  if (!session) redirect("/admin/login");
  return <AdminConsole />;
}
