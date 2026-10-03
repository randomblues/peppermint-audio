import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import RootLayout, { metadata } from "./layout";
import AdminLoginPage from "./admin/login/page";
import AdminPage from "./admin/page";
import { metadata as cartMetadata } from "./cart/page";
import { generateMetadata as generateEquipmentMetadata } from "./equipment/[slug]/page";
import { metadata as packagesMetadata } from "./packages/page";
import robots from "./robots";
import sitemap from "./sitemap";
import { business, equipmentCatalog } from "@/lib/site-content";

const { redirect, requireAdmin } = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  requireAdmin: vi.fn(),
}));

vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "geist-sans" }),
  Geist_Mono: () => ({ variable: "geist-mono" }),
}));

vi.mock("next/navigation", () => ({ redirect }));

vi.mock("@/lib/admin-auth", () => ({ requireAdmin }));

vi.mock("@/components/navbar", () => ({
  Navbar: () => <div data-testid="navbar">Navbar</div>,
}));

vi.mock("@/components/footer", () => ({
  Footer: () => <div data-testid="footer">Footer</div>,
}));

vi.mock("@/components/whatsapp-button", () => ({
  WhatsAppButton: () => <div data-testid="whatsapp">WhatsApp</div>,
}));

vi.mock("@/components/mobile-contact-bar", () => ({
  MobileContactBar: () => <div data-testid="mobile-contact-bar">Mobile contact bar</div>,
}));

vi.mock("@/components/admin-login", () => ({
  AdminLogin: () => <div data-testid="admin-login">Admin login</div>,
}));

vi.mock("@/components/admin-console", () => ({
  AdminConsole: () => <div data-testid="admin-console">Admin console</div>,
}));

describe("app wrappers and metadata", () => {
  it("exposes the root metadata contract", () => {
    expect(metadata.metadataBase?.toString()).toBe(`${business.website}/`);
    expect(metadata.title).toEqual({
      default: "Peppermint Audio | Audio Rental for Melbourne Events",
      template: "%s | Peppermint Audio",
    });
    expect(metadata.description).toContain("Complete audio system hire");
    expect(metadata.alternates?.canonical).toBe("/");
    expect(metadata.openGraph).toMatchObject({
      type: "website",
      locale: "en_AU",
      url: business.website,
      siteName: business.name,
    });
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      images: ["/hero-mixer.jpg"],
    });
  });

  it("uses route-specific canonical metadata and avoids indexing utility pages", async () => {
    expect(packagesMetadata.title).toBe("Packages");
    expect(packagesMetadata.alternates?.canonical).toBe("/packages");
    expect(cartMetadata.robots).toEqual({ index: false, follow: false });

    const equipmentMetadata = await generateEquipmentMetadata({
      params: Promise.resolve({ slug: equipmentCatalog[0].slug }),
    });
    expect(equipmentMetadata.title).toBe(`${equipmentCatalog[0].name} Hire`);
    expect(equipmentMetadata.alternates?.canonical).toBe(`/equipment/${equipmentCatalog[0].slug}`);
  });

  it("composes the root document around children and shared chrome", () => {
    render(
      <RootLayout>
        <div>Page content</div>
      </RootLayout>,
    );

    expect(document.documentElement).toHaveAttribute("lang", "en");
    expect(screen.getByText("Page content")).toBeInTheDocument();
    expect(screen.getByTestId("navbar")).toBeInTheDocument();
    expect(screen.getByTestId("footer")).toBeInTheDocument();
    expect(screen.getByTestId("whatsapp")).toBeInTheDocument();

    const structuredData = document.querySelector('script[type="application/ld+json"]');
    expect(structuredData).not.toBeNull();
    expect(JSON.parse(structuredData?.textContent ?? "")).toMatchObject({
      "@type": "LocalBusiness",
      name: business.name,
      url: business.website,
      telephone: business.phone,
      email: business.email,
    });
  });

  it("composes the admin login route with the login component", () => {
    render(<AdminLoginPage />);

    expect(screen.getByTestId("admin-login")).toBeInTheDocument();
  });

  it("redirects unauthenticated admin requests to login", async () => {
    requireAdmin.mockResolvedValueOnce(null);

    await expect(AdminPage()).rejects.toThrow("REDIRECT:/admin/login");
    expect(redirect).toHaveBeenCalledWith("/admin/login");
  });

  it("composes authenticated admin requests with the console", async () => {
    requireAdmin.mockResolvedValueOnce({ user: { id: "admin" }, admin: {} });

    render(await AdminPage());

    expect(screen.getByTestId("admin-console")).toBeInTheDocument();
  });

  it("returns the robots policy and canonical sitemap location", () => {
    expect(robots()).toEqual({
      rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/admin/"] },
      sitemap: `${business.website}/sitemap.xml`,
      host: business.website,
    });
  });

  it("returns public routes with the expected sitemap priorities", () => {
    const entries = sitemap();

    expect(entries.slice(0, 7)).toEqual([
      { url: business.website, changeFrequency: "weekly", priority: 1 },
      { url: `${business.website}/packages`, changeFrequency: "monthly", priority: 0.7 },
      { url: `${business.website}/equipment`, changeFrequency: "monthly", priority: 0.7 },
      { url: `${business.website}/how-it-works`, changeFrequency: "monthly", priority: 0.7 },
      { url: `${business.website}/faq`, changeFrequency: "monthly", priority: 0.7 },
      { url: `${business.website}/contact`, changeFrequency: "monthly", priority: 0.7 },
      { url: `${business.website}/booking`, changeFrequency: "monthly", priority: 0.7 },
    ]);
    expect(entries).toHaveLength(7 + equipmentCatalog.length);
    for (const item of equipmentCatalog) {
      expect(entries).toContainEqual({
        url: `${business.website}/equipment/${item.slug}`,
        changeFrequency: "monthly",
        priority: 0.6,
        ...(item.image ? { images: [`${business.website}${item.image}`] } : {}),
      });
    }
  });
});
