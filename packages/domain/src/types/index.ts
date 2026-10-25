import { z } from "zod";

// ==========================================
// ID Pattern
// ==========================================

/// Validation regex for script IDs: exactly 7 digits, preserving leading zeros.
/// IDs are strings, never integers — leading zeros must survive the whole pipeline.
export const idPattern = z
  .string()
  .regex(/^\d{7}$/, "ID must be exactly 7 digits");

/// Default `id_pattern` stored on a project (PRD §7).
export const DEFAULT_ID_PATTERN = "^\\d{7}$";

/// The naming template for exported files
export const namingTemplate = z.string().optional().default("{id}.wav");

// ==========================================
// Script Line Schema
// ==========================================

/**
 * A single line of the reference script.
 * PRD §7: `(uuid, script_id_string, text, position)` — the internal `id` is a
 * UUID used for cross-referencing by clips, while `script_id` is the 7-digit
 * spreadsheet ID that must survive import/export byte-for-byte.
 */
export const scriptLineSchema = z.object({
  id: z.string().uuid(),
  script_id: idPattern,
  text: z.string(),
  position: z.number().optional(),
  skipped: z.boolean().optional().default(false),
});
export type ScriptLine = z.infer<typeof scriptLineSchema>;

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
  script_line_id: z.string().uuid().nullable(),
  status: clipStatusSchema,
  flags: z.array(clipFlagSchema).optional(),
  /** Anchor: locks this clip to its assigned script line during re-assignment. */
  anchored: z.boolean().optional().default(false),
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
  id_pattern: z.string().default(DEFAULT_ID_PATTERN),
  export_settings: exportSettingsSchema.optional(),
  source: sourceSchema,
  script: z.array(scriptLineSchema),
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
