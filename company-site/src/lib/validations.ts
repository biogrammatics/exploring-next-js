import { z } from "zod";
import type { OrderStatus, QuoteStatus } from "@/generated/prisma/client";
import { ORDER_STATUSES } from "@/lib/order-status";
import { QUOTE_STATUSES, MAX_ADMIN_NOTES_LENGTH } from "@/lib/quote-status";

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

// ── SMS / 2FA schemas ───────────────────────────────────────────────

/** Phone number: digits, spaces, dashes, parens, optional + prefix */
const phoneNumber = z
  .string()
  .min(1, "Phone number is required")
  .max(20)
  .regex(/^\+?[\d\s\-()]+$/, "Invalid phone number format");

export const sendTestSmsSchema = z.object({
  phone: phoneNumber,
  message: z.string().min(1, "Message is required").max(1600, "SMS messages cannot exceed 1600 characters"),
});

export const verifyOtpSchema = z.object({
  token: z.string().min(1, "Token is required"),
  code: z.string().length(6, "Code must be 6 digits").regex(/^\d{6}$/, "Code must be 6 digits"),
});

export const phoneSetupSchema = z.object({
  phone: phoneNumber,
});

export const resendCodeSchema = z.object({
  token: z.string().min(1, "Token is required"),
});

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

// ── Order schemas ───────────────────────────────────────────────────

export const updateOrderStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES as [OrderStatus, ...OrderStatus[]]),
});

// ── Service quote schemas ───────────────────────────────────────────

/**
 * Admin edits to a service quote. Both fields are optional so the form can
 * send a status change, a note, or both.
 *
 * The customer's own submitted details (address, protein, design) are NOT
 * editable: that block is the record of what they asked for, and silently
 * rewriting it would lose the only account of the request. Corrections belong
 * in adminNotes.
 *
 * `expectedStatus` is what the admin's screen was showing. The handler applies
 * the change only while the row still holds it, so a stale tab cannot
 * overwrite a colleague's edit.
 */
export const updateQuoteSchema = z
  .object({
    status: z.enum(QUOTE_STATUSES as [QuoteStatus, ...QuoteStatus[]]).optional(),
    expectedStatus: z
      .enum(QUOTE_STATUSES as [QuoteStatus, ...QuoteStatus[]])
      .optional(),
    adminNotes: z.string().max(MAX_ADMIN_NOTES_LENGTH).nullable().optional(),
  })
  .refine((v) => v.status !== undefined || v.adminNotes !== undefined, {
    message: "Provide a status, a note, or both",
  })
  .refine((v) => v.status === undefined || v.expectedStatus !== undefined, {
    message: "A status change must say which status it is replacing",
  });
