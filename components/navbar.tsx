"use client";

import Link from "next/link";
import Image from "next/image";
import { ChevronRight, MenuIcon, Package2, Speaker, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import {
  SheetClose,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { business } from "@/lib/site-content";
import { CartButton } from "@/components/cart-button";

const navLinks = [
  { href: "/how-it-works", label: "How It Works" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

export function Navbar() {
  const pathname = usePathname();
  const [productsMenu, setProductsMenu] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (pathname.startsWith("/admin")) {
    return null;
  }

  return (
    <header className="site-navbar sticky top-0 z-50 border-b bg-background bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" aria-label={business.name}>
          <Image
            src="/logo-white.png"
            alt={business.name}
            width={266}
            height={51}
            className="h-auto w-44"
            loading="eager"
          />
        </Link>
        <NavigationMenu
          key={pathname}
          value={productsMenu}
          onValueChange={setProductsMenu}
          className="hidden md:flex"
        >
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuTrigger>Products</NavigationMenuTrigger>
              <NavigationMenuContent>
                <div className="grid w-64 gap-1 p-2">
                  <NavigationMenuLink
                    render={<Link href="/packages" />}
                    onClick={() => setProductsMenu(null)}
                  >
                    <span>
                      <span className="block font-medium">Packages</span>
                      <span className="block text-xs text-muted-foreground">
                        Complete ready-to-use systems
                      </span>
                    </span>
                  </NavigationMenuLink>
                  <NavigationMenuLink
                    render={<Link href="/equipment" />}
                    onClick={() => setProductsMenu(null)}
                  >
                    <span>
                      <span className="block font-medium">Individual items</span>
                      <span className="block text-xs text-muted-foreground">
                        Hire only what you need
                      </span>
                    </span>
                  </NavigationMenuLink>
                </div>
              </NavigationMenuContent>
            </NavigationMenuItem>
            {navLinks.map((link) => (
              <NavigationMenuItem key={link.href}>
                <NavigationMenuLink
                  render={<Link href={link.href} />}
                  className="px-3 py-2"
                >
                  {link.label}
                </NavigationMenuLink>
              </NavigationMenuItem>
            ))}
          </NavigationMenuList>
        </NavigationMenu>
        <div className="flex items-center gap-2">
          <div className="ml-2 border-l border-border/70 pl-4">
            <CartButton />
          </div>

          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="outline"
                  size="icon-sm"
                  className="md:hidden"
                  aria-label="Open menu"
                />
              }
            >
              <MenuIcon />
            </SheetTrigger>
            <SheetContent
              side="right"
              showCloseButton={false}
              className="w-[320px] border-l border-primary/25 bg-[radial-gradient(circle_at_top,_color-mix(in_oklab,var(--primary)_20%,transparent),transparent_48%),linear-gradient(180deg,_color-mix(in_oklab,var(--background)_86%,black),color-mix(in_oklab,var(--background)_95%,black))] p-0 shadow-[0_24px_70px_rgb(0_0_0/0.5)] backdrop-blur-xl"
            >
              <SheetHeader className="border-b border-border/70 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-h-7 min-w-0 items-center">
                    <SheetTitle className="sr-only">{business.name}</SheetTitle>
                    <Image
                      src="/logo-white-trimmed.png"
                      alt={business.name}
                      width={472}
                      height={46}
                      className="h-auto w-[156px] max-w-full"
                    />
                  </div>
                  <SheetClose
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="rounded-full border border-border/70 bg-background/60 text-muted-foreground hover:border-primary/30 hover:bg-primary/10 hover:text-foreground"
                        aria-label="Close"
                      />
                    }
                  >
                    <X className="size-4" aria-hidden="true" />
                  </SheetClose>
                </div>
                <SheetDescription className="mt-1">Audio system hire in Melbourne</SheetDescription>
              </SheetHeader>
              <div className="grid gap-2 p-4">
                <p className="px-2 pb-1 text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                  Products
                </p>
                <Button
                  variant="ghost"
                  className="group h-auto justify-start rounded-xl border border-border/60 bg-background/35 px-3 py-2.5 hover:border-primary/35 hover:bg-primary/10"
                  nativeButton={false}
                  render={<Link href="/packages" />}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span className="inline-flex items-center gap-2.5">
                    <span className="inline-flex size-7 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
                      <Package2 className="size-3.5" aria-hidden="true" />
                    </span>
                    <span className="flex flex-col items-start">
                      <span className="font-medium">Packages</span>
                      <span className="text-xs text-muted-foreground">Ready-to-go systems</span>
                    </span>
                    <ChevronRight className="ml-2 size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
                  </span>
                </Button>
                <Button
                  variant="ghost"
                  className="group h-auto justify-start rounded-xl border border-border/60 bg-background/35 px-3 py-2.5 hover:border-primary/35 hover:bg-primary/10"
                  nativeButton={false}
                  render={<Link href="/equipment" />}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span className="inline-flex items-center gap-2.5">
                    <span className="inline-flex size-7 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
                      <Speaker className="size-3.5" aria-hidden="true" />
                    </span>
                    <span className="flex flex-col items-start">
                      <span className="font-medium">Individual items</span>
                      <span className="text-xs text-muted-foreground">Mix and match gear</span>
                    </span>
                    <ChevronRight className="ml-2 size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
                  </span>
                </Button>
              </div>
              <div className="grid gap-1 border-t border-border/70 px-4 pb-4 pt-3">
                {navLinks.map((link) => (
                  <Button
                    key={link.href}
                    variant="ghost"
                    className={`justify-start rounded-lg px-2.5 ${pathname === link.href ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                    nativeButton={false}
                    render={<Link href={link.href} />}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.label}
                  </Button>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
