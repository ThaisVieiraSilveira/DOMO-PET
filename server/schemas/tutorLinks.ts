import { z } from "zod";

export const generateLinkSchema = z.object({
  tenantId: z.string().min(1).max(64),
  petId: z.string().min(1).max(64),
  expiresInDays: z.number().int().min(1).max(365).default(30),
}).strict();

export const revokeLinkSchema = z.object({
  tenantId: z.string().min(1).max(64),
  petId: z.string().min(1).max(64),
}).strict();

export const syncSummarySchema = z.object({
  tenantId: z.string().min(1).max(64),
  petId: z.string().min(1).max(64),
}).strict();
