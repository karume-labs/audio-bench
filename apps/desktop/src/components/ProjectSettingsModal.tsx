import { Tip } from "@/components/Tip";
import { useProjectStore } from "@/stores/useProjectStore";
import { Button, Modal, Stack, Text, TextInput } from "@mantine/core";
import { modals } from "@mantine/modals";

interface ProjectSettingsModalProps {
  opened: boolean;
  onClose: () => void;
}

export const ProjectSettingsModal = ({
  opened,
  onClose,
}: ProjectSettingsModalProps) => {
  const project = useProjectStore((s) => s.project);
  const busy = useProjectStore((s) => s.busy);
  const exporting = useProjectStore((s) => s.exporting);
  const renameProject = useProjectStore((s) => s.renameProject);
  const setNamingTemplate = useProjectStore((s) => s.setNamingTemplate);
  const deleteProject = useProjectStore((s) => s.deleteProject);

  if (!project) return null;

  const onDelete = (): void => {
    modals.openConfirmModal({
      title: "Delete project?",
      children: (
        <Text size="sm">
          This permanently deletes the project file and its conformed
          master/preview audio from disk. This cannot be undone.
        </Text>
      ),
      labels: { confirm: "Delete", cancel: "Cancel" },
      confirmProps: { color: "rose" },
      onConfirm: () => void deleteProject(),
    });
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Project settings" centered>
      <Stack gap="sm">
        <Tip
          label="Project name"
          description="Display name used in the sidebar, header and exports."
        >
          <TextInput
            key={`name-${project.id}`}
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
            color="rose"
            variant="light"
            fullWidth
            onClick={onDelete}
            disabled={busy || exporting}
          >
            Delete project
          </Button>
        </Tip>
      </Stack>
    </Modal>
  );
};
