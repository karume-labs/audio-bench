import { useResizeHandle } from "@/hooks/useResizeHandle";

interface SidebarResizeHandleProps {
  edge: "left" | "right";
  width: number;
  min: number;
  max: number;
  onChange: (width: number) => void;
}

/** Draggable strip on the inner edge of a sidebar. */
export const SidebarResizeHandle = ({
  edge,
  width,
  min,
  max,
  onChange,
}: SidebarResizeHandleProps) => {
  const handlers = useResizeHandle({
    width,
    min,
    max,
    direction: edge === "right" ? 1 : -1,
    onChange,
  });

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      {...handlers}
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        [edge]: 0,
        width: 6,
        cursor: "col-resize",
        zIndex: 1,
        touchAction: "none",
      }}
    />
  );
};
