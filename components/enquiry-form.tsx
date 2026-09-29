"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trackGoogleAdsConversion } from "@/lib/google-ads";
import { packageTiers } from "@/lib/site-content";
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
      packageInterest: packageName ?? packageTiers[1]?.name ?? "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);

    const response = await fetch("/api/enquiry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

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
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
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
            <div className="space-y-1.5">
              <Label htmlFor="guestCount">Estimated Guests</Label>
              <Input
                id="guestCount"
                className="h-10"
                type="number"
                min={1}
                {...register("guestCount")}
              />
              {errors.guestCount ? <p className="text-xs text-destructive">{errors.guestCount.message}</p> : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="packageInterest">Package Interest</Label>
            <Controller
              control={control}
              name="packageInterest"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="packageInterest" className="h-10 w-full">
                    <SelectValue placeholder="Select a package" />
                  </SelectTrigger>
                  <SelectContent align="start">
                    {packageTiers.map((pkg) => (
                      <SelectItem key={pkg.slug} value={pkg.name}>
                        {pkg.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="Custom package">Custom package</SelectItem>
                    <SelectItem value="Not sure yet">Not sure yet</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.packageInterest ? (
              <p className="text-xs text-destructive">{errors.packageInterest.message}</p>
            ) : null}
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
