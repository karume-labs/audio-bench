import { z } from "zod";
import { slugify } from "../alignment/metrics";
import type { Clip, Project } from "../types";

/**
 * The default naming template: {id}.wav
 * Can be customized per project via the `naming_template` field.
 *
 * Placeholders: {id} (7-digit script ID), {project} (project name/slug),
 * {text} (slug of the line's text), {ext} (file extension).
 */
export const defaultNamingTemplate = "{id}.wav";

/** Longest allowed stem before the extension (protects against absurd paths). */
const MAX_STEM_LENGTH = 180;

/**
 * Validate and parse a naming template string.
 * No eval — placeholders are substituted by literal replacement only.
 */
export const namingTemplateSchema = z
  .string()
  .regex(/^[\w{}.\s-]*$/, "Template contains invalid characters")
  .optional()
  .default(defaultNamingTemplate);

/** Characters that are illegal in file names on at least one desktop OS. */
// biome-ignore lint/suspicious/noControlCharactersInRegex: filename sanitization strips C0 control chars
const ILLEGAL_OS_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;

/**
 * Apply a naming template to generate a filename for a clip.
 * `{id}` resolves to the assigned line's 7-digit script ID — leading zeros
 * survive because IDs are strings throughout the pipeline.
 */
export const applyNamingTemplate = (
  template: string,
  project: Project,
  clip: Clip,
): string => {
  const parsed = namingTemplateSchema.parse(template);
  const line =
    project.script.find((sl) => sl.id === clip.script_line_id) ?? null;

  const stem = sanitizeNamingTemplate(parsed, project, clip, line);
  return `${stem}.wav`;
};

/**
 * Substitute placeholders and strip characters that are illegal on any
 * supported OS. Exported for the manifest generator.
 */
export const sanitizeNamingTemplate = (
  template: string,
  project: Project,
  clip: Clip,
  line: { script_id: string; text: string } | null,
): string => {
  const projectId = project.name
    ? slugify(project.name)
    : project.id.slice(0, 8);

  let result = template
    .replace(/\{id\}/g, line ? line.script_id : "")
    .replace(/\{project\}/g, projectId)
    .replace(/\{text\}/g, slugify(line ? line.text : ""))
    .replace(/\{ext\}/g, "wav")
    // PRD §8.2: NFC-normalize so visually identical names compare equal
    .normalize("NFC")
    // Strip any remaining illegal OS characters
    .replace(ILLEGAL_OS_CHARS, "_")
    // Collapse runs of whitespace/underscores left by sanitization
    .replace(/\s+/g, "_")
    .replace(/_{2,}/g, "_")
    // No trailing dots or spaces (Windows forbids them)
    .replace(/[.\s]+$/, "");

  if (result.length > MAX_STEM_LENGTH) {
    result = result.slice(0, MAX_STEM_LENGTH);
  }
  if (result.length === 0) {
    result = clip.id;
  }
  return result;
};

/**
 * Check for case-insensitive name collisions among a list of clips.
 * Throws if two clips resolve to the same filename (PRD §8.2).
 */
export const checkNameCollisions = (
  template: string,
  project: Project,
  clips: Clip[],
): void => {
  const seen = new Map<string, number>();

  for (let i = 0; i < clips.length; i++) {
    const lower = applyNamingTemplate(
      template,
      project,
      clips[i],
    ).toLowerCase();
    const prev = seen.get(lower);
    if (prev !== undefined) {
      throw new Error(
        `Name collision: "${lower}" (clip ${i + 1} collides with clip ${prev + 1})`,
      );
    }
    seen.set(lower, i);
  }
};
