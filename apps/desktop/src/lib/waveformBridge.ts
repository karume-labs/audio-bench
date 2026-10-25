/**
 * Small bridge so global keyboard shortcuts can drive the waveform without
 * prop-drilling through the component tree. WaveformWorkspace registers its
 * actions on mount and clears them on unmount.
 */
export interface WaveformActions {
  togglePlay: () => void;
  /** Audition the active clip's 5s-padded export window. */
  playExportWindow: () => void;
  /** Seek to an absolute time in seconds. */
  seek: (seconds: number) => void;
}

export const waveformBridge: { actions: WaveformActions | null } = {
  actions: null,
};
