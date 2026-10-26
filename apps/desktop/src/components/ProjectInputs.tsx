import { Tip } from "@/components/Tip";
import { pickAudioFile, pickProjectFile } from "@/ipc/commands";
import { notifyError } from "@/lib/notify";
import { useProjectStore } from "@/stores/useProjectStore";
import { Button, Group } from "@mantine/core";
import {
  IconDeviceFloppy,
  IconFileMusic,
  IconFolderOpen,
} from "@tabler/icons-react";

export const ProjectInputs = () => {
  const busy = useProjectStore((s) => s.busy);
  const exporting = useProjectStore((s) => s.exporting);
  const ingestPath = useProjectStore((s) => s.ingestPath);
  const openProject = useProjectStore((s) => s.openProject);
  const saveProject = useProjectStore((s) => s.saveProject);

  const onPickAudio = async (): Promise<void> => {
    try {
      const path = await pickAudioFile();
      if (path) await ingestPath(path);
    } catch (err) {
      notifyError("Could not open recording", err);
    }
  };

  const onOpenProject = async (): Promise<void> => {
    try {
      const path = await pickProjectFile();
      if (path) await openProject(path);
    } catch (err) {
      notifyError("Could not open project", err);
    }
  };

  const onSave = async (): Promise<void> => {
    await saveProject(true);
  };

  return (
    <>
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
            disabled={busy || exporting}
          >
            Save
          </Button>
        </Tip>
      </Group>
    </>
  );
};
