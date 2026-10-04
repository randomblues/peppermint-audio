"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { useCart } from "@/components/cart-provider";
import { DatePicker } from "@/components/date-picker";
import { TimePicker } from "@/components/time-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { bookingReferenceForId } from "@/lib/booking-reference";
import { lineItemsFromCart, type BookingLineItem } from "@/lib/booking-line-items";
import { getMelbourneToday } from "@/lib/date-utils";
import { hireTerms } from "@/lib/site-content";
import { bookingSchema, type BookingInputValues } from "@/lib/validation/booking";

const draftKey = "peppermint-audio-booking-draft";
const maxPhotoIdSize = 1.5 * 1024 * 1024;

const initialValues: BookingInputValues = {
  email: "",
  firstName: "",
  lastName: "",
  mobile: "",
  eventType: "",
  eventAddress: "",
  pickupDate: "",
  dropoffDate: "",
  pickupTime: "",
  dropoffTime: "",
  hireLineItems: "",
  additionalDetails: "",
  termsAccepted: "",
};

type FormState = BookingInputValues & { idFiles: File[] };

async function prepareFile(file: File) {
  if (file.size <= maxPhotoIdSize) return file;
  throw new Error("Each photo ID file must be smaller than 1.5 MB.");
}

function Field({
  label,
  name,
  value,
  onChange,
  error,
  type = "text",
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

export function BookingForm() {
  const { items, clearCart } = useCart();
  const [values, setValues] = useState<FormState>({ ...initialValues, idFiles: [] });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);

  const cartJson = JSON.stringify(items);
  const lineItems: BookingLineItem[] = lineItemsFromCart(cartJson);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(draftKey);
      if (!saved) return;
      const parsed = JSON.parse(saved) as Partial<BookingInputValues>;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValues((current) => ({ ...current, ...parsed, idFiles: [] }));
    } catch {
      window.localStorage.removeItem(draftKey);
    }
  }, []);

  useEffect(() => {
    const draft = Object.fromEntries(Object.entries(values).filter(([key]) => key !== "idFiles"));
    window.localStorage.setItem(draftKey, JSON.stringify(draft));
  }, [values]);

  function update(name: keyof BookingInputValues, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
  }

  function validate(requestValues: BookingInputValues) {
    const result = bookingSchema.safeParse(requestValues);
    const nextErrors: Record<string, string> = {};
    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string" && !nextErrors[field]) nextErrors[field] = issue.message;
      }
    }
    if (!lineItems.length) nextErrors.hireLineItems = "Please select at least one hire item before submitting.";
    if (values.idFiles.length !== 2) nextErrors.idFiles = "Please upload the front and back of your photo ID.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const requestValues = { ...values, hireLineItems: JSON.stringify(lineItems) };
    if (!validate(requestValues)) return;
    setIsSubmitting(true);
    setServerError("");
    const formData = new FormData();
    Object.entries(requestValues).forEach(([name, value]) => {
      if (name !== "idFiles") formData.append(name, String(value));
    });
    try {
      for (const file of values.idFiles) formData.append("idFiles", await prepareFile(file));
      const response = await fetch("/api/booking", { method: "POST", body: formData });
      const payload = await response.json().catch(() => null) as { error?: string; bookingId?: string; bookingReference?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Could not submit your booking request.");
      const reference = payload?.bookingReference ?? (payload?.bookingId ? bookingReferenceForId(payload.bookingId) : null);
      if (!reference) throw new Error("Your request was submitted, but no booking reference was returned.");
      setSubmitted(reference);
      clearCart();
      window.localStorage.removeItem(draftKey);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Could not submit your booking request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <Card className="mx-auto max-w-3xl">
        <CardHeader>
          <Badge variant="secondary" className="w-fit">Request submitted</Badge>
          <CardTitle>Thanks — we have received your request</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">Booking reference: {submitted}</p>
          <p>Your request is not confirmed yet. We will review availability and contact you shortly.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-4xl">
      <CardHeader>
        <CardTitle>Booking details</CardTitle>
        <p className="text-sm text-muted-foreground">Tell us about your event and preferred hire times. We will confirm availability before your booking is accepted.</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-8">
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Your details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name" name="firstName" value={values.firstName} onChange={(value) => update("firstName", value)} error={errors.firstName} />
              <Field label="Last name" name="lastName" value={values.lastName} onChange={(value) => update("lastName", value)} error={errors.lastName} />
              <Field label="Email" name="email" type="email" value={values.email} onChange={(value) => update("email", value)} error={errors.email} />
              <Field label="Mobile number" name="mobile" value={values.mobile} onChange={(value) => update("mobile", value)} error={errors.mobile} />
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Event and hire times</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Event type" name="eventType" value={values.eventType} onChange={(value) => update("eventType", value)} error={errors.eventType} placeholder="Wedding, party, presentation..." />
              <Field label="Event address" name="eventAddress" value={values.eventAddress} onChange={(value) => update("eventAddress", value)} error={errors.eventAddress} />
              <div className="space-y-1.5">
                <Label>Pickup date</Label>
                <DatePicker id="pickup-date" value={values.pickupDate} onChange={(value) => update("pickupDate", value)} onBlur={() => undefined} minDate={getMelbourneToday()} invalid={Boolean(errors.pickupDate)} />
                {errors.pickupDate ? <p className="text-xs text-destructive">{errors.pickupDate}</p> : null}
              </div>
              <div className="space-y-1.5">
                <Label>Drop-off date</Label>
                <DatePicker id="dropoff-date" value={values.dropoffDate} onChange={(value) => update("dropoffDate", value)} onBlur={() => undefined} minDate={values.pickupDate || getMelbourneToday()} invalid={Boolean(errors.dropoffDate)} />
                {errors.dropoffDate ? <p className="text-xs text-destructive">{errors.dropoffDate}</p> : null}
              </div>
              <TimePicker id="pickup-time" label="Pickup time" value={values.pickupTime} onChange={(value) => update("pickupTime", value)} error={errors.pickupTime} />
              <TimePicker id="dropoff-time" label="Drop-off time" value={values.dropoffTime} onChange={(value) => update("dropoffTime", value)} error={errors.dropoffTime} />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Selected hire items</h2>
            {lineItems.length ? (
              <ul className="divide-y rounded-lg border">
                {lineItems.map((item) => <li key={item.id} className="flex justify-between gap-4 px-4 py-3 text-sm"><span>{item.quantity} × {item.name}{item.option ? <span className="block text-muted-foreground">{item.option}</span> : null}</span><span className="shrink-0 font-medium">${((item.unitPriceCents * item.quantity) / 100).toFixed(2)}</span></li>)}
              </ul>
            ) : (
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">Your cart is empty. <Link href="/equipment" className="font-medium underline">Browse equipment</Link> before submitting.</p>
            )}
            {errors.hireLineItems ? <p className="text-xs text-destructive">{errors.hireLineItems}</p> : null}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Anything else?</h2>
            <Label htmlFor="additionalDetails">Additional details or access requirements <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Textarea id="additionalDetails" value={values.additionalDetails} onChange={(event) => update("additionalDetails", event.target.value)} placeholder="Venue access, setup notes, or special requirements..." className="min-h-28" />
            {errors.additionalDetails ? <p className="text-xs text-destructive">{errors.additionalDetails}</p> : null}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Photo ID and terms</h2>
            <p className="text-sm text-muted-foreground">Upload clear images of the front and back of your valid photo ID. Each file must be 1.5 MB or smaller.</p>
            <Input type="file" accept="image/*,.pdf" multiple onChange={(event) => {
              const selected = Array.from(event.target.files ?? []).slice(0, 2);
              setValues((current) => ({ ...current, idFiles: selected }));
              setErrors((current) => ({ ...current, idFiles: "" }));
              event.currentTarget.value = "";
            }} />
            {values.idFiles.length ? <p className="text-sm text-muted-foreground">{values.idFiles.map((file) => file.name).join(", ")}</p> : null}
            {errors.idFiles ? <p className="text-xs text-destructive">{errors.idFiles}</p> : null}
            <details className="rounded-lg border px-4 py-3">
              <summary className="cursor-pointer font-medium">Read the PA Equipment Hire Terms & Conditions</summary>
              <div className="space-y-3 pt-4 text-sm text-muted-foreground">{hireTerms.map((term) => <div key={term.title}><p className="font-medium text-foreground">{term.title}</p><p>{term.body}</p></div>)}</div>
            </details>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1 size-4 accent-primary" checked={values.termsAccepted === "accepted"} onChange={(event) => update("termsAccepted", event.target.checked ? "accepted" : "")} />
              <span>I have read and agree to the PA Equipment Hire Terms & Conditions.</span>
            </label>
            {errors.termsAccepted ? <p className="text-xs text-destructive">{errors.termsAccepted}</p> : null}
          </section>

          {serverError ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{serverError}</p> : null}
          <Button type="submit" className="w-full sm:w-auto" disabled={isSubmitting}>{isSubmitting ? "Submitting..." : "Submit a Booking Request"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
