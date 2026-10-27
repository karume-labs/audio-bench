import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useRef,
} from "react";

interface ResizeHandleOptions {
  width: number;
  min: number;
  max: number;
  /** +1 when dragging right widens the panel, -1 when dragging left does. */
  direction: 1 | -1;
  onChange: (width: number) => void;
}

/** Pointer handlers that resize a sidebar while its handle is dragged. */
export const useResizeHandle = ({
  width,
  min,
  max,
  direction,
  onChange,
}: ResizeHandleOptions) => {
  const drag = useRef<{ x: number; width: number } | null>(null);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      // Stops the browser starting a text selection while the handle is dragged.
      e.preventDefault();
      window.getSelection()?.removeAllRanges();
      drag.current = { x: e.clientX, width };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [width],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!drag.current) return;
      const next = drag.current.width + direction * (e.clientX - drag.current.x);
      onChange(Math.min(max, Math.max(min, next)));
    },
    [direction, max, min, onChange],
  );

  const onPointerUp = useCallback(() => {
    drag.current = null;
  }, []);

  return { onPointerDown, onPointerMove, onPointerUp };
};
