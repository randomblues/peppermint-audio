import { z } from "zod";
import { getMelbourneToday } from "@/lib/date-utils";

export const enquirySchema = z.object({
  name: z.string().min(2, "Please enter your name"),
  email: z.string().email("Please enter a valid email"),
  phone: z.string().min(8, "Please enter a contact number"),
  eventDate: z
    .string()
    .min(1, "Please select an event date")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Please select a valid event date")
    .refine((value) => value >= getMelbourneToday(), "Event date must be today or later"),
  eventType: z.string().min(2, "Please enter event type"),
  packageInterest: z.string().min(2, "Please choose a package"),
  guestCount: z.coerce
    .number()
    .int()
    .positive("Guest count must be greater than 0")
    .max(1000, "Guest count looks too high"),
  message: z.string().min(10, "Please share a few event details"),
  website: z.string().max(0).optional(),
  attribution: z
    .object({
      gclid: z.string().max(200).optional(),
      utmSource: z.string().max(100).optional(),
      utmMedium: z.string().max(100).optional(),
      utmCampaign: z.string().max(200).optional(),
      utmTerm: z.string().max(200).optional(),
    })
    .optional(),
});

export type EnquiryFormInputValues = z.input<typeof enquirySchema>;
export type EnquiryFormValues = z.output<typeof enquirySchema>;
