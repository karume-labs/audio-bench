import { z } from "zod";
import { orderedClips } from "../alignment/clipops";
import { slugify } from "../alignment/metrics";
import type { Clip, Project } from "../types";

/** The default naming template: {n}.wav (1-based clip index). */
export const defaultNamingTemplate = "{n}.wav";

/** Longest allowed stem before the extension. */
const MAX_STEM_LENGTH = 180;

/** Validate and parse a naming template string. */
export const namingTemplateSchema = z
  .string()
  .regex(/^[\w{}.\\s-]*$/, "Template contains invalid characters")
  .optional()
  .default(defaultNamingTemplate);

/** Characters that are illegal in file names on at least one desktop OS. */
// biome-ignore lint/suspicious/noControlCharactersInRegex: filename sanitization strips C0 control chars
const ILLEGAL_OS_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;

/**
 * Apply a naming template to generate a filename for a clip.
 * `{n}` resolves to the clip's 1-based index in time order.
 */
export const applyNamingTemplate = (
  template: string,
  project: Project,
  clip: Clip,
): string => {
  const parsed = namingTemplateSchema.parse(template);
  const stem = sanitizeNamingTemplate(parsed, project, clip);
  return `${stem}.wav`;
};

export const sanitizeNamingTemplate = (
  template: string,
  project: Project,
  clip: Clip,
): string => {
  const projectId = project.name
    ? slugify(project.name)
    : project.id.slice(0, 8);
  const index =
    orderedClips(project.clips).findIndex((c) => c.id === clip.id) + 1;

  let result = template
    .replace(/\{n\}/g, String(index))
    .replace(/\{project\}/g, projectId)
    .replace(/\{ext\}/g, "wav")
    .normalize("NFC")
    .replace(ILLEGAL_OS_CHARS, "_")
    .replace(/\s+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/[.\s]+$/, "");

  if (result.length > MAX_STEM_LENGTH) {
    result = result.slice(0, MAX_STEM_LENGTH);
  }
  if (result.length === 0) {
    result = `clip_${index}`;
  }
  return result;
};

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
