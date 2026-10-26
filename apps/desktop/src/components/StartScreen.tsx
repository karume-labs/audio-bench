import {
  Button,
  Group,
  Stack,
  Text,
  Title,
  UnstyledButton,
} from "@mantine/core";
import { IconFileMusic, IconFolderOpen } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { pickAudioFile, pickProjectFile } from "../ipc/commands";
import { ACCEPTED_AUDIO } from "../lib/dropKind";
import { notifyError } from "../lib/notify";
import {
  type RecentProject,
  loadRecentProjects,
  removeRecentProject,
} from "../lib/recentProjects";
import { useProjectStore } from "../stores/useProjectStore";

export default function StartScreen({
  headerHeight,
}: { headerHeight: number }) {
  const ingestPath = useProjectStore((s) => s.ingestPath);
  const openProject = useProjectStore((s) => s.openProject);
  const [recent, setRecent] = useState<RecentProject[]>([]);

  useEffect(() => {
    setRecent(loadRecentProjects());
  }, []);

  const refresh = () => setRecent(loadRecentProjects());

  const onImport = async (): Promise<void> => {
    try {
      const path = await pickAudioFile();
      if (path) await ingestPath(path);
      refresh();
    } catch (err) {
      notifyError("Could not open recording", err);
    }
  };

  const onOpen = async (): Promise<void> => {
    try {
      const path = await pickProjectFile();
      if (path) await openProject(path);
      refresh();
    } catch (err) {
      notifyError("Could not open project", err);
    }
  };

  const onOpenRecent = async (entry: RecentProject): Promise<void> => {
    try {
      await openProject(entry.path);
      refresh();
    } catch (err) {
      removeRecentProject(entry.path);
      setRecent(loadRecentProjects());
      notifyError("Could not open project", err);
    }
  };

  return (
    <div
      style={{
        minHeight: `calc(100vh - ${headerHeight}px)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <Stack align="center" gap="lg" ta="center" maw={520} w="100%">
        <img
          src="/logo.png"
          alt="Audio Bench logo"
          width={96}
          height="auto"
          style={{ display: "block" }}
        />

        <div>
          <Title order={2}>Audio Bench</Title>
          <Text size="sm" c="dimmed" mt={6}>
            Split long recordings into export-ready, perfectly named clips -
            entirely on your machine.
          </Text>
        </div>

        <Group gap="sm" justify="center">
          <Button
            size="md"
            leftSection={<IconFileMusic size={18} />}
            onClick={() => void onImport()}
          >
            Import recording
          </Button>
          <Button
            size="md"
            variant="light"
            leftSection={<IconFolderOpen size={18} />}
            onClick={() => void onOpen()}
          >
            Open project
          </Button>
        </Group>

        <Text size="xs" c="dimmed">
          or drop a{" "}
          <Text span ff="monospace">
            {ACCEPTED_AUDIO}
          </Text>{" "}
          file anywhere on this window
        </Text>

        {recent.length > 0 && (
          <Stack gap={6} w="100%" mt="sm">
            <Text size="xs" tt="uppercase" fw={700} c="dimmed">
              Recent projects
            </Text>
            <Stack gap={4}>
              {recent.map((entry) => (
                <UnstyledButton
                  key={entry.path}
                  onClick={() => void onOpenRecent(entry)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--mantine-color-default-border)",
                    background: "var(--mantine-color-default)",
                  }}
                >
                  <Text size="sm" fw={500} lineClamp={1}>
                    {entry.name}
                  </Text>
                  <Text size="xs" c="dimmed" ff="monospace" lineClamp={1}>
                    {entry.path}
                  </Text>
                </UnstyledButton>
              ))}
            </Stack>
          </Stack>
        )}
      </Stack>
    </div>
  );
}
