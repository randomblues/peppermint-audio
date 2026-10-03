import Link from "next/link";
import Image from "next/image";
import { MenuIcon } from "lucide-react";

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
  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" aria-label={business.name}>
          <Image
            src="/logo-white.png"
            alt={business.name}
            width={266}
            height={51}
            className="h-auto w-44"
            priority
          />
        </Link>
        <NavigationMenu className="hidden md:flex">
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuTrigger>Products</NavigationMenuTrigger>
              <NavigationMenuContent>
                <div className="grid w-64 gap-1 p-2">
                  <NavigationMenuLink render={<Link href="/packages" />}>
                    <span>
                      <span className="block font-medium">Packages</span>
                      <span className="block text-xs text-muted-foreground">
                        Complete ready-to-use systems
                      </span>
                    </span>
                  </NavigationMenuLink>
                  <NavigationMenuLink render={<Link href="/equipment" />}>
                    <span>
                      <span className="block font-medium">Individual equipment</span>
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

          <Sheet>
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
            <SheetContent side="right" className="w-[300px] p-0">
              <SheetHeader className="border-b p-5">
                <SheetTitle>{business.name}</SheetTitle>
                <SheetDescription>Audio system hire in Melbourne</SheetDescription>
              </SheetHeader>
              <div className="grid gap-1 p-4">
                <p className="px-3 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Products
                </p>
                <Button
                  variant="ghost"
                  className="justify-start"
                  nativeButton={false}
                  render={<Link href="/packages" />}
                >
                  Packages
                </Button>
                <Button
                  variant="ghost"
                  className="justify-start"
                  nativeButton={false}
                  render={<Link href="/equipment" />}
                >
                  Individual equipment
                </Button>
                {navLinks.map((link) => (
                  <Button
                    key={link.href}
                    variant="ghost"
                    className="justify-start"
                    nativeButton={false}
                    render={<Link href={link.href} />}
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
