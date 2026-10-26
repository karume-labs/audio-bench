import { ProjectInputs } from "@/components/ProjectInputs";
import { ProjectSession } from "@/components/ProjectSession";
import { basename } from "@/lib/format";
import { useProjectStore } from "@/stores/useProjectStore";
import {
  Divider,
  Group,
  Paper,
  Progress,
  ScrollArea,
  Stack,
  Text,
} from "@mantine/core";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text size="xs" tt="uppercase" fw={700} c="dimmed">
      {children}
    </Text>
  );
}

export const ProjectSidebar = () => {
  const project = useProjectStore((s) => s.project);
  const busy = useProjectStore((s) => s.busy);
  const progress = useProjectStore((s) => s.progress);

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
        <ProjectInputs />

        {busy && (
          <Paper withBorder p="xs">
            <Group justify="space-between" mb={4}>
              <Text size="xs" fw={600}>
                {progress ? progress.message : "Working..."}
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

        {project && <ProjectSession />}
      </Stack>
    </ScrollArea>
  );
};
