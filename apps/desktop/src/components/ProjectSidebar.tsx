import { orderedClips } from "@audio-bench/domain";
import {
  Alert,
  Badge,
  Button,
  Divider,
  Group,
  List,
  Paper,
  Progress,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import {
  IconDeviceFloppy,
  IconFileMusic,
  IconFileText,
  IconFolderOpen,
  IconPlayerPlay,
  IconRocket,
} from "@tabler/icons-react";
import { memo, useCallback, useState } from "react";
import {
  DEFAULT_DETECTION,
  pickAudioFile,
  pickDirectory,
  pickProjectFile,
  pickScriptFile,
} from "../ipc/commands";
import { basename, formatDuration } from "../lib/format";
import { notifyError } from "../lib/notify";
import { useEditorStore } from "../stores/useEditorStore";
import { useProjectStore } from "../stores/useProjectStore";

const PROFILE_ROWS: Array<[label: string, value: string]> = [
  ["Frame", `${DEFAULT_DETECTION.frameMs} ms`],
  ["Margin", `${DEFAULT_DETECTION.marginDb} dB`],
  ["Min silence", `${DEFAULT_DETECTION.minSilenceMs} ms`],
  ["Min clip", `${DEFAULT_DETECTION.minClipMs} ms`],
  ["Max clip", `${DEFAULT_DETECTION.maxClipMs / 1000} s`],
  ["Noise floor", `${DEFAULT_DETECTION.noiseFloorPctl}th pctl`],
  ["Guard", `${DEFAULT_DETECTION.guardMs} ms`],
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text size="xs" tt="uppercase" fw={700} c="dimmed">
      {children}
    </Text>
  );
}

