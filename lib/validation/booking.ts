import { z } from "zod";

export const bookingSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  firstName: z.string().min(2, "Please enter your first name"),
  lastName: z.string().min(2, "Please enter your last name"),
  mobile: z.string().min(8, "Please enter a mobile number"),
  eventType: z.string().min(2, "Please enter the event type"),
  eventAddress: z.string().min(5, "Please enter the event address"),
  pickupDate: z.string().min(1, "Please select a pickup date"),
  dropoffDate: z.string().min(1, "Please select a drop-off date"),
  packageInterest: z.string().min(2, "Please select a package"),
  addOns: z.string().default(""),
  guestCount: z.coerce
    .number()
    .int()
    .positive("Guest count must be greater than 0")
    .max(1000, "Guest count looks too high"),
  additionalDetails: z.string().max(3000, "Please keep additional details under 3000 characters"),
  termsAccepted: z.string().refine(
    (value) => value === "accepted",
    "Please confirm that you have read and agree to the terms",
  ),
});

export type BookingFormInputValues = z.input<typeof bookingSchema>;
export type BookingFormValues = z.output<typeof bookingSchema>;
