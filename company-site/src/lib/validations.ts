import { z } from "zod";

// ── Shared helpers ──────────────────────────────────────────────────

/** DNA sequence: only ATCG characters, whitespace stripped */
const dnaSequence = z
  .string()
  .transform((s) => s.trim().toUpperCase())
  .pipe(z.string().min(1, "Sequence is required").regex(/^[ATCG]+$/, "Sequence must contain only A, T, C, G characters"));

// ── Product schemas ─────────────────────────────────────────────────

export const createProductSchema = z.object({
  name: z.string().min(1, "Name is required").max(500),
  description: z.string().max(10000).optional().nullable(),
  price: z.number().int("Price must be in cents (whole number)").min(0, "Price cannot be negative"),
  imageUrl: z.string().url("Must be a valid URL").max(2000).optional().nullable(),
  active: z.boolean().optional().default(true),
});

export const updateProductSchema = createProductSchema.partial();

// ── Profile schema ──────────────────────────────────────────────────

export const updateProfileSchema = z.object({
  name: z.string().max(200).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  address1: z.string().max(500).optional().nullable(),
  address2: z.string().max(500).optional().nullable(),
  city: z.string().max(200).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  zip: z.string().max(20).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
});

// ── Twist construct schemas ─────────────────────────────────────────

export const createClonedConstructSchema = z.object({
  sequences: z.array(dnaSequence).min(1, "At least one sequence required").max(10),
  name: z.string().min(1).max(500),
  type: z.literal("CLONED_GENE").optional().default("CLONED_GENE"),
  vector_mes_uid: z.string().min(1, "Vector UID is required"),
  insertion_point_mes_uid: z.string().min(1, "Insertion point UID is required"),
});

export const createFragmentConstructSchema = z.object({
  sequences: z.array(dnaSequence).min(1, "At least one sequence required").max(10),
  name: z.string().min(1).max(500),
  type: z.literal("NON_CLONED_GENE"),
});

export const createConstructSchema = z.discriminatedUnion("type", [
  createClonedConstructSchema,
  createFragmentConstructSchema,
]);

// ── Utility: format Zod errors for API responses ────────────────────

export function formatZodError(error: z.ZodError<unknown>) {
  return {
    error: "Invalid input",
    details: error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    })),
  };
}
