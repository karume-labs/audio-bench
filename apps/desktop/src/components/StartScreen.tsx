import { Button, Group, Stack, Text, Title } from "@mantine/core";
import { IconFileMusic, IconFolderOpen } from "@tabler/icons-react";
import { pickAudioFile, pickProjectFile } from "../ipc/commands";
import { ACCEPTED_AUDIO } from "../lib/dropKind";
import { notifyError } from "../lib/notify";
import { useProjectStore } from "../stores/useProjectStore";

/**
 * First-run screen: nothing but the logo and the two ways in.
 *
 * The sidebar, inspector and clip table only mount once a session exists, so
 * an empty app shows one obvious choice instead of an empty workstation.
 */
export default function StartScreen({
  headerHeight,
}: { headerHeight: number }) {
  const ingestPath = useProjectStore((s) => s.ingestPath);
  const openProject = useProjectStore((s) => s.openProject);

  const onImport = async (): Promise<void> => {
    try {
      const path = await pickAudioFile();
      if (path) await ingestPath(path);
    } catch (err) {
      notifyError("Could not open recording", err);
    }
  };

  const onOpen = async (): Promise<void> => {
    try {
      const path = await pickProjectFile();
      if (path) await openProject(path);
    } catch (err) {
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
      <Stack align="center" gap="lg" ta="center" maw={460}>
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
      </Stack>
    </div>
  );
}
