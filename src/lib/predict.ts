import { summarizeAllHorses, type HorseSummary } from "@/lib/analysis";
import type { PastPerformance } from "@/types/race";

/**
 * この番人気以降を「穴馬」候補とみなす。
 * 人気馬同士の組み合わせは的中率は高くても回収率が低くなりがちなので、
 * 「人気馬1頭 + 人気は低いが実力スコアが高い穴馬1頭」を狙う戦略に寄せている。
 */
const LONGSHOT_MIN_POPULARITY_RANK = 4;

export interface SingleBetPick {
  horse: HorseSummary;
  reason: string;
}

export interface WidePick {
  /** 人気馬側の軸 */
  favorite: HorseSummary;
  /** 人気は低いが実力スコアが高い穴馬側の軸 */
  longshot: HorseSummary;
  reason: string;
}

export interface TrioPick {
  /** 真の実力スコア上位3頭（3連複のBOX対象） */
  horses: [HorseSummary, HorseSummary, HorseSummary];
  reason: string;
}

export interface BettingPlan {
  /** 単勝: 回収率重視で「穴」側の馬を本命視する */
  win: SingleBetPick | null;
  /** 複勝: 人気馬は配当妙味が薄いため、こちらも「穴」側を本命視する */
  place: SingleBetPick | null;
  /** ワイド: 人気馬1頭 + 穴馬1頭 */
  wide: WidePick | null;
  /** 3連複: 真の実力スコア上位3頭のBOX */
  trio: TrioPick | null;
}

export interface RacePrediction {
  /** 出走馬のうち、過去成績データがあった馬。真の実力スコア順 */
  ranked: HorseSummary[];
  /** 出走馬として選ばれたが、過去成績データが一件もない馬 */
  noDataHorseNames: string[];
  bettingPlan: BettingPlan;
  /** 不利に泣かされていた馬などについての注記 */
  notes: string[];
}

/**
 * 指定した出走馬（horseId）同士を、登録済みの前走データから比較し、
 * 単勝・複勝・ワイド・3連複の買い目を提案する。
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

  const bettingPlan = buildBettingPlan(ranked, popularityByHorseId, notes);

  return { ranked, noDataHorseNames, bettingPlan, notes };
}

function buildBettingPlan(
  ranked: HorseSummary[],
  popularityByHorseId: Map<string, number>,
  notes: string[]
): BettingPlan {
  const pair = pickFavoriteAndValue(ranked, popularityByHorseId, notes);
  const trio = pickTrio(ranked);

  if (!pair) {
    return { win: null, place: null, wide: null, trio };
  }

  const { favorite, value, favoritePopularity, valuePopularity } = pair;

  const win: SingleBetPick = {
    horse: value,
    reason: `${value.horseName}は${valuePopularity ?? "?"}番人気ながら実力スコア${value.avgAdjustedScore.toFixed(
      1
    )}点。人気馬の単勝は妙味が薄いため、期待値重視でこちらを本命視。`,
  };

  const place: SingleBetPick = {
    horse: value,
    reason: `本命人気（${favorite.horseName}）の複勝は配当が小さくなりがちなので見送り、${value.horseName}の複勝で回収率を狙う。`,
  };

  const wide: WidePick = {
    favorite,
    longshot: value,
    reason: `本命: ${favorite.horseName}（${favoritePopularity ?? "?"}番人気 / 実力スコア${favorite.avgAdjustedScore.toFixed(
      1
    )}点） + 穴: ${value.horseName}（${valuePopularity ?? "?"}番人気ながら実力スコア${value.avgAdjustedScore.toFixed(
      1
    )}点）`,
  };

  return { win, place, wide, trio };
}

function pickTrio(ranked: HorseSummary[]): TrioPick | null {
  if (ranked.length < 3) return null;
  const [a, b, c] = ranked;
  return {
    horses: [a, b, c],
    reason: `真の実力スコア上位3頭のBOX: ${a.horseName}(${a.avgAdjustedScore.toFixed(1)}点) / ${b.horseName}(${b.avgAdjustedScore.toFixed(
      1
    )}点) / ${c.horseName}(${c.avgAdjustedScore.toFixed(1)}点)`,
  };
}

interface FavoriteValuePair {
  favorite: HorseSummary;
  value: HorseSummary;
  /** 人気情報がある場合のみセットされる */
  favoritePopularity: number | null;
  valuePopularity: number | null;
}

function pickFavoriteAndValue(
  ranked: HorseSummary[],
  popularityByHorseId: Map<string, number>,
  notes: string[]
): FavoriteValuePair | null {
  const withPopularity = ranked.filter((s) => popularityByHorseId.has(s.horseId));

  if (withPopularity.length < 2) {
    if (ranked.length >= 2) {
      notes.push("人気の入力が足りないため、実力スコア上位2頭で代用しています。");
      const [favorite, value] = ranked;
      return { favorite, value, favoritePopularity: null, valuePopularity: null };
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

  const value = [...pool].sort((a, b) => b.avgAdjustedScore - a.avgAdjustedScore)[0];

  return {
    favorite,
    value,
    favoritePopularity: popularityByHorseId.get(favorite.horseId)!,
    valuePopularity: popularityByHorseId.get(value.horseId)!,
  };
}
