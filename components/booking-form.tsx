"use client";

import { useState } from "react";

import { DatePicker } from "@/components/date-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addOnCatalog, packageTiers, hireTerms } from "@/lib/site-content";
import { bookingSchema, type BookingFormInputValues } from "@/lib/validation/booking";

const steps = [
  "Your details",
  "Event details",
  "Hire dates",
  "Package selection",
  "Additional details",
  "Photo ID",
  "Deposit + terms",
];

const initialValues: BookingFormInputValues = {
  email: "",
  firstName: "",
  lastName: "",
  mobile: "",
  eventType: "",
  eventAddress: "",
  pickupDate: "",
  dropoffDate: "",
  packageInterest: "",
  addOns: "",
  guestCount: 1,
  additionalDetails: "",
  termsAccepted: "",
};

type BookingFormState = BookingFormInputValues & {
  idFiles: File[];
};

const initialState: BookingFormState = { ...initialValues, idFiles: [] };

function fieldError(errors: Record<string, string>, name: string) {
  return errors[name] ? <p className="text-xs text-destructive">{errors[name]}</p> : null;
}

type BookingFormProps = {
  initialPackageSlug?: string;
};

export function BookingForm({ initialPackageSlug }: BookingFormProps) {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<BookingFormState>(() => ({
    ...initialState,
    packageInterest: packageTiers.find((pkg) => pkg.slug === initialPackageSlug)?.name ?? "",
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateValue(name: keyof BookingFormInputValues, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
  }

  function toggleAddOn(slug: string) {
    const selected = values.addOns ? values.addOns.split(",").filter(Boolean) : [];
    const next = selected.includes(slug) ? selected.filter((value) => value !== slug) : [...selected, slug];
    updateValue("addOns", next.join(","));
  }

  function validateCurrentStep() {
    const fieldsByStep: Array<Array<keyof BookingFormInputValues>> = [
      ["email", "firstName", "lastName", "mobile"],
      ["eventType", "eventAddress", "guestCount"],
      ["pickupDate", "dropoffDate"],
      ["packageInterest"],
      ["additionalDetails"],
      [],
      ["termsAccepted"],
    ];
    const fields = fieldsByStep[step];
    const result = bookingSchema.safeParse(values);
    const nextErrors: Record<string, string> = {};

    if (!result.success) {
      for (const issue of result.error.issues) {
        const name = issue.path[0];
        if (typeof name === "string" && fields.includes(name as keyof BookingFormInputValues)) {
          nextErrors[name] = issue.message;
        }
      }
    }

    if (step === 2 && values.pickupDate && values.dropoffDate && values.dropoffDate < values.pickupDate) {
      nextErrors.dropoffDate = "Drop-off date must be on or after pickup date";
    }

    if (step === 5 && values.idFiles.length === 0) {
      nextErrors.idFiles = "Please upload clear images of the front and back of your photo ID";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function nextStep() {
    if (validateCurrentStep()) {
      setStep((current) => Math.min(current + 1, steps.length - 1));
    }
  }

  function previousStep() {
    setErrors({});
    setStep((current) => Math.max(current - 1, 0));
  }

  async function submitBooking() {
    if (!validateCurrentStep()) return;

    setIsSubmitting(true);
    setServerError(null);

    const formData = new FormData();
    Object.entries(values).forEach(([name, value]) => {
      if (name !== "idFiles") formData.append(name, String(value));
    });
    values.idFiles.forEach((file) => formData.append("idFiles", file));

    try {
      const response = await fetch("/api/booking", { method: "POST", body: formData });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setServerError(payload?.error ?? "Could not send your booking details right now.");
        return;
      }

      setSubmitted(true);
    } catch {
      setServerError("Could not send your booking details right now. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <Card className="mx-auto w-full max-w-3xl !overflow-visible border">
        <CardHeader>
          <Badge variant="secondary" className="w-fit">Request submitted</Badge>
          <CardTitle>Your booking request has been received</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Please note that your booking has not yet been confirmed.</p>
          <p>Someone from our team will reach out, if not already, to discuss your booking. Once your booking is confirmed, you will automatically receive a confirmation email.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-3xl !overflow-visible border">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between gap-4">
          <CardTitle>{steps[step]}</CardTitle>
          <span className="shrink-0 text-sm text-muted-foreground">Page {step + 1} of {steps.length}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted" aria-label={`Step ${step + 1} of ${steps.length}`}>
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        {step === 0 ? (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">Please enter the details for the person making the booking.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email" name="email" value={values.email} onChange={(value) => updateValue("email", value)} error={errors.email} type="email" />
              <Field label="Mobile number" name="mobile" value={values.mobile} onChange={(value) => updateValue("mobile", value)} error={errors.mobile} />
              <Field label="First name" name="firstName" value={values.firstName} onChange={(value) => updateValue("firstName", value)} error={errors.firstName} />
              <Field label="Last name" name="lastName" value={values.lastName} onChange={(value) => updateValue("lastName", value)} error={errors.lastName} />
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-5">
            <Field label="Event type" name="eventType" value={values.eventType} onChange={(value) => updateValue("eventType", value)} error={errors.eventType} placeholder="Birthday party, wedding, presentation..." />
            <Field label="Event address" name="eventAddress" value={values.eventAddress} onChange={(value) => updateValue("eventAddress", value)} error={errors.eventAddress} />
            <Field label="Estimated guests" name="guestCount" value={String(values.guestCount)} onChange={(value) => updateValue("guestCount", value)} error={errors.guestCount} type="number" min={1} />
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">Please enter the agreed pickup and drop-off dates for your hire.</p>
            <DateField label="Pickup date" value={values.pickupDate} onChange={(value) => updateValue("pickupDate", value)} error={errors.pickupDate} />
            <DateField label="Drop-off date" value={values.dropoffDate} onChange={(value) => updateValue("dropoffDate", value)} error={errors.dropoffDate} />
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-8">
            <fieldset className="space-y-4">
              <legend className="text-base font-semibold">Choose your package</legend>
              <p className="text-sm text-muted-foreground">
                Start with the complete setup that best fits your event. You can add optional add-ons after you choose.
              </p>
              <div className="grid gap-4 lg:grid-cols-3">
                {packageTiers.map((pkg) => {
                  const isSelected = values.packageInterest === pkg.name;

                  return (
                    <label
                      key={pkg.slug}
                      className={`relative flex cursor-pointer flex-col rounded-xl border p-4 transition-colors ${
                        isSelected
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                          : "hover:border-primary/50 hover:bg-muted/50"
                      }`}
                    >
                      <input
                        className="sr-only"
                        type="radio"
                        name="packageInterest"
                        value={pkg.name}
                        checked={isSelected}
                        onChange={(event) => {
                          updateValue("packageInterest", event.target.value);
                          updateValue("addOns", "");
                        }}
                      />
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex flex-1 flex-wrap items-center gap-2">
                          <span className="font-semibold">{pkg.name}</span>
                          {pkg.notes ? (
                            <span className="max-w-full text-xs font-medium leading-tight text-primary">
                              {pkg.notes}
                            </span>
                          ) : null}
                        </div>
                        <span className="shrink-0 whitespace-nowrap text-xl font-semibold">${pkg.price}</span>
                      </div>
                      <div className="mt-3 border-t pt-3">
                        <p className="text-sm font-medium text-foreground">Ideal for {pkg.capacity}</p>
                        <p className="mt-2 text-sm text-muted-foreground">{pkg.summary}</p>
                      </div>
                      <ul className="mt-4 space-y-1.5 border-t pt-3 text-sm text-muted-foreground">
                        {pkg.inclusions.slice(0, 4).map((item) => (
                          <li key={item}>• {item}</li>
                        ))}
                      </ul>
                      <span className="mt-auto pt-4 text-sm font-medium text-primary">
                        {isSelected ? "Selected package" : "Select this package"}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            {fieldError(errors, "packageInterest")}
            {values.packageInterest ? (() => {
              const selectedPackage = packageTiers.find((pkg) => pkg.name === values.packageInterest);
              const selectedAddOns = (values.addOns ?? "").split(",").filter(Boolean);
              return selectedPackage && selectedPackage.addOnSlugs.length > 0 ? (
                <div className="rounded-xl border border-dashed bg-muted/30 p-5">
                  <div className="max-w-2xl">
                    <p className="font-semibold">Add-ons <span className="font-normal text-muted-foreground">(optional)</span></p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Your <span className="font-medium text-foreground">{selectedPackage.name}</span> already includes everything you need to get started. Select any add-ons that suit your event.
                    </p>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {selectedPackage.addOnSlugs.map((slug) => {
                      const addOn = addOnCatalog[slug];
                      if (!addOn) return null;
                      const inputId = `add-on-${slug}`;

                      return (
                        <label
                          key={slug}
                          htmlFor={inputId}
                          className="flex cursor-pointer items-center gap-3 rounded-lg border bg-background p-3 text-sm transition-colors hover:border-primary/50"
                        >
                          <input
                            id={inputId}
                            type="checkbox"
                            checked={selectedAddOns.includes(slug)}
                            onChange={() => toggleAddOn(slug)}
                            className="size-4 accent-primary"
                          />
                          <span>{addOn.name}</span>
                          <span className="ml-auto shrink-0 text-muted-foreground">+${addOn.price}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : null;
            })() : null}
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-2">
            <Label htmlFor="additionalDetails">If applicable, mention any additional details or requests below</Label>
            <Textarea id="additionalDetails" value={values.additionalDetails} onChange={(event) => updateValue("additionalDetails", event.target.value)} className="min-h-44" placeholder="Venue access, delivery needs, music setup, special requirements..." />
            {fieldError(errors, "additionalDetails")}
          </div>
        ) : null}

        {step === 5 ? (
          <div className="space-y-4">
            <p>Please upload clear images of both the <strong>front and back</strong> of your valid photo ID.</p>
            <p className="text-sm text-muted-foreground">Upload up to 2 supported files. Images or PDF, maximum 10 MB per file.</p>
            <Input
              type="file"
              accept="image/*,.pdf"
              multiple
              onChange={(event) => {
                const selectedFiles = Array.from(event.target.files ?? []);
                setValues((current) => {
                  const files = [...current.idFiles];
                  for (const file of selectedFiles) {
                    if (
                      files.length < 2 &&
                      !files.some(
                        (existingFile) =>
                          existingFile.name === file.name &&
                          existingFile.size === file.size &&
                          existingFile.lastModified === file.lastModified,
                      )
                    ) {
                      files.push(file);
                    }
                  }
                  return { ...current, idFiles: files };
                });
                setErrors((current) => ({ ...current, idFiles: "" }));
                event.currentTarget.value = "";
              }}
            />
            <p className="text-sm text-muted-foreground">
              {values.idFiles.length} of 2 files selected
            </p>
            {values.idFiles.length > 0 ? (
              <ul className="space-y-2">
                {values.idFiles.map((file, index) => (
                  <li
                    key={`${file.name}-${file.lastModified}`}
                    className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                  >
                    <span className="truncate">{file.name}</span>
                    <button
                      type="button"
                      className="shrink-0 text-muted-foreground underline underline-offset-4 hover:text-foreground"
                      onClick={() =>
                        setValues((current) => ({
                          ...current,
                          idFiles: current.idFiles.filter((_, fileIndex) => fileIndex !== index),
                        }))
                      }
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {fieldError(errors, "idFiles")}
          </div>
        ) : null}

        {step === 6 ? (
          <div className="space-y-5">
            <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Security deposit</p>
              <p className="mt-1">A refundable security deposit is required for every hire. The amount will be confirmed before your booking is finalised.</p>
            </div>
            <details className="rounded-lg border">
              <summary className="cursor-pointer px-4 py-3 font-medium">
                Read the PA Equipment Hire Terms & Conditions
              </summary>
              <div className="space-y-4 border-t px-4 py-4 text-sm text-muted-foreground">
                {hireTerms.map((term) => (
                  <div key={term.title}>
                    <p className="font-medium text-foreground">{term.title}</p>
                    <p className="mt-1">{term.body}</p>
                  </div>
                ))}
              </div>
            </details>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1 size-4 accent-primary" checked={values.termsAccepted === "accepted"} onChange={(event) => updateValue("termsAccepted", event.target.checked ? "accepted" : "")} />
              <span>I have read and agree to the PA Equipment Hire Terms & Conditions.</span>
            </label>
            {fieldError(errors, "termsAccepted")}
          </div>
        ) : null}

        {serverError ? <p className="mt-5 text-sm text-destructive">{serverError}</p> : null}

        <div className="mt-8 flex flex-wrap justify-between gap-3 border-t pt-5">
          <Button type="button" variant="outline" onClick={previousStep} disabled={step === 0 || isSubmitting}>Back</Button>
          {step < steps.length - 1 ? <Button type="button" onClick={nextStep}>Next</Button> : <Button type="button" onClick={submitBooking} disabled={isSubmitting}>{isSubmitting ? "Sending..." : "Submit booking details"}</Button>}
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, name, value, onChange, error, type = "text", placeholder, min }: { label: string; name: string; value: string; onChange: (value: string) => void; error?: string; type?: string; placeholder?: string; min?: number }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} type={type} value={value} min={min} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function DateField({ label, value, onChange, error }: { label: string; value: string; onChange: (value: string) => void; error?: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <DatePicker id={label.toLowerCase().replaceAll(" ", "-")} value={value} onChange={onChange} onBlur={() => undefined} invalid={Boolean(error)} />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
