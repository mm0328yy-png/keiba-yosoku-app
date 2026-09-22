import { describe, expect, it } from "vitest";
import {
  adjustedPerformanceScore,
  analyzePastPerformance,
  rawPerformanceScore,
  summarizeAllHorses,
} from "@/lib/analysis";
import { samplePastPerformances } from "@/lib/sampleData";
import type { PastPerformance } from "@/types/race";

const boxedInLoss: PastPerformance = samplePastPerformances[0]; // g3
const cleanRun: PastPerformance = samplePastPerformances[2]; // g3, no trouble

const MAX_SCORE = 130;

describe("rawPerformanceScore", () => {
  it("gives a narrow win a score right at 100 in a baseline (1勝クラス) race", () => {
    const narrowWin: PastPerformance = {
      ...cleanRun,
      raceGrade: "class1",
      finishPosition: 1,
      marginLengths: 0,
    };
    expect(rawPerformanceScore(narrowWin)).toBe(100);
  });

  it("rewards a dominant win above a narrow win, grade held constant", () => {
    const narrowWin: PastPerformance = { ...cleanRun, finishPosition: 1, marginLengths: 0.1 };
    const dominantWin: PastPerformance = { ...cleanRun, finishPosition: 1, marginLengths: 5 };
    expect(rawPerformanceScore(dominantWin)).toBeGreaterThan(rawPerformanceScore(narrowWin));
  });

  it("caps the score at MAX_SCORE for an extreme margin in a top grade", () => {
    const hugeWin: PastPerformance = { ...cleanRun, raceGrade: "g1", finishPosition: 1, marginLengths: 50 };
    expect(rawPerformanceScore(hugeWin)).toBe(MAX_SCORE);
  });

  it("still penalizes a loss the same way regardless of the new win bonus", () => {
    const baselineLoss: PastPerformance = { ...cleanRun, raceGrade: "class1" };
    expect(rawPerformanceScore(baselineLoss)).toBeLessThan(100);
  });

  it("scores an identical finish higher in a stronger race grade", () => {
    const inWeakerRace: PastPerformance = { ...cleanRun, raceGrade: "mishoyuri" };
    const inStrongerRace: PastPerformance = { ...cleanRun, raceGrade: "g1" };
    expect(rawPerformanceScore(inStrongerRace)).toBeGreaterThan(rawPerformanceScore(inWeakerRace));
  });

  it("discounts a win at a regional (地方) track relative to the same win in a JRA 1勝クラス", () => {
    const win: PastPerformance = { ...cleanRun, finishPosition: 1, marginLengths: 0.2 };
    const centralWin: PastPerformance = { ...win, raceGrade: "class1" };
    const regionalWin: PastPerformance = { ...win, raceGrade: "chihou" };
    expect(rawPerformanceScore(regionalWin)).toBeLessThan(rawPerformanceScore(centralWin));
  });

  it("can let a JRA near-miss outscore a regional win, given a big enough grade gap", () => {
    // 地方で僅差の1着 vs JRA G1で僅差の2着
    const regionalWin: PastPerformance = {
      ...cleanRun,
      raceGrade: "chihou",
      finishPosition: 1,
      marginLengths: 0.2,
    };
    const jraG1NearMiss: PastPerformance = {
      ...cleanRun,
      raceGrade: "g1",
      finishPosition: 2,
      marginLengths: 0.3,
    };
    expect(rawPerformanceScore(jraG1NearMiss)).toBeGreaterThan(rawPerformanceScore(regionalWin));
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
