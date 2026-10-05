"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
export function AdminLogin() {
  const [error, setError] = useState("");
  const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) });
      if (!response.ok) {
        const body = await response.text();
        let message = "Login failed.";
        if (body) {
          try {
            const parsed = JSON.parse(body) as { error?: unknown };
            if (typeof parsed.error === "string") message = parsed.error;
          } catch {
            message = "The admin login service returned an invalid response.";
          }
        }
        setError(message);
        return;
      }
      router.replace("/admin");
    } catch {
      setError("The admin login service is unavailable.");
    }
  }
  return <main className="mx-auto flex min-h-[70vh] max-w-md items-center px-6"><h1 className="sr-only">Admin login</h1><Card className="w-full"><CardHeader><CardTitle>Admin login</CardTitle></CardHeader><CardContent><form onSubmit={submit} className="space-y-4"><label className="block space-y-1.5 text-sm">Email<Input name="email" type="email" required /></label><label className="block space-y-1.5 text-sm">Password<Input name="password" type="password" required /></label>{error && <p className="text-sm text-destructive">{error}</p>}<Button type="submit">Sign in</Button></form></CardContent></Card></main>;
}
