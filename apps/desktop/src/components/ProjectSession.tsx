import { ProjectStat as Stat } from "@/components/ProjectStat";
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
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
} from "@mantine/core";
import { IconDeviceFloppy, IconPlayerPlay } from "@tabler/icons-react";

export const ProjectSession = () => {
  const project = useProjectStore((s) => s.project);
  const projectPath = useProjectStore((s) => s.projectPath);
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
      <SimpleGrid cols={2} spacing="xs">
        <Stat label="Duration" value={formatDuration(project.source.duration_s)} />
        <Stat
          label="Master"
          value="24-bit / 48 kHz mono"
          tip={{
            label: "Conformed master",
            description:
              "The source is rewritten as 24-bit / 48 kHz mono WAV beside the original; the waveform and every export read this file.",
          }}
        />
        <Stat
          label="Clips"
          value={`${clipCount}${clipCount !== activeCount ? ` (${clipCount - activeCount} rejected)` : ""}`}
        />
        <Stat
          label="Active clip"
          value={
            activeClipId
              ? `#${project.clips.findIndex((c) => c.id === activeClipId) + 1}`
              : "-"
          }
        />
      </SimpleGrid>

      {(project.source.warnings?.length ?? 0) > 0 && (
        <Alert color="amber" title="Conform warnings">
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
          onClick={onExport}
          loading={exporting}
          disabled={busy || exporting}
          fullWidth
        >
          Export clips
        </Button>
      </Tip>

      {gate && (
        <Alert color="rose" title="Export blocked">
          {gate}
        </Alert>
      )}

      <Divider />
      <Stack gap={4}>
        <Text fw={700} size="sm">
          Project file
        </Text>
        <Tip
          label="Project file"
          description="Autosaved after every edit. Reopen it with Open, or by dropping the file anywhere on the window."
        >
          <Group gap="xs" wrap="nowrap">
            <ThemeIcon size="sm" variant="light" color="gray">
              <IconDeviceFloppy size={14} />
            </ThemeIcon>
            <Text size="xs" ff="monospace" lineClamp={2}>
              {projectPath ?? "-"}
            </Text>
          </Group>
        </Tip>
      </Stack>
    </>
  );
};
