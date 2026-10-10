"use client";

import { startTransition, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, CircleCheck, Clock3, FileImage, MessageCircle, Upload, X } from "lucide-react";

import { useCart } from "@/components/cart-provider";
import { HirePriceSummary } from "@/components/hire-price-summary";
import { TimePicker } from "@/components/time-picker";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { bookingReferenceForId } from "@/lib/booking-reference";
import { lineItemHireTotalCents, lineItemsFromCart, type BookingLineItem } from "@/lib/booking-line-items";
import { getMelbourneToday } from "@/lib/date-utils";
import { hireTerms } from "@/lib/site-content";
import { formatAudCents, rentalDays } from "@/lib/payment-flow";
import { bookingSchema, type BookingInputValues } from "@/lib/validation/booking";
import { preparePhotoId } from "@/lib/prepare-photo-id";

const draftKey = "peppermint-audio-booking-draft";

const initialValues: Omit<BookingInputValues, "pickupDate" | "dropoffDate"> = {
  email: "",
  firstName: "",
  lastName: "",
  mobile: "",
  eventType: "",
  eventAddress: "",
  pickupTime: "",
  dropoffTime: "",
  hireLineItems: "",
  additionalDetails: "",
  termsAccepted: "",
};

const bookingSteps = [
  {
    title: "Your details",
    description: "Share your contact details so we can confirm availability with you.",
  },
  {
    title: "Event details",
    description: "Tell us where and when your hire is happening.",
  },
  {
    title: "Review your hire",
    description: "Check your selected items and add any extra setup notes.",
  },
  {
    title: "Photo ID and terms",
    description: "Upload your ID and accept the hire terms to submit your request.",
  },
] as const;

const stepFields: Array<Array<keyof BookingInputValues | "idFiles">> = [
  ["firstName", "lastName", "email", "mobile"],
  ["eventType", "eventAddress", "pickupDate", "dropoffDate", "pickupTime", "dropoffTime"],
  ["hireLineItems", "additionalDetails"],
  ["idFiles", "termsAccepted"],
];

