import { Group, Kbd, Text, Title, VisuallyHidden } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { IconUpload } from "@tabler/icons-react";
import { dropAnnouncement, dropCopy } from "../lib/dropKind";
import { useDropZoneStore } from "../stores/useDropZoneStore";
import { useProjectStore } from "../stores/useProjectStore";

/**
 * Window-level drop overlay.
 *
 * Structure mirrors Claude's file drop: a neutral scrim over the whole
 * window with one inset, rounded, dashed drop area containing an icon, a
 * title and a single-line hint. Everything is opaque - the scrim is a
 * separate background layer so the copy never sits on a translucent colour.
 *
 * Teal appears only as the dashed border and the icon; every surface and
 * every glyph colour comes from the theme. The element stays mounted and
 * fades via opacity so both show and hide animate, and the fade is dropped
 * entirely under `prefers-reduced-motion`.
 */
export default function DropzoneOverlay() {
  const isDragging = useDropZoneStore((s) => s.isDragging);
  const dropKind = useDropZoneStore((s) => s.dropKind);
  const hasProject = useProjectStore((s) => s.project !== null);
  const busy = useProjectStore((s) => s.busy || s.exporting);

  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const copy = dropCopy(dropKind, { hasProject, busy });
  const accent = copy.accept ? "var(--mantine-color-teal-6)" : undefined;

  return (
    <>
      <VisuallyHidden>
        <span aria-live="polite">{dropAnnouncement(copy, isDragging)}</span>
      </VisuallyHidden>

      <div
        data-dropzone-overlay
        aria-hidden={!isDragging}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          background: "var(--ab-dropzone-scrim)",
          opacity: isDragging ? 1 : 0,
          visibility: isDragging ? "visible" : "hidden",
          pointerEvents: isDragging ? "auto" : "none",
          transition: reducedMotion
            ? undefined
            : "opacity 140ms ease, visibility 140ms ease",
        }}
      >
        <div
          style={{
            width: "min(560px, 100%)",
            padding: "40px 32px",
            borderRadius: 20,
            background: "var(--mantine-color-default)",
            border: "2px dashed",
            borderColor: accent ?? "var(--mantine-color-default-border)",
            color: "var(--mantine-color-text)",
            textAlign: "center",
            boxShadow: "var(--mantine-shadow-sm)",
          }}
        >
          <IconUpload
            size={34}
            stroke={1.75}
            // `color` as an SVG attribute can't resolve CSS vars; set it on
            // the style so the teal accent (or dimmed fallback) applies.
            style={{
              display: "block",
              margin: "0 auto 14px",
              color: accent ?? "var(--mantine-color-dimmed)",
            }}
          />

          <Title order={3} style={{ marginBottom: 6 }}>
            {copy.title}
          </Title>

          <Text size="sm" c="dimmed" maw={420} mx="auto">
            {copy.hint}
          </Text>

          {/* The type list is skipped when the hint above already spells
              it out (the generic copy lists the accepted formats), to
              avoid saying it twice. */}
          {!copy.hint.includes("WAV") && (
            <Text size="xs" c="dimmed" mt={14}>
              Accepts{" "}
              <Text span ff="monospace">
                WAV · FLAC · MP3 · M4A
              </Text>{" "}
              and{" "}
              <Text span ff="monospace">
                .audiobench
              </Text>{" "}
              files
            </Text>
          )}

          <Group justify="center" gap={6} mt={18}>
            <Text size="xs" c="dimmed">
              Press
            </Text>
            <Kbd size="xs">Esc</Kbd>
            <Text size="xs" c="dimmed">
              to dismiss
            </Text>
          </Group>
        </div>
      </div>
    </>
  );
}
