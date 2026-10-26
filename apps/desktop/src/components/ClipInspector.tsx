import { createExportWindow } from "@audio-bench/domain";
import {
  Alert,
  Badge,
  Button,
  Divider,
  Group,
  Kbd,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { formatTimecode, samplesToSeconds } from "../lib/format";
import { useEditorStore } from "../stores/useEditorStore";
import { useProjectStore } from "../stores/useProjectStore";

import { STATUS_TIP } from "../lib/statusTip";
import { CLIP_STATUS_COLOR } from "../theme";
import Tip from "./Tip";

const statusColor = (status: string): string =>
  CLIP_STATUS_COLOR[status as keyof typeof CLIP_STATUS_COLOR] ?? "gray";

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

export default function ClipInspector() {
  const project = useProjectStore((s) => s.project);
  const setClipStatus = useProjectStore((s) => s.setClipStatus);
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

  const durationSamples = project.source.duration_samples ?? 0;
  const win = createExportWindow(
    clip.core_start_sample,
    clip.core_end_sample,
    durationSamples,
  );
  const flags = clip.flags ?? [];

  return (
    <ScrollArea type="auto" h="100%">
      <Stack gap="sm" p="sm">
        <Group justify="space-between" align="flex-start">
          <div>
            <Text size="xs" c="dimmed">
              Clip
            </Text>
            <Title order={2} ff="monospace">
              #{project.clips.findIndex((c) => c.id === clip.id) + 1}
            </Title>
          </div>
          <Tip
            label={`Status: ${clip.status}`}
            description={STATUS_TIP[clip.status]}
          >
            <Badge color={statusColor(clip.status)} size="lg" variant="light">
              {clip.status}
            </Badge>
          </Tip>
        </Group>

        {flags.includes("edge_clamped") && (
          <Alert color="yellow" title="Edge clamped">
            The export window runs into the recording edge - silence will be
            padded to guarantee the full 5s lead-in/out.
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
          <Tip
            label="Approve"
            description="Mark this clip as reviewed and ready to export."
          >
            <Button
              size="xs"
              color="green"
              onClick={() => setClipStatus(clip.id, "approved")}
              disabled={clip.status === "approved"}
            >
              Approve (A)
            </Button>
          </Tip>
          <Tip
            label="Reject"
            description="Exclude this clip from the export. It stays in the table and can be restored."
          >
            <Button
              size="xs"
              color="red"
              variant="light"
              onClick={() => setClipStatus(clip.id, "rejected")}
              disabled={clip.status === "rejected"}
            >
              Reject (R)
            </Button>
          </Tip>
          {clip.status === "rejected" && (
            <Tip
              label="Restore"
              description="Return a rejected clip to proposed so it is exported again."
            >
              <Button
                size="xs"
                variant="outline"
                onClick={() => setClipStatus(clip.id, "proposed")}
              >
                Restore
              </Button>
            </Tip>
          )}
        </Group>
        <Group gap="xs">
          <Tip
            label="Merge with next"
            description="Join this clip with the one after it - useful when a pause was cut in the middle of a line."
          >
            <Button
              size="xs"
              variant="light"
              onClick={() => mergeActiveWithNext(clip.id)}
            >
              Merge next (M)
            </Button>
          </Tip>
          <Tip
            label="Split at playhead"
            description="Cut this clip at the playhead position. Click the waveform to place the playhead first."
          >
            <Button
              size="xs"
              variant="light"
              onClick={() =>
                splitClipAt(
                  Math.round(useEditorStore.getState().playhead * 48_000),
                )
              }
            >
              Split @ playhead (S)
            </Button>
          </Tip>
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
