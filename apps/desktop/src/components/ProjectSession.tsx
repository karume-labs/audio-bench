import { ProjectProfile } from "@/components/ProjectProfile";
import { Tip } from "@/components/Tip";
import { pickDirectory } from "@/ipc/commands";
import { formatDuration } from "@/lib/format";
import { notifyError } from "@/lib/notify";
import { useEditorStore } from "@/stores/useEditorStore";
import { useProjectStore } from "@/stores/useProjectStore";
import { orderedClips } from "@audio-bench/domain";
import {
  Alert,
  Button,
  Divider,
  Group,
  List,
  Stack,
  Text,
} from "@mantine/core";
import { IconPlayerPlay } from "@tabler/icons-react";

export const ProjectSession = () => {
  const project = useProjectStore((s) => s.project);
  const busy = useProjectStore((s) => s.busy);
  const exporting = useProjectStore((s) => s.exporting);
  const exportBlockers = useProjectStore((s) => s.exportBlockers);
  const executeExport = useProjectStore((s) => s.executeExport);
  const activeClipId = useEditorStore((s) => s.activeClipId);

  if (!project) return null;

  const clipCount = project.clips.length;
  const activeCount = orderedClips(project.clips).filter(
    (c) => c.status !== "rejected",
  ).length;

  const onExport = (): void => {
    const blocker = exportBlockers();
    if (blocker) {
      notifyError("Export blocked", blocker);
      return;
    }
    void (async () => {
      try {
        const dir = await pickDirectory("Choose export folder");
        if (dir) await executeExport(dir);
      } catch (err) {
        notifyError("Export failed", err);
      }
    })();
  };

  const gate = exportBlockers();

  return (
    <>
      <Divider />
      <Text fw={700} size="sm">
        Session
      </Text>
      <Stack gap={4}>
        <Group justify="space-between">
          <Text size="xs" c="dimmed">
            Duration
          </Text>
          <Text size="xs" ff="monospace">
            {formatDuration(project.source.duration_s)}
          </Text>
        </Group>
        <Tip
          label="Conformed master"
          description="The source is rewritten as 24-bit / 48 kHz mono WAV beside the original; the waveform and every export read this file."
        >
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              Master
            </Text>
            <Text size="xs" ff="monospace">
              24-bit / 48 kHz mono
            </Text>
          </Group>
        </Tip>
        <Group justify="space-between">
          <Text size="xs" c="dimmed">
            Clips
          </Text>
          <Text size="xs" ff="monospace">
            {clipCount}
            {clipCount !== activeCount
              ? ` (${clipCount - activeCount} rejected)`
              : ""}
          </Text>
        </Group>
        <Group justify="space-between">
          <Text size="xs" c="dimmed">
            Active clip
          </Text>
          <Text size="xs" ff="monospace">
            {activeClipId
              ? `#${project.clips.findIndex((c) => c.id === activeClipId) + 1}`
              : "-"}
          </Text>
        </Group>
      </Stack>

      {(project.source.warnings?.length ?? 0) > 0 && (
        <Alert color="yellow" title="Conform warnings">
          <List size="xs" spacing={2}>
            {project.source.warnings?.map((w) => (
              <List.Item key={w}>{w}</List.Item>
            ))}
          </List>
        </Alert>
      )}

      <Tip
        label="Export clips"
        description="Choose a folder, then write every non-rejected clip plus manifest.csv and alignment_report.csv."
      >
        <Button
          leftSection={<IconPlayerPlay size={16} />}
          color="green"
          onClick={onExport}
          loading={exporting}
          disabled={busy || exporting}
          fullWidth
        >
          Export clips
        </Button>
      </Tip>

      {gate && (
        <Alert color="red" title="Export blocked">
          {gate}
        </Alert>
      )}

      <ProjectProfile />
    </>
  );
};
