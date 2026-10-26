import { z } from "zod";

// ==========================================
// ID Pattern (kept for backward compat with old project files; no longer
// used for script validation - there is no script anymore).
// ==========================================

/// The naming template for exported files
export const namingTemplate = z.string().optional().default("{n}.wav");

// ==========================================
// Clip Schema
// ==========================================

export const clipStatusSchema = z.enum(["proposed", "approved", "rejected"]);
export type ClipStatus = z.infer<typeof clipStatusSchema>;

export const clipFlagSchema = z.enum(["duration_outlier", "edge_clamped"]);
export type ClipFlag = z.infer<typeof clipFlagSchema>;

export const clipSchema = z.object({
  id: z.string().uuid(),
  core_start_sample: z.number().int().nonnegative(),
  core_end_sample: z.number().int().positive(),
  status: clipStatusSchema,
  flags: z.array(clipFlagSchema).optional(),
});
export type Clip = z.infer<typeof clipSchema>;

// ==========================================
// Export Settings / Source
// ==========================================

export const exportSettingsSchema = z.object({
  pre_window_s: z.number().default(5.0),
  post_window_s: z.number().default(5.0),
  fade_ms: z.number().default(5),
});
export type ExportSettings = z.infer<typeof exportSettingsSchema>;

export const sourceSchema = z.object({
  original_path: z.string(),
  master_path: z.string(),
  preview_path: z.string().optional(),
  duration_s: z.number(),
  duration_samples: z.number().int().nonnegative().optional(),
  checksum: z.string().optional(),
  warnings: z.array(z.string()).optional(),
});

// ==========================================
// Project Schema
// ==========================================

/// The full project schema validated via Zod (the `.audiobench` file).
export const projectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().optional(),
  naming_template: namingTemplate,
  export_settings: exportSettingsSchema.optional(),
  detection_min_silence_ms: z.number().nullable().optional(),
  resolved_min_silence_ms: z.number().optional(),
  source: sourceSchema,
  clips: z.array(clipSchema),
});

// Export inferred types
export type Project = z.infer<typeof projectSchema>;
export type ProjectId = Project["id"];
export type NamingTemplate = z.infer<typeof namingTemplate>;

// ==========================================
// Export Window Schema
// ==========================================

export const exportWindowSchema = z.object({
  core_start: z.number(),
  core_end: z.number(),
  export_start: z.number(),
  export_end: z.number(),
  duration_s: z.number(),
});
export type ExportWindow = z.infer<typeof exportWindowSchema>;
