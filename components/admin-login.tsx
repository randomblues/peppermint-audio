"use client";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
export function AdminLogin() {
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) });
    if (!response.ok) { setError((await response.json()).error ?? "Login failed."); return; }
    window.location.href = "/admin";
  }
  return <main className="mx-auto flex min-h-[70vh] max-w-md items-center px-6"><Card className="w-full"><CardHeader><CardTitle>Admin login</CardTitle></CardHeader><CardContent><form onSubmit={submit} className="space-y-4"><label className="block text-sm">Email<input name="email" type="email" required className="mt-1 w-full rounded border bg-background p-2" /></label><label className="block text-sm">Password<input name="password" type="password" required className="mt-1 w-full rounded border bg-background p-2" /></label>{error && <p className="text-sm text-destructive">{error}</p>}<Button type="submit">Sign in</Button></form></CardContent></Card></main>;
}
