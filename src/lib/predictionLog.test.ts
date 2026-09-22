import { describe, expect, it } from "vitest";
import { aggregateHitStats, computeHits, type PredictionRecord, type SavedBettingPlan } from "@/lib/predictionLog";

const plan: SavedBettingPlan = {
  win: { horseName: "ドナリー", reason: "" },
  place: { horseName: "ドナリー", reason: "" },
  wide: { horseNames: ["キャピタルストーン", "トーセンシントラ"], reason: "" },
  trio: { horseNames: ["ドナリー", "アニエーネ", "キャピタルストーン"], reason: "" },
};

describe("computeHits", () => {
  it("marks win as a hit only when the pick is exactly 1着", () => {
    const hits = computeHits(plan, ["ドナリー", "アニエーネ", "キャピタルストーン"]);
    expect(hits.win).toBe(true);
  });

  it("marks win as a miss when the pick finishes 2着 even though it's in the podium", () => {
    const hits = computeHits(plan, ["アニエーネ", "ドナリー", "キャピタルストーン"]);
    expect(hits.win).toBe(false);
    expect(hits.place).toBe(true);
  });

  it("marks wide as a hit only when both picks land in the top 3, order-independent", () => {
    const hits = computeHits(plan, ["トーセンシントラ", "キャッチアップ", "キャピタルストーン"]);
    expect(hits.wide).toBe(true);
  });

  it("marks wide as a miss when only one pick lands in the top 3", () => {
    const hits = computeHits(plan, ["キャピタルストーン", "キャッチアップ", "コスモバルムンク"]);
    expect(hits.wide).toBe(false);
  });

  it("marks trio as a hit only when all three picks are exactly the top 3", () => {
    const hits = computeHits(plan, ["キャピタルストーン", "ドナリー", "アニエーネ"]);
    expect(hits.trio).toBe(true);
  });

  it("marks trio as a miss when a 4th horse sneaks into the podium instead of one pick", () => {
    const hits = computeHits(plan, ["ドナリー", "アニエーネ", "コスモバルムンク"]);
    expect(hits.trio).toBe(false);
  });

  it("returns null for bet types that had no pick", () => {
    const partialPlan: SavedBettingPlan = { win: plan.win, place: null, wide: null, trio: null };
    const hits = computeHits(partialPlan, ["ドナリー", "アニエーネ", "キャピタルストーン"]);
    expect(hits.place).toBeNull();
    expect(hits.wide).toBeNull();
    expect(hits.trio).toBeNull();
  });
});

describe("aggregateHitStats", () => {
  it("only counts records that have a recorded result", () => {
    const records: PredictionRecord[] = [
      { id: "1", raceName: "A", createdAt: "", bettingPlan: plan, result: null },
      {
        id: "2",
        raceName: "B",
        createdAt: "",
        bettingPlan: plan,
        result: { recordedAt: "", top3: ["ドナリー", "アニエーネ", "キャピタルストーン"] },
      },
    ];

    const stats = aggregateHitStats(records);
    expect(stats.win.attempts).toBe(1);
    expect(stats.win.hits).toBe(1);
  });

  it("accumulates hits and attempts across multiple recorded results", () => {
    const records: PredictionRecord[] = [
      {
        id: "1",
        raceName: "A",
        createdAt: "",
        bettingPlan: plan,
        result: { recordedAt: "", top3: ["ドナリー", "アニエーネ", "キャピタルストーン"] },
      },
      {
        id: "2",
        raceName: "B",
        createdAt: "",
        bettingPlan: plan,
        result: { recordedAt: "", top3: ["アニエーネ", "ドナリー", "キャピタルストーン"] },
      },
    ];

    const stats = aggregateHitStats(records);
    expect(stats.win.attempts).toBe(2);
    expect(stats.win.hits).toBe(1);
    expect(stats.place.attempts).toBe(2);
    expect(stats.place.hits).toBe(2);
  });
});
