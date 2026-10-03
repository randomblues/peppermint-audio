import { AdminLogin } from "@/components/admin-login";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Admin Login",
  description: "Peppermint Audio administration.",
  path: "/admin/login",
  robots: {
    index: false,
    follow: false,
  },
});

export default function AdminLoginPage() { return <AdminLogin />; }
