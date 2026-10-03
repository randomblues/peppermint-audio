import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/admin-auth";
import { AdminConsole } from "@/components/admin-console";
import { createPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata = createPageMetadata({
  title: "Admin",
  description: "Peppermint Audio administration.",
  path: "/admin",
  robots: {
    index: false,
    follow: false,
  },
});

export default async function AdminPage() {
  const session = await requireAdmin();
  if (!session) redirect("/admin/login");
  return <AdminConsole />;
}
