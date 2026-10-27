import { Tip } from "@/components/Tip";
import { Text } from "@mantine/core";

interface ProjectStatProps {
  label: string;
  value: string;
  tip?: { label: string; description: string };
}

export const ProjectStat = ({ label, value, tip }: ProjectStatProps) => {
  const body = (
    <div>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="xs" ff="monospace" fw={500}>
        {value}
      </Text>
    </div>
  );
  return tip ? (
    <Tip label={tip.label} description={tip.description}>
      {body}
    </Tip>
  ) : (
    body
  );
};
