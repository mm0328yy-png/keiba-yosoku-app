import { describe, expect, it } from "vitest";
import { predictRace, widePairKey } from "@/lib/predict";
import { samplePastPerformances } from "@/lib/sampleData";

const nameById = new Map(samplePastPerformances.map((pp) => [pp.horseId, pp.horseName]));

const ENTRANTS = ["horse-sunrise-hope", "horse-kiseki-no-hoshi", "horse-hayate-oji"];

describe("predictRace", () => {
  it("falls back to top-2/top-3 by adjusted score when popularity is missing", () => {
    const result = predictRace(ENTRANTS, nameById, samplePastPerformances);

    expect(result.ranked).toHaveLength(3);
    const { win, place, wide, trio } = result.bettingPlan;

    expect(wide).not.toBeNull();
    expect(wide!.favorite.horseId).toBe(result.ranked[0].horseId);
    expect(wide!.longshot.horseId).toBe(result.ranked[1].horseId);
    expect(win!.horse.horseId).toBe(result.ranked[1].horseId);
    expect(place!.horse.horseId).toBe(result.ranked[1].horseId);
    expect(trio!.horses.map((h) => h.horseId)).toEqual(result.ranked.map((h) => h.horseId));

    expect(result.notes.some((n) => n.includes("人気の入力が足りない"))).toBe(true);
    expect(result.notes.some((n) => n.includes("サンライズホープ"))).toBe(true);
  });

  it("picks the most popular horse as favorite and the best-scoring longshot (4番人気以下) for win/place/wide", () => {
    const popularity = new Map([
      ["horse-kiseki-no-hoshi", 1],
      ["horse-hayate-oji", 2],
      ["horse-sunrise-hope", 5],
    ]);

    const result = predictRace(ENTRANTS, nameById, samplePastPerformances, popularity);
    const { win, place, wide, trio } = result.bettingPlan;

    expect(wide!.favorite.horseId).toBe("horse-kiseki-no-hoshi");
    expect(wide!.longshot.horseId).toBe("horse-sunrise-hope");
    expect(win!.horse.horseId).toBe("horse-sunrise-hope");
    expect(place!.horse.horseId).toBe("horse-sunrise-hope");
    expect(win!.reason).toContain("単勝");
    expect(place!.reason).toContain("複勝");
    expect(trio).not.toBeNull();
    expect(trio!.horses).toHaveLength(3);
  });

  it("picks the wide longshot from the 8倍以上 odds zone even when it differs from the win/place pick", () => {
    const popularity = new Map([
      ["horse-kiseki-no-hoshi", 1],
      ["horse-hayate-oji", 2],
      ["horse-sunrise-hope", 5],
    ]);
    // サンライズホープは4番人気以下プールで単複の穴になるが、オッズは圏外。
    // ハヤテオウジは2番人気でも、オッズだけ見ると8倍以上ゾーンに入っている想定。
    const odds = new Map([
      ["horse-hayate-oji", 9.0],
      ["horse-sunrise-hope", 3.0],
    ]);

    const result = predictRace(ENTRANTS, nameById, samplePastPerformances, popularity, odds);
    const { win, place, wide } = result.bettingPlan;

    expect(win!.horse.horseId).toBe("horse-sunrise-hope");
    expect(place!.horse.horseId).toBe("horse-sunrise-hope");
    expect(wide!.longshot.horseId).toBe("horse-hayate-oji");
    expect(wide!.reason).toContain("単勝9.0倍");
  });

  it("has no upper bound: a 20倍 horse still qualifies for the wide longshot pool", () => {
    const popularity = new Map([
      ["horse-kiseki-no-hoshi", 1],
      ["horse-hayate-oji", 2],
      ["horse-sunrise-hope", 5],
    ]);
    // ハヤテオウジにはオッズ情報がなく、オッズが分かるのはサンライズホープの20倍だけ。
    const odds = new Map([["horse-sunrise-hope", 20.0]]);

    const result = predictRace(ENTRANTS, nameById, samplePastPerformances, popularity, odds);
    const { wide } = result.bettingPlan;

    expect(wide!.longshot.horseId).toBe("horse-sunrise-hope");
    expect(wide!.reason).toContain("単勝20.0倍");
  });

  it("falls back to the popularity-based pool when nobody's odds reach 8倍", () => {
    const popularity = new Map([
      ["horse-kiseki-no-hoshi", 1],
      ["horse-hayate-oji", 2],
      ["horse-sunrise-hope", 5],
    ]);
    const odds = new Map([
      ["horse-hayate-oji", 3.0],
      ["horse-sunrise-hope", 5.0],
    ]);

    const result = predictRace(ENTRANTS, nameById, samplePastPerformances, popularity, odds);
    const { wide } = result.bettingPlan;

    expect(wide!.longshot.horseId).toBe("horse-sunrise-hope");
    expect(result.notes.some((n) => n.includes("ワイドの穴も"))).toBe(true);
  });

  it("prefers a real wide-odds combo over the odds/popularity estimate", () => {
    const popularity = new Map([
      ["horse-kiseki-no-hoshi", 1],
      ["horse-hayate-oji", 2],
      ["horse-sunrise-hope", 5],
    ]);
    const wideOdds = new Map([
      [widePairKey("horse-kiseki-no-hoshi", "horse-hayate-oji"), 3.0],
      [widePairKey("horse-kiseki-no-hoshi", "horse-sunrise-hope"), 9.0],
      [widePairKey("horse-hayate-oji", "horse-sunrise-hope"), 15.0],
    ]);

    const result = predictRace(
      ENTRANTS,
      nameById,
      samplePastPerformances,
      popularity,
      new Map(),
      wideOdds
    );
    const { wide } = result.bettingPlan;

    // 8倍以上の組み合わせのうち合計実力スコアが最も高いのはハヤテオウジ+サンライズホープ(15.0倍)
    expect(wide!.favorite.horseId).toBe("horse-hayate-oji");
    expect(wide!.longshot.horseId).toBe("horse-sunrise-hope");
    expect(wide!.reason).toContain("実際のワイドオッズ15.0倍");
  });

  it("falls back to the odds/popularity estimate when no real wide-odds combo reaches 8倍", () => {
    const popularity = new Map([
      ["horse-kiseki-no-hoshi", 1],
      ["horse-hayate-oji", 2],
      ["horse-sunrise-hope", 5],
    ]);
    // 実際の4-5のワイドが4.5倍だった、というような現実のケースを想定
    const wideOdds = new Map([
      [widePairKey("horse-kiseki-no-hoshi", "horse-hayate-oji"), 2.0],
      [widePairKey("horse-kiseki-no-hoshi", "horse-sunrise-hope"), 4.5],
      [widePairKey("horse-hayate-oji", "horse-sunrise-hope"), 6.0],
    ]);

    const result = predictRace(
      ENTRANTS,
      nameById,
      samplePastPerformances,
      popularity,
      new Map(),
      wideOdds
    );
    const { wide } = result.bettingPlan;

    expect(wide!.reason).toContain("単勝オッズからの推定");
    expect(
      result.notes.some((n) => n.includes("入力されたワイドオッズの中に8倍以上の組み合わせがなかった"))
    ).toBe(true);
  });

  it("widePairKey is order-independent", () => {
    expect(widePairKey("a", "b")).toBe(widePairKey("b", "a"));
  });

  it("falls back to the best-scoring non-favorite when nobody is 4番人気以下", () => {
    const popularity = new Map([
      ["horse-hayate-oji", 1],
      ["horse-kiseki-no-hoshi", 2],
      ["horse-sunrise-hope", 3],
    ]);

    const result = predictRace(ENTRANTS, nameById, samplePastPerformances, popularity);
    const { wide } = result.bettingPlan;

    // favorite = 1番人気のハヤテオウジ。穴候補（4番人気以下）がいないので
    // 残り2頭のうち実力スコアが高いキセキノホシが選ばれる。
    expect(wide!.favorite.horseId).toBe("horse-hayate-oji");
    expect(wide!.longshot.horseId).toBe("horse-kiseki-no-hoshi");
  });

  it("has no trio pick with fewer than 3 ranked entrants", () => {
    const result = predictRace(
      ["horse-kiseki-no-hoshi", "horse-hayate-oji"],
      nameById,
      samplePastPerformances
    );
    expect(result.bettingPlan.trio).toBeNull();
  });

  it("excludes horses not entered in the race", () => {
    const result = predictRace(["horse-kiseki-no-hoshi"], nameById, samplePastPerformances);
    expect(result.ranked).toHaveLength(1);
    expect(result.ranked[0].horseId).toBe("horse-kiseki-no-hoshi");
    expect(result.bettingPlan.wide).toBeNull();
    expect(result.bettingPlan.win).toBeNull();
    expect(result.bettingPlan.place).toBeNull();
    expect(result.bettingPlan.trio).toBeNull();
  });

  it("reports entrants with no past performance data", () => {
    const namesWithGhost = new Map(nameById);
    namesWithGhost.set("horse-unknown", "ミステリーホース");

    const result = predictRace(
      ["horse-kiseki-no-hoshi", "horse-unknown"],
      namesWithGhost,
      samplePastPerformances
    );

    expect(result.ranked).toHaveLength(1);
    expect(result.noDataHorseNames).toEqual(["ミステリーホース"]);
  });
});
