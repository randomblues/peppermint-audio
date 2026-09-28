"use client";

import { MessageCircle } from "lucide-react";
import { usePathname } from "next/navigation";

const whatsappUrl = `https://wa.me/61452316823?text=${encodeURIComponent(
  "Hi Peppermint Audio, I have an enquiry about hiring an audio system.",
)}`;

export function WhatsAppButton() {
  const pathname = usePathname();

  if (pathname.startsWith("/admin")) return null;

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat with Peppermint Audio on WhatsApp"
      className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-[#20bd5a] hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2"
    >
      <MessageCircle className="size-5" />
      <span className="hidden sm:inline">Chat on WhatsApp</span>
    </a>
  );
}
