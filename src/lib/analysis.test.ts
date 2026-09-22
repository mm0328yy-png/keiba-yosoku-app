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

const MAX_SCORE = 110;

describe("rawPerformanceScore", () => {
  it("gives a narrow win a score right at 100", () => {
    const narrowWin: PastPerformance = { ...cleanRun, finishPosition: 1, marginLengths: 0 };
    expect(rawPerformanceScore(narrowWin)).toBe(100);
  });

  it("rewards a dominant win above 100, unlike a narrow win", () => {
    const narrowWin: PastPerformance = { ...cleanRun, finishPosition: 1, marginLengths: 0.1 };
    const dominantWin: PastPerformance = { ...cleanRun, finishPosition: 1, marginLengths: 5 };
    expect(rawPerformanceScore(dominantWin)).toBeGreaterThan(rawPerformanceScore(narrowWin));
  });

  it("caps the win bonus at MAX_SCORE for an extreme margin", () => {
    const hugeWin: PastPerformance = { ...cleanRun, finishPosition: 1, marginLengths: 50 };
    expect(rawPerformanceScore(hugeWin)).toBe(MAX_SCORE);
  });

  it("still penalizes a loss the same way regardless of the new win bonus", () => {
    expect(rawPerformanceScore(cleanRun)).toBeLessThan(100);
  });
});

describe("adjustedPerformanceScore", () => {
  it("keeps score unchanged when there is no trouble", () => {
    expect(adjustedPerformanceScore(cleanRun)).toBe(rawPerformanceScore(cleanRun));
  });

  it("raises the score above the raw finish when a severe stretch trouble occurred", () => {
    const raw = rawPerformanceScore(boxedInLoss);
    const adjusted = adjustedPerformanceScore(boxedInLoss);
    expect(adjusted).toBeGreaterThan(raw);
  });

  it("never exceeds MAX_SCORE even with extreme trouble credit", () => {
    const extreme: PastPerformance = {
      ...boxedInLoss,
      marginLengths: 0,
      troubles: [
        { kind: "boxed_in", severity: 5, phase: "stretch" },
        { kind: "bumped", severity: 5, phase: "stretch" },
      ],
    };
    expect(adjustedPerformanceScore(extreme)).toBeLessThanOrEqual(MAX_SCORE);
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
