import type { Project } from "@audio-bench/domain";
import type { Clip } from "@audio-bench/domain";

export const withFlags = (project: Project, clips: Clip[]): Clip[] => {
  const durationSamples =
    project.source.duration_samples ??
    Math.round(project.source.duration_s * 48_000);
  const padSamples = 5 * 48000;
  return clips.map((c) => {
    const flags: (typeof c.flags extends (infer T)[] | undefined
      ? T
      : never)[] = [];
    if (
      c.core_start_sample < padSamples ||
      c.core_end_sample + padSamples > durationSamples
    ) {
      flags.push("edge_clamped");
    }
    return { ...c, flags };
  });
};
