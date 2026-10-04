import { z } from "zod";
import { getMelbourneToday } from "@/lib/date-utils";

export const bookingSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  firstName: z.string().min(2, "Please enter your first name"),
  lastName: z.string().min(2, "Please enter your last name"),
  mobile: z.string().min(8, "Please enter a mobile number"),
  eventType: z.string().min(2, "Please enter the event type"),
  eventAddress: z.string().min(5, "Please enter the event address"),
  pickupDate: z
    .string()
    .min(1, "Please select a pickup date")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Please select a valid pickup date")
    .refine((value) => value >= getMelbourneToday(), "Pickup date must be today or later"),
  dropoffDate: z
    .string()
    .min(1, "Please select a drop-off date")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Please select a valid drop-off date")
    .refine((value) => value >= getMelbourneToday(), "Drop-off date must be today or later"),
  pickupTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Please select a valid pickup time"),
  dropoffTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Please select a valid drop-off time"),
  hireLineItems: z.string().min(2, "Please select at least one hire item").max(12000, "Please keep the hire item list under 12000 characters"),
  additionalDetails: z.string().max(3000, "Please keep additional details under 3000 characters"),
  termsAccepted: z.string().refine(
    (value) => value === "accepted",
    "Please confirm that you have read and agree to the terms",
  ),
}).superRefine((values, context) => {
  if (values.dropoffDate < values.pickupDate) {
    context.addIssue({
      code: "custom",
      path: ["dropoffDate"],
      message: "Drop-off date must be on or after pickup date",
    });
  }
  if (values.dropoffDate === values.pickupDate && values.dropoffTime < values.pickupTime) {
    context.addIssue({
      code: "custom",
      path: ["dropoffTime"],
      message: "Drop-off time must be after pickup time when dates are the same",
    });
  }
});

export type BookingInputValues = z.input<typeof bookingSchema>;
export type BookingValues = z.output<typeof bookingSchema>;
