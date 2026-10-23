import { z } from "zod";
export const categoryIds = [
  "fruits-vegetables",
  "dairy-eggs",
  "bakery",
  "beverages",
  "pantry-staples",
  "snacks",
  "meat-seafood",
  "frozen-foods",
  "personal-care",
  "baby-care",
] as const;
export const emailSchema = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((v) => v.toLowerCase());
export const credentialsSchema = z.object({
  email: emailSchema,
  password: z.string().min(10, "Use at least 10 characters.").max(128),
});
export const registerSchema = credentialsSchema.extend({
  name: z.string().trim().min(2).max(80),
});
export const addressSchema = z.object({
  label: z.string().trim().min(1).max(30).default("Home"),
  name: z.string().trim().min(2).max(80),
  phone: z
    .string()
    .trim()
    .regex(/^[+\d\s()-]{7,24}$/, "Enter a valid phone number."),
  street: z.string().trim().min(5).max(200),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  zip: z.string().trim().min(3).max(16),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
});
export const checkoutSchema = z
  .object({
    items: z
      .array(
        z.object({
          productId: z.string().min(1).max(80),
          quantity: z.number().int().min(1).max(50),
        }),
      )
      .min(1)
      .max(50),
    address: addressSchema,
    payment: z.enum(["cash", "card"]),
    coupon: z.string().max(30).default(""),
    idempotencyKey: z.string().uuid(),
  })
  .superRefine((v, c) => {
    if (new Set(v.items.map((i) => i.productId)).size !== v.items.length)
      c.addIssue({
        code: "custom",
        message: "Duplicate products are not allowed.",
        path: ["items"],
      });
  });
export const productSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().min(5).max(2000),
    category: z.enum(categoryIds),
    image: z
      .string()
      .regex(
        /^(\/images\/[a-zA-Z0-9_.-]+\.(webp|png|jpe?g)|\/api\/media\/[0-9a-f-]{36})$/,
        "Choose or upload a product image.",
      ),
    price: z.number().int().min(1).max(1000000),
    originalPrice: z.number().int().min(1).max(1000000),
    unit: z.string().trim().min(1).max(30),
    stock: z.number().int().min(0).max(100000),
    organic: z.boolean(),
    active: z.boolean().default(true),
  })
  .refine((v) => v.originalPrice >= v.price, {
    message: "Original price must be at least the selling price.",
    path: ["originalPrice"],
  });
export const partnerSchema = registerSchema.extend({
  phone: z.string().min(7).max(24),
  vehicle: z.enum(["bike", "scooter", "car"]),
});
