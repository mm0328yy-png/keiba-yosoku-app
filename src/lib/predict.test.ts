import { describe, expect, it } from "vitest";
import { predictRace } from "@/lib/predict";
import { samplePastPerformances } from "@/lib/sampleData";

const nameById = new Map(samplePastPerformances.map((pp) => [pp.horseId, pp.horseName]));

describe("predictRace", () => {
  it("ranks entrants by adjusted score and picks the top 2 for wide", () => {
    const entrantIds = [
      "horse-sunrise-hope",
      "horse-kiseki-no-hoshi",
      "horse-hayate-oji",
    ];
    const result = predictRace(entrantIds, nameById, samplePastPerformances);

    expect(result.ranked).toHaveLength(3);
    expect(result.noDataHorseNames).toHaveLength(0);
    expect(result.widePick).not.toBeNull();
    expect(result.widePick!.primary.horseId).toBe(result.ranked[0].horseId);
    expect(result.widePick!.secondary.horseId).toBe(result.ranked[1].horseId);

    // サンライズホープは不利で泣いた馬なので注記に含まれるはず
    expect(result.notes.some((n) => n.includes("サンライズホープ"))).toBe(true);
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
