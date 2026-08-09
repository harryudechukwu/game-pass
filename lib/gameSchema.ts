import { z } from "zod";

// Shared validation for admin game create/update.
export const gameCreateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(2000),
  imageUrl: z.string().min(1).max(500),
  pointCost: z.number().int().min(0).max(100000),
  durationSeconds: z.number().int().min(1).max(86400),
  minPlayers: z.number().int().min(1).max(100).default(1),
  maxPlayers: z.number().int().min(1).max(100).default(1),
  location: z.string().min(1).max(200),
  minAge: z.number().int().min(0).max(120).nullish(),
  minHeightCm: z.number().int().min(0).max(300).nullish(),
  instructions: z.string().max(2000).nullish(),
  rules: z.string().max(2000).nullish(),
  safety: z.string().max(2000).nullish(),
  status: z.enum(["active", "inactive", "maintenance"]).default("active"),
  selfServiceMode: z.boolean().default(true),
  featured: z.boolean().default(false),
});

export const gameUpdateSchema = gameCreateSchema.partial();
