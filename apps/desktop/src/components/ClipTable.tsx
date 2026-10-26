import { type Clip, orderedClips } from "@audio-bench/domain";
import {
  Badge,
  Button,
  Checkbox,
  Group,
  ScrollArea,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import { useEffect, useMemo, useRef } from "react";
import { formatTimecode, samplesToSeconds } from "../lib/format";
import { FLAG_TIP, STATUS_TIP } from "../lib/statusTip";
import { waveformBridge } from "../lib/waveformBridge";
import { useEditorStore } from "../stores/useEditorStore";
import { useProjectStore } from "../stores/useProjectStore";

import { CLIP_STATUS_COLOR } from "../theme";
import Tip from "./Tip";

const statusColor = (status: string): string =>
  CLIP_STATUS_COLOR[status as keyof typeof CLIP_STATUS_COLOR] ?? "gray";

export default function ClipTable() {
  const project = useProjectStore((s) => s.project);
  const setActive = useEditorStore((s) => s.setActive);
  const activeClipId = useEditorStore((s) => s.activeClipId);
  const checked = useEditorStore((s) => s.checked);
  const toggleChecked = useEditorStore((s) => s.toggleChecked);
  const setChecked = useEditorStore((s) => s.setChecked);
  const sort = useEditorStore((s) => s.sort);
  const setSort = useEditorStore((s) => s.setSort);
  const approveChecked = useProjectStore((s) => s.approveChecked);
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());

  const clips = useMemo(() => {
    if (!project) return [] as Clip[];
    const ordered = orderedClips(project.clips);
    const statusRank: Record<string, number> = {
      proposed: 0,
      approved: 1,
      rejected: 2,
    };

    const sorted = [...ordered];
    const dir = sort.dir === "asc" ? 1 : -1;
    sorted.sort((a, b) => {
      switch (sort.by) {
        case "status":
          return (statusRank[a.status] - statusRank[b.status]) * dir;
        case "duration":
          return (
            (a.core_end_sample -
              a.core_start_sample -
              (b.core_end_sample - b.core_start_sample)) *
            dir
          );
        default:
          return (
            (a.core_start_sample - b.core_start_sample ||
              a.core_end_sample - b.core_end_sample) * dir
          );
      }
    });
    return sorted;
  }, [project, sort]);

  useEffect(() => {
    if (!activeClipId) return;
    rowRefs.current.get(activeClipId)?.scrollIntoView({ block: "nearest" });
  }, [activeClipId]);

  if (!project) {
    return (
      <Stack align="center" justify="center" h="100%" gap="xs">
        <Text c="dimmed" size="sm">
          Clips will appear here after analysis
        </Text>
      </Stack>
    );
  }

  const headerCell = (
    label: string,
    key: "index" | "status" | "duration",
    align?: "left" | "right",
    description?: string,
  ) => (
    <Tip label={`Sort by ${label}`} description={description}>
      <Table.Th
        style={{
          cursor: "pointer",
          textAlign: align ?? "left",
          userSelect: "none",
        }}
        onClick={() => setSort(key as "index" | "status" | "duration")}
      >
        <Group
          gap={4}
          justify={align === "right" ? "flex-end" : "flex-start"}
          wrap="nowrap"
        >
          <Text size="xs" fw={600} c="dimmed">
            {label}
          </Text>
          {sort.by === key && (
            <Text size="xs" c="dimmed">
              {sort.dir === "asc" ? "↑" : "↓"}
            </Text>
          )}
        </Group>
      </Table.Th>
    </Tip>
  );

  const allChecked = clips.length > 0 && checked.length === clips.length;

  return (
    <Stack gap={4} h="100%" p="xs">
      <Group justify="space-between">
        <Text size="sm" fw={600}>
          Clips ({clips.length})
        </Text>
        <Group gap="xs">
          <Tip
            label="Approve selected"
            description="Mark every ticked clip as approved in one action."
          >
            <Button
              size="xs"
              variant="light"
              disabled={checked.length === 0}
              onClick={() => approveChecked()}
            >
              Approve selected ({checked.length})
            </Button>
          </Tip>
          <Tip
            label="Select all"
            description="Tick or untick every clip in the table."
          >
            <Checkbox
              size="xs"
              label="All"
              checked={allChecked}
              indeterminate={checked.length > 0 && !allChecked}
              onChange={() =>
                setChecked(allChecked ? [] : clips.map((c) => c.id))
              }
            />
          </Tip>
        </Group>
      </Group>

      <ScrollArea type="auto" style={{ flex: 1 }}>
        <Table striped highlightOnHover withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: 34 }} />
              <Table.Th style={{ width: 40 }}>#</Table.Th>
              {headerCell(
                "Status",
                "status",
                "left",
                "Sort proposed → approved → rejected.",
              )}
              {headerCell(
                "Start",
                "index",
                "right",
                "Sort by clip start time.",
              )}
              <Table.Th style={{ textAlign: "right" }}>End</Table.Th>
              {headerCell("Dur", "duration", "right", "Sort by clip length.")}
              <Tip
                label="Flags"
                description="EDGE: the 5s export pad runs into the recording edge. DUR: duration outlier."
              >
                <Table.Th style={{ width: 90 }}>Flags</Table.Th>
              </Tip>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {clips.map((clip, index) => {
              const flags = clip.flags ?? [];
              return (
                <Table.Tr
                  key={clip.id}
                  ref={(el) => {
                    if (el) rowRefs.current.set(clip.id, el);
                    else rowRefs.current.delete(clip.id);
                  }}
                  style={{
                    cursor: "pointer",
                    outline:
                      clip.id === activeClipId
                        ? "1px solid var(--mantine-color-blue-5)"
                        : undefined,
                  }}
                  onClick={() => {
                    setActive(clip.id);
                    waveformBridge.actions?.seek(
                      samplesToSeconds(clip.core_start_sample),
                    );
                  }}
                >
                  <Table.Td onClick={(e) => e.stopPropagation()}>
                    <Tip
                      label="Select clip"
                      description="Tick to include it in a bulk status change."
                    >
                      <Checkbox
                        size="xs"
                        checked={checked.includes(clip.id)}
                        onChange={() => toggleChecked(clip.id)}
                      />
                    </Tip>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">
                      {index + 1}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Tip
                      label={`Status: ${clip.status}`}
                      description={STATUS_TIP[clip.status]}
                    >
                      <Badge
                        size="xs"
                        color={statusColor(clip.status)}
                        variant="light"
                      >
                        {clip.status}
                      </Badge>
                    </Tip>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" ff="monospace">
                      {formatTimecode(samplesToSeconds(clip.core_start_sample))}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" ff="monospace">
                      {formatTimecode(samplesToSeconds(clip.core_end_sample))}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" ff="monospace">
                      {(
                        (clip.core_end_sample - clip.core_start_sample) /
                        48000
                      ).toFixed(2)}
                      s
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={2}>
                      {flags.map((f) => (
                        <Tip
                          key={f}
                          label={
                            f === "duration_outlier"
                              ? "Duration outlier"
                              : "Edge clamped"
                          }
                          description={FLAG_TIP[f]}
                        >
                          <Badge
                            size="xs"
                            color={f === "duration_outlier" ? "red" : "yellow"}
                            variant="light"
                          >
                            {f === "duration_outlier" ? "DUR" : "EDGE"}
                          </Badge>
                        </Tip>
                      ))}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Stack>
  );
}
