import { orderedClips } from "@audio-bench/domain";
import {
  Alert,
  Button,
  Divider,
  Group,
  List,
  NumberInput,
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
  IconFolderOpen,
  IconPlayerPlay,
  IconRocket,
} from "@tabler/icons-react";
import { useCallback, useState } from "react";
import Tip from "../components/Tip";
import { pickAudioFile, pickDirectory, pickProjectFile } from "../ipc/commands";
import { basename, formatDuration } from "../lib/format";
import { notifyError } from "../lib/notify";
import { useEditorStore } from "../stores/useEditorStore";
import { useProjectStore } from "../stores/useProjectStore";

const PROFILE_ROWS: Array<[label: string, value: string]> = [
  ["Frame", "10 ms"],
  ["Margin", "20 dB"],
  ["Min clip", "300 ms"],
  ["Max clip", "10 s"],
  ["Noise floor", "10th pctl"],
  ["Guard", "100 ms"],
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text size="xs" tt="uppercase" fw={700} c="dimmed">
      {children}
    </Text>
  );
}

export default function ProjectSidebar() {
  const project = useProjectStore((s) => s.project);
  const busy = useProjectStore((s) => s.busy);
  const exporting = useProjectStore((s) => s.exporting);
  const progress = useProjectStore((s) => s.progress);
  const projectPath = useProjectStore((s) => s.projectPath);
  const ingestPath = useProjectStore((s) => s.ingestPath);
  const openProject = useProjectStore((s) => s.openProject);
  const saveProject = useProjectStore((s) => s.saveProject);
  const exportBlockers = useProjectStore((s) => s.exportBlockers);
  const executeExport = useProjectStore((s) => s.executeExport);
  const reanalyze = useProjectStore((s) => s.reanalyze);
  const detectionMinSilenceMs = useProjectStore((s) => s.detectionMinSilenceMs);
  const lastResolvedMinSilenceMs = useProjectStore(
    (s) => s.lastResolvedMinSilenceMs,
  );
  const setDetectionMinSilenceMs = useProjectStore(
    (s) => s.setDetectionMinSilenceMs,
  );
  const activeClipId = useEditorStore((s) => s.activeClipId);
  const [gate, setGate] = useState<string | null>(null);

  const refreshGate = useCallback(() => {
    setGate(exportBlockers());
  }, [exportBlockers]);

  const onReanalyze = (): void => {
    modals.openConfirmModal({
      title: "Re-run detection?",
      children: (
        <Text size="sm">
          This re-splits the recording with the current minimum-silence setting
          and replaces all clips and undo history. Clip statuses are reset.
        </Text>
      ),
      labels: { confirm: "Re-analyze", cancel: "Cancel" },
      confirmProps: { color: "amber" },
      onConfirm: () => void reanalyze(),
    });
  };
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

  return (
    <ScrollArea type="auto" h="100%" offsetScrollbars>
      <Stack gap="sm" p="xs">
        <div>
          <Text fw={700} size="sm">
            Audio Bench
          </Text>
          <Text size="xs" c="dimmed">
            {project
              ? (project.name ?? basename(project.source.original_path))
              : "No session"}
          </Text>
        </div>

        <Divider />

        <SectionLabel>Inputs</SectionLabel>
        <Tip
          label="Import recording"
          description="Pick a WAV, FLAC, MP3 or M4A file. It is conformed to 24-bit / 48 kHz mono, then split into clips."
        >
          <Button
            leftSection={<IconFileMusic size={16} />}
            onClick={() => void onPickAudio()}
            loading={busy}
            disabled={busy || exporting}
            fullWidth
          >
            Import recording
          </Button>
        </Tip>
        <Group grow>
          <Tip
            label="Open project"
            description="Load a saved .audiobench file, including every clip's status and flags."
          >
            <Button
              leftSection={<IconFolderOpen size={16} />}
              variant="light"
              size="xs"
              onClick={() => void onOpenProject()}
              disabled={busy || exporting}
            >
              Open
            </Button>
          </Tip>
          <Tip
            label="Save project"
            description="Write the project file now - the app also autosaves after every edit."
          >
            <Button
              leftSection={<IconDeviceFloppy size={16} />}
              variant="light"
              size="xs"
              onClick={() => void onSave()}
              disabled={!project || busy || exporting}
            >
              Save
            </Button>
          </Tip>
        </Group>

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
              value={progress ? progress.pct * 100 : 10}
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

            <Divider />
            <SectionLabel>Processing profile</SectionLabel>
            <Tip
              label="Detection profile"
              description="Settings the silence detector ran with: 10 ms frames, 20 dB margin over the noise floor, adjustable minimum silence, 300 ms minimum clip."
            >
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
                  <Group justify="space-between" gap={4} align="center">
                    <Text size="xs" c="dimmed">
                      Min silence
                    </Text>
                    <Group gap={4} align="center" wrap="nowrap">
                      <NumberInput
                        size="xs"
                        w={92}
                        min={100}
                        max={5000}
                        step={100}
                        suffix=" ms"
                        value={detectionMinSilenceMs ?? undefined}
                        placeholder="auto"
                        onChange={(v) =>
                          setDetectionMinSilenceMs(
                            typeof v === "number" && Number.isFinite(v)
                              ? v
                              : null,
                          )
                        }
                        allowDecimal={false}
                        hideControls
                      />
                      {detectionMinSilenceMs === null && (
                        <Text size="xs" ff="monospace" c="dimmed">
                          {lastResolvedMinSilenceMs !== null
                            ? `auto -> ${lastResolvedMinSilenceMs}`
                            : "auto"}
                        </Text>
                      )}
                    </Group>
                  </Group>
                </Stack>
              </Paper>
            </Tip>
            <Text size="xs" c="dimmed">
              Detection runs on the conformed master.
            </Text>
            <Tip
              label="Re-analyze"
              description="Re-run silence detection with the current minimum-silence setting. Replaces all clips and clears undo history."
            >
              <Button
                size="xs"
                variant="light"
                fullWidth
                onClick={onReanalyze}
                disabled={!project || busy || exporting}
                loading={busy}
              >
                Re-analyze with current settings
              </Button>
            </Tip>

            <Divider />
            <SectionLabel>Project file</SectionLabel>
            <Tip
              label="Project file"
              description="Autosaved after every edit. Reopen it with Open, or by dropping the file anywhere on the window."
            >
              <Group gap="xs">
                <ThemeIcon size="sm" variant="light" color="gray">
                  <IconDeviceFloppy size={14} />
                </ThemeIcon>
                <Text size="xs" ff="monospace" lineClamp={2}>
                  {projectPath ?? "-"}
                </Text>
              </Group>
            </Tip>
            <Text size="xs" c="dimmed">
              Autosaves after every edit.
            </Text>
          </>
        )}
      </Stack>
    </ScrollArea>
  );
}