function ProjectSidebar() {
  const project = useProjectStore((s) => s.project);
  const busy = useProjectStore((s) => s.busy);
  const exporting = useProjectStore((s) => s.exporting);
  const progress = useProjectStore((s) => s.progress);
  const pendingScript = useProjectStore((s) => s.pendingScript);
  const projectPath = useProjectStore((s) => s.projectPath);
  const ingestPath = useProjectStore((s) => s.ingestPath);
  const openProject = useProjectStore((s) => s.openProject);
  const saveProject = useProjectStore((s) => s.saveProject);
  const exportBlockers = useProjectStore((s) => s.exportBlockers);
  const executeExport = useProjectStore((s) => s.executeExport);
  const activeClipId = useEditorStore((s) => s.activeClipId);
  const [gate, setGate] = useState<string | null>(null);

  const refreshGate = useCallback(() => {
    setGate(exportBlockers());
  }, [exportBlockers]);

  const onPickAudio = async (): Promise<void> => {
    try {
      const path = await pickAudioFile();
      if (path) await ingestPath(path);
    } catch (err) {
      notifyError("Could not open recording", err);
    } finally {
      refreshGate();
    }
  };

  const onPickScript = async (): Promise<void> => {
    try {
      const path = await pickScriptFile();
      if (path) await ingestPath(path);
    } catch (err) {
      notifyError("Could not import script", err);
    } finally {
      refreshGate();
    }
  };

  const onOpenProject = async (): Promise<void> => {
    try {
      const path = await pickProjectFile();
      if (path) await openProject(path);
    } catch (err) {
      notifyError("Could not open project", err);
    } finally {
      refreshGate();
    }
  };

  const onSave = async (): Promise<void> => {
    await saveProject(true);
  };

  const onExport = (): void => {
    const blocker = exportBlockers();
    if (blocker) {
      setGate(blocker);
      notifications.show({
        color: "orange",
        title: "Export blocked",
        message: blocker,
        autoClose: 6000,
      });
      return;
    }
    setGate(null);

    modals.openConfirmModal({
      title: "Export clips",
      children: (
        <Stack gap="xs">
          <Text size="sm">
            Write every approved/proposed clip plus <code>manifest.csv</code>{" "}
            and <code>alignment_report.csv</code> to a folder of your choice?
          </Text>
          <Text size="sm" c="dimmed">
            Each file is padded to exactly core + 10s (5s each side) in 24-bit /
            48 kHz mono.
          </Text>
        </Stack>
      ),
      labels: { confirm: "Choose folder…", cancel: "Cancel" },
      confirmProps: { leftSection: <IconRocket size={16} /> },
      onConfirm: async () => {
        try {
          const outDir = await pickDirectory("Choose an export folder");
          if (!outDir) return;
          await executeExport(outDir);
        } catch (err) {
          notifyError("Export failed", err);
        }
      },
    });
  };

  const clipCount = project ? project.clips.length : 0;
  const activeCount = project
    ? orderedClips(project.clips).filter((c) => c.status !== "rejected").length
    : 0;
  const lineCount = project
    ? project.script.filter((l) => !l.skipped).length
    : 0;
  const gatePassed =
    project !== null && lineCount > 0 && activeCount === lineCount;

  return (
    <ScrollArea type="auto" h="100%" offsetScrollbars>
      <Stack gap="sm" p="xs">
        <div>
          <Text fw={700} size="sm">
            Audio Workbench
          </Text>
          <Text size="xs" c="dimmed">
            {project
              ? (project.name ?? basename(project.source.original_path))
              : "No session"}
          </Text>
        </div>

        <Divider />

        <SectionLabel>Inputs</SectionLabel>
        <Button
          leftSection={<IconFileMusic size={16} />}
          onClick={() => void onPickAudio()}
          loading={busy}
          disabled={busy || exporting}
          fullWidth
        >
          Import recording
        </Button>
        <Button
          leftSection={<IconFileText size={16} />}
          variant="light"
          onClick={() => void onPickScript()}
          loading={busy}
          disabled={busy || exporting}
          fullWidth
        >
          Import script
        </Button>
        <Group grow>
          <Button
            leftSection={<IconFolderOpen size={16} />}
            variant="light"
            size="xs"
            onClick={() => void onOpenProject()}
            disabled={busy || exporting}
          >
            Open
          </Button>
          <Button
            leftSection={<IconDeviceFloppy size={16} />}
            variant="light"
            size="xs"
            onClick={() => void onSave()}
            disabled={!project || busy || exporting}
          >
            Save
          </Button>
        </Group>

        {pendingScript && (
          <Alert color="blue" title="Script staged">
            {pendingScript.length} lines imported — load a recording to begin
            alignment.
          </Alert>
        )}

        {busy && (
          <Paper withBorder p="xs">
            <Group justify="space-between" mb={4}>
              <Text size="xs" fw={600}>
                {progress ? progress.message : "Working…"}
              </Text>
              <Text size="xs" c="dimmed">
                {progress ? `${Math.round(progress.pct * 100)}%` : ""}
              </Text>
            </Group>
            <Progress
              value={(progress ? progress.pct : 0.1) * 100}
              animated
              size="sm"
            />
          </Paper>
        )}

        {project && (
          <>
            <Divider />
            <SectionLabel>Session</SectionLabel>
            <Stack gap={4}>
              <Group justify="space-between">
                <Text size="xs" c="dimmed">
                  Duration
                </Text>
                <Text size="xs" ff="monospace">
                  {formatDuration(project.source.duration_s)}
                </Text>
              </Group>
              <Group justify="space-between">
                <Text size="xs" c="dimmed">
                  Master
                </Text>
                <Text size="xs" ff="monospace">
                  24-bit / 48 kHz mono
                </Text>
              </Group>
              <Group justify="space-between">
                <Text size="xs" c="dimmed">
                  Clips / lines
                </Text>
                <Text size="xs" ff="monospace">
                  {activeCount} / {lineCount}
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
                    ? (project.script.find(
                        (l) =>
                          l.id ===
                          project.clips.find((c) => c.id === activeClipId)
                            ?.script_line_id,
                      )?.script_id ?? "unassigned")
                    : "—"}
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

            <Divider />
            <SectionLabel>Count gate</SectionLabel>
            <Paper withBorder p="xs">
              <Group justify="space-between" mb={4}>
                <Text size="xs">Clips match script lines</Text>
                <Badge
                  color={gatePassed ? "green" : "orange"}
                  size="xs"
                  variant="light"
                >
                  {gatePassed ? "PASS" : "BLOCKED"}
                </Badge>
              </Group>
              <Text size="xs" c="dimmed">
                {gatePassed
                  ? "Export is enabled. Reject, split or merge to fine-tune."
                  : `${activeCount} active clips vs ${lineCount} script lines — resolve the mismatch before exporting.`}
              </Text>
            </Paper>

            {gate && (
              <Alert color="red" title="Export blocked">
                {gate}
              </Alert>
            )}

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

            <Divider />
            <SectionLabel>Processing profile</SectionLabel>
            <Paper withBorder p="xs">
              <Stack gap={2}>
                {PROFILE_ROWS.map(([label, value]) => (
                  <Group key={label} justify="space-between" gap={4}>
                    <Text size="xs" c="dimmed">
                      {label}
                    </Text>
                    <Text size="xs" ff="monospace">
                      {value}
                    </Text>
                  </Group>
                ))}
              </Stack>
            </Paper>
            <Text size="xs" c="dimmed">
              Detection runs on the conformed master. Adjusting the profile
              requires re-analysis.
            </Text>

            <Divider />
            <SectionLabel>Project file</SectionLabel>
            <Group gap="xs">
              <ThemeIcon size="sm" variant="light" color="gray">
                <IconDeviceFloppy size={14} />
              </ThemeIcon>
              <Text size="xs" ff="monospace" lineClamp={2}>
                {projectPath ?? "—"}
              </Text>
            </Group>
            <Text size="xs" c="dimmed">
              Autosaves after every edit.
            </Text>
          </>
        )}
      </Stack>
    </ScrollArea>
  );
}

export default memo(ProjectSidebar);
