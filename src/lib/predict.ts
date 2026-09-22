import { summarizeAllHorses, type HorseSummary } from "@/lib/analysis";
import type { PastPerformance } from "@/types/race";

/**
 * この番人気以降を「穴馬」候補とみなす。
 * 人気馬同士の組み合わせは的中率は高くても回収率が低くなりがちなので、
 * 「人気馬1頭 + 人気は低いが実力スコアが高い穴馬1頭」を狙う戦略に寄せている。
 */
const LONGSHOT_MIN_POPULARITY_RANK = 4;

export interface WidePick {
  /** 人気馬側の軸 */
  favorite: HorseSummary;
  /** 人気は低いが実力スコアが高い穴馬側の軸 */
  longshot: HorseSummary;
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
 * 「人気馬1頭 + 穴馬1頭」のワイド軸を提案する。
 *
 * popularityByHorseId が十分に揃っていない場合（人気を入力した馬が2頭未満）は
 * 人気馬/穴馬の判定ができないため、真の実力スコア上位2頭にフォールバックする。
 */
export function predictRace(
  entrantHorseIds: string[],
  entrantHorseNames: Map<string, string>,
  performances: PastPerformance[],
  popularityByHorseId: Map<string, number> = new Map()
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

  const widePick = pickFavoriteAndLongshot(ranked, popularityByHorseId, notes);

  return { ranked, noDataHorseNames, widePick, notes };
}

function pickFavoriteAndLongshot(
  ranked: HorseSummary[],
  popularityByHorseId: Map<string, number>,
  notes: string[]
): WidePick | null {
  const withPopularity = ranked.filter((s) => popularityByHorseId.has(s.horseId));

  if (withPopularity.length < 2) {
    if (ranked.length >= 2) {
      notes.push("人気の入力が足りないため、実力スコア上位2頭で代用しています。");
      const [primary, secondary] = ranked;
      return {
        favorite: primary,
        longshot: secondary,
        reason: `真の実力スコア上位2頭（${primary.horseName}: ${primary.avgAdjustedScore.toFixed(
          1
        )}点 / ${secondary.horseName}: ${secondary.avgAdjustedScore.toFixed(1)}点）`,
      };
    }
    return null;
  }

  const favorite = [...withPopularity].sort(
    (a, b) => popularityByHorseId.get(a.horseId)! - popularityByHorseId.get(b.horseId)!
  )[0];

  const others = withPopularity.filter((s) => s.horseId !== favorite.horseId);
  const longshotPool = others.filter(
    (s) => popularityByHorseId.get(s.horseId)! >= LONGSHOT_MIN_POPULARITY_RANK
  );
  const pool = longshotPool.length > 0 ? longshotPool : others;

  const longshot = [...pool].sort((a, b) => b.avgAdjustedScore - a.avgAdjustedScore)[0];

  const favoritePopularity = popularityByHorseId.get(favorite.horseId)!;
  const longshotPopularity = popularityByHorseId.get(longshot.horseId)!;

  return {
    favorite,
    longshot,
    reason: `本命: ${favorite.horseName}（${favoritePopularity}番人気 / 実力スコア${favorite.avgAdjustedScore.toFixed(
      1
    )}点） + 穴: ${longshot.horseName}（${longshotPopularity}番人気ながら実力スコア${longshot.avgAdjustedScore.toFixed(
      1
    )}点）`,
  };
}
