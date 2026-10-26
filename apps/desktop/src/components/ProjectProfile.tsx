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
  TextInput,
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
  const renameProject = useProjectStore((s) => s.renameProject);
  const setNamingTemplate = useProjectStore((s) => s.setNamingTemplate);
  const deleteProject = useProjectStore((s) => s.deleteProject);
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
      <SectionLabelInner>Processing profile</SectionLabelInner>
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

      <Divider />
      <SectionLabelInner>Project details</SectionLabelInner>
      <Stack gap={6}>
        <Tip
          label="Project name"
          description="Display name used in the sidebar, header and exports."
        >
          <TextInput
            key={`name-${project.id}`}
            size="xs"
            label="Name"
            defaultValue={project.name ?? ""}
            onBlur={(e) => void renameProject(e.currentTarget.value)}
          />
        </Tip>
        <Tip
          label="Naming template"
          description="Tokens: {n} index, {status}, {date}. Applied on export."
        >
          <TextInput
            key={`tpl-${project.id}`}
            size="xs"
            label="Export name template"
            defaultValue={project.naming_template}
            onBlur={(e) => setNamingTemplate(e.currentTarget.value)}
          />
        </Tip>
        <Tip
          label="Delete project"
          description="Removes the project file and its conformed audio from disk."
        >
          <Button
            size="xs"
            color="red"
            variant="light"
            fullWidth
            onClick={() => {
              modals.openConfirmModal({
                title: "Delete project?",
                children: (
                  <Text size="sm">
                    This permanently deletes the project file and its conformed
                    master/preview audio from disk. This cannot be undone.
                  </Text>
                ),
                labels: { confirm: "Delete", cancel: "Cancel" },
                confirmProps: { color: "red" },
                onConfirm: () => void deleteProject(),
              });
            }}
            disabled={busy || exporting}
          >
            Delete project
          </Button>
        </Tip>
      </Stack>

      <Divider />
      <SectionLabelInner>Project file</SectionLabelInner>
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

// local alias so we don't need to import SectionLabel from the sidebar
const SectionLabelInner = ({ children }: { children: React.ReactNode }) => (
  <Text fw={700} size="sm">
    {children}
  </Text>
);
