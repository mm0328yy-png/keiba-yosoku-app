import { describe, expect, it } from "vitest";
import { predictRace } from "@/lib/predict";
import { samplePastPerformances } from "@/lib/sampleData";

const nameById = new Map(samplePastPerformances.map((pp) => [pp.horseId, pp.horseName]));

const ENTRANTS = ["horse-sunrise-hope", "horse-kiseki-no-hoshi", "horse-hayate-oji"];

describe("predictRace", () => {
  it("falls back to top-2 by adjusted score when popularity is missing", () => {
    const result = predictRace(ENTRANTS, nameById, samplePastPerformances);

    expect(result.ranked).toHaveLength(3);
    expect(result.widePick).not.toBeNull();
    expect(result.widePick!.favorite.horseId).toBe(result.ranked[0].horseId);
    expect(result.widePick!.longshot.horseId).toBe(result.ranked[1].horseId);
    expect(result.notes.some((n) => n.includes("人気の入力が足りない"))).toBe(true);

    // サンライズホープは不利で泣いた馬なので注記に含まれるはず
    expect(result.notes.some((n) => n.includes("サンライズホープ"))).toBe(true);
  });

  it("picks the most popular horse as favorite and the best-scoring longshot (4番人気以下) as the value pick", () => {
    const popularity = new Map([
      ["horse-kiseki-no-hoshi", 1],
      ["horse-hayate-oji", 2],
      ["horse-sunrise-hope", 5],
    ]);

    const result = predictRace(ENTRANTS, nameById, samplePastPerformances, popularity);

    expect(result.widePick).not.toBeNull();
    expect(result.widePick!.favorite.horseId).toBe("horse-kiseki-no-hoshi");
    expect(result.widePick!.longshot.horseId).toBe("horse-sunrise-hope");
    expect(result.widePick!.reason).toContain("本命");
    expect(result.widePick!.reason).toContain("穴");
  });

  it("falls back to the best-scoring non-favorite when nobody is 4番人気以下", () => {
    const popularity = new Map([
      ["horse-hayate-oji", 1],
      ["horse-kiseki-no-hoshi", 2],
      ["horse-sunrise-hope", 3],
    ]);

    const result = predictRace(ENTRANTS, nameById, samplePastPerformances, popularity);

    // favorite = 1番人気のハヤテオウジ。穴候補（4番人気以下）がいないので
    // 残り2頭のうち実力スコアが高いキセキノホシが選ばれる。
    expect(result.widePick!.favorite.horseId).toBe("horse-hayate-oji");
    expect(result.widePick!.longshot.horseId).toBe("horse-kiseki-no-hoshi");
  });

  it("excludes horses not entered in the race", () => {
    const result = predictRace(["horse-kiseki-no-hoshi"], nameById, samplePastPerformances);
    expect(result.ranked).toHaveLength(1);
    expect(result.ranked[0].horseId).toBe("horse-kiseki-no-hoshi");
    expect(result.widePick).toBeNull();
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
