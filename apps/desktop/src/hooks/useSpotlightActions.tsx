import { pickAudioFile, pickProjectFile } from "@/ipc/commands";
import { notifyError } from "@/lib/notify";
import { loadRecentProjects } from "@/lib/recentProjects";
import { useProjectStore } from "@/stores/useProjectStore";
import { Button, Group, Stack, Text, TextInput } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconFileMusic, IconFolderOpen, IconTrash } from "@tabler/icons-react";
import { useMemo } from "react";

/**
 * Builds the Spotlight action list. Kept in its own module so App.tsx stays
 * small; the list is recomputed when the project / theme changes.
 */
export function useSpotlightActions(
  openHelp: () => void,
  openAbout: () => void,
  colorScheme: { setColorScheme: (s: "light" | "dark" | "auto") => void },
) {
  const project = useProjectStore((s) => s.project);
  const hasProject = project !== null;
  const ingestPath = useProjectStore((s) => s.ingestPath);
  const openProject = useProjectStore((s) => s.openProject);
  const closeProject = useProjectStore((s) => s.closeProject);
  const reanalyze = useProjectStore((s) => s.reanalyze);
  const renameProject = useProjectStore((s) => s.renameProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);

  return useMemo(() => {
    const actions: {
      id: string;
      label: string;
      description?: string;
      group?: string;
      keywords?: string | string[];
      leftSection?: React.ReactNode;
      onClick: () => void;
    }[] = [];

    actions.push({
      id: "import-recording",
      label: "Import recording",
      description: "Pick a WAV, FLAC, MP3 or M4A file",
      group: "Actions",
      keywords: ["audio", "file", "open"],
      leftSection: <IconFileMusic size={16} />,
      onClick: async () => {
        try {
          const path = await pickAudioFile();
          if (path) await ingestPath(path);
        } catch (err) {
          notifyError("Could not open recording", err);
        }
      },
    });

    actions.push({
      id: "open-project",
      label: "Open project",
      description: "Load a saved .audiobench file",
      group: "Actions",
      keywords: ["load", "session"],
      leftSection: <IconFolderOpen size={16} />,
      onClick: async () => {
        try {
          const path = await pickProjectFile();
          if (path) await openProject(path);
        } catch (err) {
          notifyError("Could not open project", err);
        }
      },
    });

    if (hasProject) {
      actions.push({
        id: "reanalyze",
        label: "Re-analyze recording",
        description: "Re-run silence detection with current settings",
        group: "Project",
        onClick: () => {
          modals.openConfirmModal({
            title: "Re-run detection?",
            children: (
              <Text size="sm">
                This re-splits the recording and replaces all clips and undo
                history.
              </Text>
            ),
            labels: { confirm: "Re-analyze", cancel: "Cancel" },
            confirmProps: { color: "amber" },
            onConfirm: () => void reanalyze(),
          });
        },
      });

      actions.push({
        id: "rename-project",
        label: "Rename project",
        description: "Change the project display name",
        group: "Project",
        onClick: () => {
          const renameValueRef = { current: project?.name ?? "" };
          modals.open({
            title: "Rename project",
            children: (
              <Stack gap="sm">
                <TextInput
                  defaultValue={renameValueRef.current}
                  autoFocus
                  onChange={(e) => {
                    renameValueRef.current = e.currentTarget.value;
                  }}
                />
                <Group justify="flex-end">
                  <Button
                    onClick={() => {
                      modals.closeAll();
                      void renameProject(renameValueRef.current);
                    }}
                  >
                    Save
                  </Button>
                </Group>
              </Stack>
            ),
          });
        },
      });

      actions.push({
        id: "delete-project",
        label: "Delete project",
        description: "Remove the project file and conformed audio from disk",
        group: "Project",
        leftSection: <IconTrash size={16} />,
        onClick: () => {
          modals.openConfirmModal({
            title: "Delete project?",
            children: (
              <Text size="sm">
                Permanently deletes the project file and its conformed audio.
                Cannot be undone.
              </Text>
            ),
            labels: { confirm: "Delete", cancel: "Cancel" },
            confirmProps: { color: "red" },
            onConfirm: () => void deleteProject(),
          });
        },
      });

      actions.push({
        id: "close-project",
        label: "Close project",
        description: "Close the current session",
        group: "Project",
        onClick: () => closeProject(),
      });
    }

    const recent = loadRecentProjects();
    if (recent.length > 0) {
      for (const entry of recent) {
        actions.push({
          id: `recent-${entry.path}`,
          label: entry.name,
          description: entry.path,
          group: "Recent projects",
          onClick: async () => {
            try {
              await openProject(entry.path);
            } catch (err) {
              notifyError("Could not open project", err);
            }
          },
        });
      }
    }

    actions.push({
      id: "help",
      label: "Help",
      description: "What every button does and keyboard shortcuts",
      group: "View",
      onClick: () => openHelp(),
    });
    actions.push({
      id: "about",
      label: "About Audio Bench",
      description: "Credits, privacy and licence",
      group: "View",
      onClick: () => openAbout(),
    });

    for (const scheme of ["auto", "light", "dark"] as const) {
      actions.push({
        id: `theme-${scheme}`,
        label: `Theme: ${scheme}`,
        group: "Theme",
        onClick: () => colorScheme.setColorScheme(scheme),
      });
    }

    return actions;
  }, [
    project,
    hasProject,
    ingestPath,
    openProject,
    closeProject,
    reanalyze,
    renameProject,
    deleteProject,
    openHelp,
    openAbout,
    colorScheme,
  ]);
}
