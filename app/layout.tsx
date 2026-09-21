import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Peppermint Audio | Audio Rental for Melbourne Events",
  description:
    "Complete audio system hire for private events in Melbourne, including speakers, microphones, mixers, and cables. Pickup from Abbotsford 3067.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full">
        <div className="flex min-h-screen flex-col">
          <Navbar />
          <main className="flex-1 bg-background">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
