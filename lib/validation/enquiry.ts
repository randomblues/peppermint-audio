import { z } from "zod";

export const enquirySchema = z.object({
  name: z.string().min(2, "Please enter your name"),
  email: z.string().email("Please enter a valid email"),
  phone: z.string().min(8, "Please enter a contact number"),
  eventDate: z.string().min(1, "Please select an event date"),
  eventType: z.string().min(2, "Please enter event type"),
  packageInterest: z.string().min(2, "Please choose a package"),
  guestCount: z.coerce
    .number()
    .int()
    .positive("Guest count must be greater than 0")
    .max(1000, "Guest count looks too high"),
  message: z.string().min(10, "Please share a few event details"),
});

export type EnquiryFormInputValues = z.input<typeof enquirySchema>;
export type EnquiryFormValues = z.output<typeof enquirySchema>;


