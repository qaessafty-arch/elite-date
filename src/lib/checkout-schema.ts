import { z } from 'zod';

/** Shared by the checkout form (instant feedback) and the server action (the check that counts). */
export const contactSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address, like name@example.com.').max(200),
  firstName: z.string().trim().min(1, 'Enter your first name.').max(80),
  lastName: z.string().trim().min(1, 'Enter your last name.').max(80),
  phone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[+\d][\d\s().-]{5,}$/, 'Enter a phone number with digits only, like +1 555 010 0199.')
    .or(z.literal(''))
    .optional(),
});

export const addressSchema = z.object({
  line1: z.string().trim().min(3, 'Enter your street address.').max(120),
  line2: z.string().trim().max(120).optional(),
  city: z.string().trim().min(1, 'Enter your city.').max(80),
  region: z.string().trim().max(80).optional(),
  postalCode: z.string().trim().min(2, 'Enter your postal code.').max(16),
  country: z.string().length(2, 'Choose a country.'),
});

export const checkoutSchema = contactSchema.merge(addressSchema).extend({
  shippingMethodId: z.string().uuid('Choose a delivery method.'),
  provider: z.enum(['stripe', 'demo'], { message: 'Choose how you want to pay.' }),
  saveAddress: z.boolean().optional(),
});

export type CheckoutValues = z.infer<typeof checkoutSchema>;

export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
