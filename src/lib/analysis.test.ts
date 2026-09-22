import { describe, expect, it } from "vitest";
import {
  adjustedPerformanceScore,
  analyzePastPerformance,
  rawPerformanceScore,
  summarizeAllHorses,
} from "@/lib/analysis";
import { samplePastPerformances } from "@/lib/sampleData";
import type { PastPerformance } from "@/types/race";

const boxedInLoss: PastPerformance = samplePastPerformances[0];
const cleanRun: PastPerformance = samplePastPerformances[2];

describe("adjustedPerformanceScore", () => {
  it("keeps score unchanged when there is no trouble", () => {
    expect(adjustedPerformanceScore(cleanRun)).toBe(rawPerformanceScore(cleanRun));
  });

  it("raises the score above the raw finish when a severe stretch trouble occurred", () => {
    const raw = rawPerformanceScore(boxedInLoss);
    const adjusted = adjustedPerformanceScore(boxedInLoss);
    expect(adjusted).toBeGreaterThan(raw);
  });

  it("never exceeds 100 even with extreme trouble credit", () => {
    const extreme: PastPerformance = {
      ...boxedInLoss,
      marginLengths: 0,
      troubles: [
        { kind: "boxed_in", severity: 5, phase: "stretch" },
        { kind: "bumped", severity: 5, phase: "stretch" },
      ],
    };
    expect(adjustedPerformanceScore(extreme)).toBeLessThanOrEqual(100);
  });
});

describe("analyzePastPerformance", () => {
  it("flags a 5th-place finish with a severe late trouble as an unlucky loss", () => {
    const result = analyzePastPerformance(boxedInLoss);
    expect(result.isUnluckyLoss).toBe(true);
    expect(result.luckAdjustment).toBeGreaterThan(0);
  });

  it("does not flag a clean top-3 finish as an unlucky loss", () => {
    const result = analyzePastPerformance(cleanRun);
    expect(result.isUnluckyLoss).toBe(false);
  });
});

describe("summarizeAllHorses", () => {
  it("ranks horses by adjusted score and counts unlucky losses per horse", () => {
    const summaries = summarizeAllHorses(samplePastPerformances);
    const sunrise = summaries.find((s) => s.horseId === "horse-sunrise-hope");
    expect(sunrise).toBeDefined();
    expect(sunrise!.unluckyLossCount).toBe(1);
    expect(sunrise!.avgAdjustedScore).toBeGreaterThan(sunrise!.avgRawScore);

    // Sorted descending by avgAdjustedScore
    for (let i = 1; i < summaries.length; i++) {
      expect(summaries[i - 1].avgAdjustedScore).toBeGreaterThanOrEqual(summaries[i].avgAdjustedScore);
    }
  });
});
