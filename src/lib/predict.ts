import { summarizeAllHorses, type HorseSummary } from "@/lib/analysis";
import type { PastPerformance } from "@/types/race";

export interface WidePick {
  primary: HorseSummary;
  secondary: HorseSummary;
  reason: string;
}

export interface RacePrediction {
  /** 出走馬のうち、過去成績データがあった馬。真の実力スコア順 */
  ranked: HorseSummary[];
  /** 出走馬として選ばれたが、過去成績データが一件もない馬 */
  noDataHorseNames: string[];
  widePick: WidePick | null;
  /** 不利に泣かされていた馬などについての注記 */
  notes: string[];
}

/**
 * 指定した出走馬（horseId）同士を、登録済みの前走データから比較し、
 * ワイドの軸2頭を提案する。
 */
export function predictRace(
  entrantHorseIds: string[],
  entrantHorseNames: Map<string, string>,
  performances: PastPerformance[]
): RacePrediction {
  const entrantSet = new Set(entrantHorseIds);
  const relevant = performances.filter((pp) => entrantSet.has(pp.horseId));
  const ranked = summarizeAllHorses(relevant);

  const rankedIds = new Set(ranked.map((s) => s.horseId));
  const noDataHorseNames = entrantHorseIds
    .filter((id) => !rankedIds.has(id))
    .map((id) => entrantHorseNames.get(id) ?? id);

  const notes: string[] = [];
  for (const s of ranked) {
    if (s.unluckyLossCount > 0) {
      notes.push(
        `${s.horseName}: 過去${s.unluckyLossCount}走で大きな不利あり（平均+${s.avgLuckAdjustment.toFixed(
          1
        )}点補正）。着順以上に評価すべき一頭。`
      );
    }
  }

  let widePick: WidePick | null = null;
  if (ranked.length >= 2) {
    const [primary, secondary] = ranked;
    widePick = {
      primary,
      secondary,
      reason: `真の実力スコア上位2頭（${primary.horseName}: ${primary.avgAdjustedScore.toFixed(
        1
      )}点 / ${secondary.horseName}: ${secondary.avgAdjustedScore.toFixed(1)}点）`,
    };
  }

  return { ranked, noDataHorseNames, widePick, notes };
}
