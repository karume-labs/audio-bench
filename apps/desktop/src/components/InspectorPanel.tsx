import { ClipInspector } from "@/components/ClipInspector";
import { ProjectProfile } from "@/components/ProjectProfile";
import { useProjectStore } from "@/stores/useProjectStore";
import { Accordion, Stack } from "@mantine/core";

export const InspectorPanel = () => {
  const project = useProjectStore((s) => s.project);

  return (
    <Stack gap={0} h="100%">
      <div style={{ flex: 1, minHeight: 0 }}>
        <ClipInspector />
      </div>
      {project && (
        <Accordion variant="contained" chevronPosition="right">
          <Accordion.Item value="profile">
            <Accordion.Control>Processing profile</Accordion.Control>
            <Accordion.Panel>
              <ProjectProfile />
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      )}
    </Stack>
  );
};
