"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/date-picker";
import { Textarea } from "@/components/ui/textarea";
import { trackGoogleAdsConversion } from "@/lib/google-ads";
import { getMelbourneToday } from "@/lib/date-utils";
import {
  enquirySchema,
  type EnquiryFormInputValues,
  type EnquiryFormValues,
} from "@/lib/validation/enquiry";

type EnquiryFormProps = {
  packageName?: string;
  heading?: string;
  description?: string;
  submitLabel?: string;
};

export function EnquiryForm({
  packageName,
  heading = "Send us a message",
  description,
  submitLabel = "Send enquiry",
}: EnquiryFormProps) {
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<EnquiryFormInputValues, unknown, EnquiryFormValues>({
    resolver: zodResolver(enquirySchema),
    defaultValues: {
      eventDate: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);

    let attribution: EnquiryFormValues["attribution"];
    if (typeof window !== "undefined") {
      try {
        const stored = window.sessionStorage.getItem("peppermint-marketing-attribution");
        const parsed = stored ? (JSON.parse(stored) as Record<string, string>) : {};
        attribution = {
          gclid: parsed.gclid,
          utmSource: parsed.utm_source,
          utmMedium: parsed.utm_medium,
          utmCampaign: parsed.utm_campaign,
          utmTerm: parsed.utm_term,
        };
      } catch {
        attribution = undefined;
      }
    }

    let response: Response;
    try {
      response = await fetch("/api/enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, attribution }),
      });
    } catch {
      setServerError("Could not send enquiry right now. Please check your connection and try again.");
      return;
    }

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setServerError(payload?.error ?? "Could not send enquiry right now.");
      return;
    }

    reset();
    setSubmitted(true);
    trackGoogleAdsConversion();
  });

  if (submitted) {
    return (
      <Card className="border">
        <CardHeader>
          <CardTitle>Enquiry sent</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Thanks, your enquiry has been sent. We will get back to you shortly.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border">
      <CardHeader>
        <CardTitle>{heading}</CardTitle>
        {description || packageName ? (
          <p className="text-sm text-muted-foreground">
            {description ?? `Tell us about your ${packageName} hire and we will help with availability and pricing.`}
          </p>
        ) : null}
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="absolute -left-[9999px]" aria-hidden="true">
            <Label htmlFor="website">Website</Label>
            <Input id="website" tabIndex={-1} autoComplete="off" {...register("website")} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" className="h-10" {...register("name")} />
              {errors.name ? <p className="text-xs text-destructive">{errors.name.message}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" className="h-10" type="email" {...register("email")} />
              {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" className="h-10" {...register("phone")} />
              {errors.phone ? <p className="text-xs text-destructive">{errors.phone.message}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eventDate">Event Date</Label>
              <Controller
                control={control}
                name="eventDate"
                render={({ field }) => (
                  <DatePicker
                    id="eventDate"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    minDate={getMelbourneToday()}
                    invalid={Boolean(errors.eventDate)}
                  />
                )}
              />
              {errors.eventDate ? <p className="text-xs text-destructive">{errors.eventDate.message}</p> : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="eventType">Event Type</Label>
              <Input
                id="eventType"
                className="h-10"
                placeholder="Wedding, birthday, function..."
                {...register("eventType")}
              />
              {errors.eventType ? <p className="text-xs text-destructive">{errors.eventType.message}</p> : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="message">Event Details</Label>
            <Textarea
              id="message"
              className="min-h-28"
              placeholder="Tell us your venue, timing, and anything else useful."
              {...register("message")}
            />
            {errors.message ? <p className="text-xs text-destructive">{errors.message.message}</p> : null}
          </div>

          {serverError ? <p className="text-sm text-destructive">{serverError}</p> : null}

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Sending..." : submitLabel}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
