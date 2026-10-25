import { createExportWindow } from "@audio-bench/domain";
import {
  Alert,
  Badge,
  Button,
  Divider,
  Group,
  Kbd,
  Paper,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { memo } from "react";
import { formatTimecode, samplesToSeconds } from "../lib/format";
import { useEditorStore } from "../stores/useEditorStore";
import { useProjectStore } from "../stores/useProjectStore";

const statusColor = (status: string): string =>
  status === "approved" ? "green" : status === "rejected" ? "red" : "orange";

function Field({
  label,
  value,
  mono,
}: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={500} ff={mono ? "monospace" : undefined}>
        {value}
      </Text>
    </div>
  );
}

function ClipInspector() {
  const project = useProjectStore((s) => s.project);
  const setClipStatus = useProjectStore((s) => s.setClipStatus);
  const toggleAnchorOp = useProjectStore((s) => s.toggleAnchorOp);
  const skipLine = useProjectStore((s) => s.skipLine);
  const mergeActiveWithNext = useProjectStore((s) => s.mergeActiveWithNext);
  const splitClipAt = useProjectStore((s) => s.splitClipAt);

  const activeClipId = useEditorStore((s) => s.activeClipId);
  const sort = useEditorStore((s) => s.sort);

  if (!project) {
    return (
      <Text size="sm" c="dimmed">
        Load a session to inspect clips.
      </Text>
    );
  }

  const clip = project.clips.find((c) => c.id === activeClipId) ?? null;
  if (!clip) {
    return (
      <Text size="sm" c="dimmed">
        Select a clip in the table or on the waveform.
      </Text>
    );
  }

  const line = clip.script_line_id
    ? (project.script.find((l) => l.id === clip.script_line_id) ?? null)
    : null;
  const durationSamples = project.source.duration_samples ?? 0;
  const win = createExportWindow(
    clip.core_start_sample,
    clip.core_end_sample,
    durationSamples,
  );
  const flags = clip.flags ?? [];

  return (
    <ScrollArea type="auto" h="100%">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start">
          <div>
            <Text size="xs" c="dimmed">
              Script ID
            </Text>
            <Title order={2} ff="monospace">
              {line ? line.script_id : "—"}
            </Title>
          </div>
          <Badge color={statusColor(clip.status)} size="lg" variant="light">
            {clip.status}
          </Badge>
        </Group>

        <Paper withBorder p="xs">
          <Text size="xs" c="dimmed" mb={4}>
            Expected text
          </Text>
          <Text size="sm">{line ? line.text : "No script line assigned"}</Text>
        </Paper>

        {flags.includes("duration_outlier") && (
          <Alert color="red" title="Duration outlier">
            This clip's length doesn't match the expected reading speed for its
            text — check for a missed split or merged take.
          </Alert>
        )}
        {flags.includes("edge_clamped") && (
          <Alert color="yellow" title="Edge clamped">
            The export window runs into the recording edge — silence will be
            padded to guarantee the full 5s lead-in/out.
          </Alert>
        )}
        {!line && (
          <Alert color="orange" title="Unassigned">
            No script line for this clip. Use Skip ID on a line, or split/merge
            to re-align.
          </Alert>
        )}

        <SimpleGrid cols={2} spacing="xs">
          <Field
            label="Core start"
            value={formatTimecode(samplesToSeconds(clip.core_start_sample))}
            mono
          />
          <Field
            label="Core end"
            value={formatTimecode(samplesToSeconds(clip.core_end_sample))}
            mono
          />
          <Field
            label="Core duration"
            value={`${((clip.core_end_sample - clip.core_start_sample) / 48000).toFixed(3)}s`}
            mono
          />
          <Field label="Anchor" value={clip.anchored ? "locked" : "free"} />
          <Field
            label="Export window"
            value={`${formatTimecode(samplesToSeconds(win.window.export_start))} → ${formatTimecode(
              samplesToSeconds(win.window.export_end),
            )}`}
            mono
          />
          <Field
            label="Window length"
            value={`${win.window.duration_s.toFixed(3)}s`}
            mono
          />
        </SimpleGrid>

        <Divider />
        <Group gap="xs">
          <Button
            size="xs"
            color="green"
            onClick={() => setClipStatus(clip.id, "approved")}
            disabled={clip.status === "approved"}
          >
            Approve (A)
          </Button>
          <Button
            size="xs"
            color="red"
            variant="light"
            onClick={() => setClipStatus(clip.id, "rejected")}
            disabled={clip.status === "rejected"}
          >
            Reject (R)
          </Button>
          {clip.status === "rejected" && (
            <Button
              size="xs"
              variant="outline"
              onClick={() => setClipStatus(clip.id, "proposed")}
            >
              Restore
            </Button>
          )}
        </Group>
        <Group gap="xs">
          <Button
            size="xs"
            variant={clip.anchored ? "filled" : "outline"}
            color="grape"
            onClick={() => toggleAnchorOp(clip.id)}
          >
            {clip.anchored ? "Unanchor (L)" : "Anchor (L)"}
          </Button>
          <Button
            size="xs"
            variant="light"
            onClick={() => line && skipLine(line.id)}
            disabled={!line}
          >
            Skip line (K)
          </Button>
          <Button
            size="xs"
            variant="light"
            onClick={() => mergeActiveWithNext(clip.id)}
          >
            Merge next (M)
          </Button>
          <Button
            size="xs"
            variant="light"
            onClick={() =>
              // Read the playhead lazily: subscribing here would re-render the
              // inspector on every timeupdate tick during playback.
              splitClipAt(
                Math.round(useEditorStore.getState().playhead * 48_000),
              )
            }
          >
            Split @ playhead (S)
          </Button>
        </Group>

        <Divider />
        <div>
          <Text size="xs" c="dimmed" mb={4}>
            Keyboard
          </Text>
          <Stack gap={3}>
            <Group gap={6}>
              <Kbd>Space</Kbd>
              <Text size="xs">play / pause</Text>
            </Group>
            <Group gap={6}>
              <Kbd>Shift</Kbd>
              <Kbd>Space</Kbd>
              <Text size="xs">audition export window</Text>
            </Group>
            <Group gap={6}>
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
              <Text size="xs">previous / next clip</Text>
            </Group>
            <Group gap={6}>
              <Kbd>S</Kbd>
              <Kbd>M</Kbd>
              <Kbd>A</Kbd>
              <Text size="xs">split · merge · approve</Text>
            </Group>
          </Stack>
        </div>
        <Text size="xs" c="dimmed">
          Sort: {sort.by} {sort.dir}
        </Text>
      </Stack>
    </ScrollArea>
  );
}

export default memo(ClipInspector);