type FormState = typeof initialValues & { idFiles: File[] };

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
  const { items, hireDates, clearCart } = useCart();
  const [formValues, setValues] = useState<FormState>({ ...initialValues, idFiles: [] });
  const values = { ...formValues, ...hireDates };
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [step4SubmitAttempted, setStep4SubmitAttempted] = useState(false);
  const [idFilesTouched, setIdFilesTouched] = useState(false);
  const [termsTouched, setTermsTouched] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const cartJson = JSON.stringify(items);
  const lineItems: BookingLineItem[] = lineItemsFromCart(cartJson);
  const nights = rentalDays(values.pickupDate, values.dropoffDate);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(draftKey);
      const parsed = saved ? JSON.parse(saved) as Partial<BookingInputValues> : {};
      delete parsed.pickupDate;
      delete parsed.dropoffDate;
      startTransition(() => {
        setValues((current) => ({ ...current, ...parsed, idFiles: [] }));
        setDraftLoaded(true);
      });
    } catch {
      window.localStorage.removeItem(draftKey);
      startTransition(() => setDraftLoaded(true));
    }
  }, []);

  useEffect(() => {
    if (!draftLoaded) return;
    const draft = Object.fromEntries(Object.entries(formValues).filter(([key]) => key !== "idFiles"));
    window.localStorage.setItem(draftKey, JSON.stringify(draft));
  }, [draftLoaded, formValues]);

  function update(name: keyof typeof initialValues, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
    if (name === "termsAccepted") {
      setTermsTouched(true);
    }
    setErrors((current) => ({ ...current, [name]: "" }));
    if (serverError) setServerError("");
  }

  function collectValidationErrors(requestValues: BookingInputValues) {
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
    return nextErrors;
  }

  function validate(requestValues: BookingInputValues) {
    const nextErrors = collectValidationErrors(requestValues);
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function validateCurrentStep() {
    const requestValues = { ...values, hireLineItems: JSON.stringify(lineItems) };
    const allErrors = collectValidationErrors(requestValues);
    const activeStepFields = stepFields[currentStep] ?? [];
    const stepErrors: Record<string, string> = {};
    for (const field of activeStepFields) {
      if (allErrors[field]) stepErrors[field] = allErrors[field];
    }
    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  }

  function updateIdFiles(incomingFiles: File[]) {
    const selected = incomingFiles.slice(0, 2);
    setValues((current) => ({ ...current, idFiles: selected }));
    setIdFilesTouched(true);
    setErrors((current) => ({ ...current, idFiles: "" }));
  }

  function removeIdFile(indexToRemove: number) {
    setValues((current) => ({
      ...current,
      idFiles: current.idFiles.filter((_, index) => index !== indexToRemove),
    }));
    setIdFilesTouched(true);
    setErrors((current) => ({ ...current, idFiles: "" }));
  }

  function goToNextStep() {
    if (!validateCurrentStep()) return;
    setCurrentStep((step) => {
      const nextStep = Math.min(step + 1, bookingSteps.length - 1);
      if (nextStep === 3) {
        setStep4SubmitAttempted(false);
        setIdFilesTouched(false);
        setTermsTouched(false);
        setErrors((current) => {
          const next = { ...current };
          delete next.idFiles;
          delete next.termsAccepted;
          return next;
        });
      }
      return nextStep;
    });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (currentStep !== bookingSteps.length - 1) return;
    setStep4SubmitAttempted(true);
    const requestValues = { ...values, hireLineItems: JSON.stringify(lineItems) };
    if (!validate(requestValues)) return;
    setIsSubmitting(true);
    setServerError("");
    const formData = new FormData();
    Object.entries(requestValues).forEach(([name, value]) => {
      if (name !== "idFiles") formData.append(name, String(value));
    });
    try {
      for (const file of values.idFiles) formData.append("idFiles", await preparePhotoId(file));
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
      <Card className="relative mx-auto max-w-3xl gap-0 rounded-3xl border border-primary/20 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklab,var(--primary)_12%,transparent),transparent_65%)] py-0 shadow-[0_24px_80px_rgb(0_0_0/0.18)]">
        <div aria-hidden="true" className="h-px bg-linear-to-r from-transparent via-primary/70 to-transparent" />
        <CardContent className="px-5 py-8 sm:px-10 sm:py-10">
          <div role="status" className="text-center">
            <div className="mx-auto mb-5 flex size-20 items-center justify-center rounded-full border border-primary/25 bg-primary/10 shadow-[0_0_45px_color-mix(in_oklab,var(--primary)_18%,transparent)]">
              <CircleCheck aria-hidden="true" className="size-10 text-primary" strokeWidth={1.5} />
            </div>
            <Badge variant="secondary" className="border border-primary/20 bg-primary/10 px-3 py-1 text-primary">Request submitted</Badge>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Thanks — we have received your request</h2>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">Your request is not confirmed yet. We will review availability and contact you shortly.</p>
          </div>

          <div className="mt-7 rounded-2xl border border-primary/20 bg-background/50 px-4 py-5 text-center">
            <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">Booking reference</p>
            <p className="mt-2 break-all font-mono text-lg font-semibold text-foreground sm:text-2xl sm:tracking-wide">{submitted}</p>
            <p className="mt-2 text-xs text-muted-foreground">Keep this handy when contacting us about your request.</p>
          </div>

          <div className="mt-8">
            <h3 className="text-sm font-semibold text-foreground">What happens next</h3>
            <ol className="mt-4 grid gap-4 sm:grid-cols-3 sm:gap-5">
              {[
                { icon: Check, title: "Request received", description: "Your hire details are with our team.", active: true },
                { icon: Clock3, title: "Availability review", description: "We will check your dates and equipment.", active: false },
                { icon: MessageCircle, title: "We will be in touch", description: "We will contact you about the next steps.", active: false },
              ].map(({ icon: Icon, title, description, active }) => (
                <li key={title} className="flex gap-3 sm:flex-col">
                  <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl border ${active ? "border-primary/25 bg-primary/10 text-primary" : "border-border bg-background/40 text-muted-foreground"}`}>
                    <Icon aria-hidden="true" className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-8 flex flex-col gap-3 border-t border-border/60 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">Have a question? <Link href="/contact" className="font-medium text-primary underline-offset-4 hover:underline">Contact us</Link></p>
            <Link href="/" className={buttonVariants({ className: "h-11 gap-2 px-5" })}>Back to home <ArrowRight aria-hidden="true" className="size-4" /></Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (nights === null || values.pickupDate < getMelbourneToday()) {
    return (
      <Card className="mx-auto max-w-3xl">
        <CardHeader><CardTitle>Choose your hire dates</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Select your dates in the cart to see your hire total before continuing with your booking request.</p>
          <Button nativeButton={false} render={<Link href="/cart" />}>Return to cart</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-4xl overflow-visible">
      <CardHeader>
        <CardTitle>Booking details</CardTitle>
        <p className="text-sm text-muted-foreground">Complete each step below. We will review availability before confirming your booking.</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-8">
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Step {currentStep + 1} of {bookingSteps.length}</p>
            <ol className="grid gap-2 sm:grid-cols-4">
              {bookingSteps.map((step, index) => (
                <li key={step.title} className={`rounded-md border px-3 py-2 text-xs ${index === currentStep ? "border-primary/50 bg-primary/10 text-foreground" : "border-border text-muted-foreground"}`}>
                  <p className="font-medium">{index + 1}. {step.title}</p>
                </li>
              ))}
            </ol>
          </div>

          <section className="space-y-4 rounded-xl border border-border/80 bg-background/35 p-4 sm:p-5">
            <h2 className="text-lg font-semibold">{bookingSteps[currentStep].title}</h2>
            <p className="text-sm text-muted-foreground">{bookingSteps[currentStep].description}</p>

            {currentStep === 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First name" name="firstName" value={values.firstName} onChange={(value) => update("firstName", value)} error={errors.firstName} />
                <Field label="Last name" name="lastName" value={values.lastName} onChange={(value) => update("lastName", value)} error={errors.lastName} />
                <Field label="Email" name="email" type="email" value={values.email} onChange={(value) => update("email", value)} error={errors.email} />
                <Field label="Mobile number" name="mobile" value={values.mobile} onChange={(value) => update("mobile", value)} error={errors.mobile} />
              </div>
            ) : null}

            {currentStep === 1 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Event type" name="eventType" value={values.eventType} onChange={(value) => update("eventType", value)} error={errors.eventType} placeholder="Wedding, party, presentation..." />
                <Field label="Event address" name="eventAddress" value={values.eventAddress} onChange={(value) => update("eventAddress", value)} error={errors.eventAddress} />
                <div className="space-y-2 rounded-lg border p-3 sm:col-span-2">
                  <p className="text-sm font-medium">Hire dates</p>
                  <div className="flex flex-wrap justify-between gap-3 text-sm">
                    <p>Pickup: {new Date(`${values.pickupDate}T12:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}<br />Drop-off: {new Date(`${values.dropoffDate}T12:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}</p>
                    <Link href="/cart" className="font-medium underline">Change dates</Link>
                  </div>
                </div>
                <TimePicker id="pickup-time" label="Pickup time" value={values.pickupTime} onChange={(value) => update("pickupTime", value)} error={errors.pickupTime} />
                <TimePicker id="dropoff-time" label="Drop-off time" value={values.dropoffTime} onChange={(value) => update("dropoffTime", value)} error={errors.dropoffTime} />
              </div>
            ) : null}

            {currentStep === 2 ? (
              <div className="space-y-4">
                <div className="space-y-3">
                  <h3 className="text-base font-semibold">Selected hire items</h3>
                  {lineItems.length ? (
                    <ul className="divide-y rounded-lg border">
                      {lineItems.map((item) => <li key={item.id} className="flex justify-between gap-4 px-4 py-3 text-sm"><span>{item.quantity} × {item.name}{item.option ? <span className="block text-muted-foreground">{item.option}</span> : null}<span className="block text-xs text-muted-foreground">{formatAudCents(item.unitPriceCents)} each / night</span></span><span className="shrink-0 font-medium">{formatAudCents(lineItemHireTotalCents(item, nights))}</span></li>)}
                    </ul>
                  ) : (
                    <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">Your cart is empty. <Link href="/equipment" className="font-medium underline">Browse equipment</Link> before submitting.</p>
                  )}
                  {errors.hireLineItems ? <p className="text-xs text-destructive">{errors.hireLineItems}</p> : null}
                </div>

                <div className="space-y-3">
                  <h3 className="text-base font-semibold">Anything else?</h3>
                  <Label htmlFor="additionalDetails">Additional details or access requirements <span className="font-normal text-muted-foreground">(optional)</span></Label>
                  <Textarea id="additionalDetails" value={values.additionalDetails} onChange={(event) => update("additionalDetails", event.target.value)} placeholder="Venue access, setup notes, or special requirements..." className="min-h-28" />
                  {errors.additionalDetails ? <p className="text-xs text-destructive">{errors.additionalDetails}</p> : null}
                </div>
              </div>
            ) : null}

            {lineItems.length && currentStep > 0 ? (
              <div className="space-y-2 rounded-lg border bg-muted/30 p-4" aria-live="polite">
                <HirePriceSummary items={lineItems} nights={nights} label={`Hire total · ${nights} ${nights === 1 ? "night" : "nights"}`} />
                <p className="text-xs text-muted-foreground">Availability, final pricing and any security deposit are confirmed separately.</p>
              </div>
            ) : null}

            {currentStep === 3 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Upload clear photos of the front and back of your valid photo ID.</p>
                <div
                  data-testid="photo-id-dropzone"
                  className={`rounded-xl border border-dashed p-5 transition-all duration-200 ${isDragOver ? "border-primary bg-primary/8 ring-4 ring-primary/20 shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_45%,transparent),0_16px_40px_rgb(0_0_0/0.25)]" : "border-input bg-muted/30 hover:border-primary/35 hover:bg-primary/5"}`}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    setIsDragOver(false);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    setIsDragOver(false);
                    updateIdFiles(Array.from(event.dataTransfer.files ?? []));
                  }}
                >
                  <div className="flex flex-col items-center gap-2 text-center">
                    <div className={`rounded-full border bg-background p-2 text-primary transition-all duration-200 ${isDragOver ? "border-primary/55 shadow-[0_0_24px_color-mix(in_oklab,var(--primary)_35%,transparent)]" : "border-border"}`}>
                      <Upload className="size-5" aria-hidden="true" />
                    </div>
                    <p className="text-sm font-medium text-foreground">{isDragOver ? "Drop files to upload" : "Drag and drop your photo ID files here"}</p>
                    <p className="text-xs text-muted-foreground">Front and back images or PDF, up to 2 files total.</p>
                    <Input
                      id="photo-id-files"
                      type="file"
                      accept="image/*,.pdf"
                      multiple
                      className="sr-only"
                      onChange={(event) => {
                        updateIdFiles(Array.from(event.target.files ?? []));
                        event.currentTarget.value = "";
                      }}
                    />
                    <Label htmlFor="photo-id-files" className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-input bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary">
                      <FileImage className="size-4" aria-hidden="true" />
                      Choose files
                    </Label>
                  </div>
                </div>
                {values.idFiles.length ? (
                  <ul className="flex flex-wrap gap-2">
                    {values.idFiles.map((file, index) => (
                      <li key={`${file.name}-${index}`}>
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/45 hover:bg-primary/14"
                          onClick={() => removeIdFile(index)}
                          aria-label={`Remove ${file.name}`}
                        >
                          <FileImage className="size-3.5 text-primary" aria-hidden="true" />
                          <span className="max-w-44 truncate">{file.name}</span>
                          <X className="size-3 text-muted-foreground" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No files selected yet.</p>
                )}
                {(step4SubmitAttempted || idFilesTouched) && errors.idFiles ? <p className="text-xs text-destructive">{errors.idFiles}</p> : null}
                <details className="rounded-lg border px-4 py-3">
                  <summary className="cursor-pointer font-medium">Read the PA Equipment Hire Terms & Conditions</summary>
                  <div className="space-y-3 pt-4 text-sm text-muted-foreground">{hireTerms.map((term) => <div key={term.title}><p className="font-medium text-foreground">{term.title}</p><p>{term.body}</p></div>)}</div>
                </details>
                <label className="flex items-start gap-3 text-sm">
                  <input type="checkbox" className="mt-1 size-4 accent-primary" checked={values.termsAccepted === "accepted"} onChange={(event) => update("termsAccepted", event.target.checked ? "accepted" : "")} />
                  <span>I have read and agree to the PA Equipment Hire Terms & Conditions.</span>
                </label>
                {(step4SubmitAttempted || termsTouched) && errors.termsAccepted ? <p className="text-xs text-destructive">{errors.termsAccepted}</p> : null}
              </div>
            ) : null}
          </section>

          {serverError ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{serverError}</p> : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={(event) => {
                event.preventDefault();
                setCurrentStep((step) => Math.max(step - 1, 0));
              }}
              className={currentStep === 0 ? "invisible" : ""}
            >
              Back
            </Button>
            {currentStep < bookingSteps.length - 1 ? (
              <Button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  goToNextStep();
                }}
                className="w-full sm:w-auto"
              >
                Next
              </Button>
            ) : (
              <Button type="submit" className="w-full sm:w-auto" disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Submit a Booking Request"}
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
