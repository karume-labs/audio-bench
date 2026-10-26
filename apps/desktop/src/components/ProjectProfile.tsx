import { ProjectDetails } from "@/components/ProjectDetails";
import { Tip } from "@/components/Tip";
import { useProjectStore } from "@/stores/useProjectStore";
import {
  Button,
  Divider,
  Group,
  NumberInput,
  Paper,
  Stack,
  Text,
  ThemeIcon,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconDeviceFloppy } from "@tabler/icons-react";

const PROFILE_ROWS: Array<[label: string, value: string]> = [
  ["Frame", "10 ms"],
  ["Margin", "20 dB"],
  ["Min clip", "300 ms"],
  ["Max clip", "10 s"],
  ["Noise floor", "10th pctl"],
  ["Guard", "100 ms"],
];

export const ProjectProfile = () => {
  const project = useProjectStore((s) => s.project);
  const projectPath = useProjectStore((s) => s.projectPath);
  const busy = useProjectStore((s) => s.busy);
  const exporting = useProjectStore((s) => s.exporting);
  const detectionMinSilenceMs = useProjectStore((s) => s.detectionMinSilenceMs);
  const lastResolvedMinSilenceMs = useProjectStore(
    (s) => s.lastResolvedMinSilenceMs,
  );
  const setDetectionMinSilenceMs = useProjectStore(
    (s) => s.setDetectionMinSilenceMs,
  );
  const reanalyze = useProjectStore((s) => s.reanalyze);

  if (!project) return null;

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

  return (
    <>
      <Divider />
      <Text fw={700} size="sm">
        Processing profile
      </Text>
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
                      typeof v === "number" && Number.isFinite(v) ? v : null,
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
          disabled={busy || exporting}
          loading={busy}
        >
          Re-analyze with current settings
        </Button>
      </Tip>

      <ProjectDetails />

      <Divider />
      <Text fw={700} size="sm">
        Project file
      </Text>
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
        Accepts WAV, FLAC, MP3, M4A and .audiobench files.
      </Text>
    </>
  );
};
