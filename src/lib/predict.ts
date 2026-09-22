import { summarizeAllHorses, type HorseSummary } from "@/lib/analysis";
import type { PastPerformance } from "@/types/race";

/**
 * 単勝・複勝の「穴」候補は、この番人気以降から選ぶ。
 * 人気馬同士の組み合わせは的中率は高くても回収率が低くなりがちなので、
 * 「人気馬1頭 + 人気は低いが実力スコアが高い穴馬1頭」を狙う戦略に寄せている。
 */
const LONGSHOT_MIN_POPULARITY_RANK = 4;

/**
 * 実際のワイドオッズが分からない場合の代用として、単勝オッズがこの倍率以上の
 * 馬を「穴」候補にする（ワイド配当そのものではなく、あくまで簡易的な目安）。
 */
const WIDE_LONGSHOT_MIN_ODDS = 8;

/**
 * 実際のワイドオッズ（組み合わせそのものの配当）を入力した場合、この倍率以上を狙う。
 * 人気馬同士を組むとワイド配当は的中率が高い分小さくなりがちなので、
 * 単勝オッズ単体では実際の配当の高さを正確には言い当てられない。実オッズが
 * 分かるならそちらを優先する。
 */
const WIDE_COMBO_MIN_ODDS = 8;

/** 2頭の horseId から、順不同で同じキーになる組み合わせキーを作る */
export function widePairKey(horseIdA: string, horseIdB: string): string {
  return [horseIdA, horseIdB].sort().join("__");
}

export interface SingleBetPick {
  horse: HorseSummary;
  reason: string;
}

export interface WidePick {
  /** 組み合わせの片側（人気馬側、または実オッズ表がある場合は人気が高い方） */
  favorite: HorseSummary;
  /** 組み合わせのもう片側（穴側） */
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
  /** ワイド: 実際のワイドオッズが分かればそこから、なければ単勝オッズ・人気から推定 */
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
 * wideOddsByPair（widePairKey でキー化した実際のワイドオッズ）があればそれを最優先し、
 * なければ oddsByHorseId（単勝オッズ）からの簡易推定にフォールバックする。
 */
export function predictRace(
  entrantHorseIds: string[],
  entrantHorseNames: Map<string, string>,
  performances: PastPerformance[],
  popularityByHorseId: Map<string, number> = new Map(),
  oddsByHorseId: Map<string, number> = new Map(),
  wideOddsByPair: Map<string, number> = new Map()
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

  const bettingPlan = buildBettingPlan(ranked, popularityByHorseId, oddsByHorseId, wideOddsByPair, notes);

  return { ranked, noDataHorseNames, bettingPlan, notes };
}

function buildBettingPlan(
  ranked: HorseSummary[],
  popularityByHorseId: Map<string, number>,
  oddsByHorseId: Map<string, number>,
  wideOddsByPair: Map<string, number>,
  notes: string[]
): BettingPlan {
  const trio = pickTrio(ranked);

  if (ranked.length < 2) {
    return { win: null, place: null, wide: null, trio };
  }

  const withPopularity = ranked.filter((s) => popularityByHorseId.has(s.horseId));

  let favorite: HorseSummary;
  let favoritePopularity: number | null;
  let winPlaceValue: HorseSummary;
  let winPlaceValuePopularity: number | null;
  let estimatedWideValue: HorseSummary;
  let estimatedWideValueOdds: number | null;
  let estimatedWideValuePopularity: number | null;

  if (withPopularity.length < 2) {
    notes.push("人気の入力が足りないため、実力スコア上位2頭で代用しています。");
    favorite = ranked[0];
    favoritePopularity = null;
    winPlaceValue = ranked[1];
    winPlaceValuePopularity = null;
    estimatedWideValue = ranked[1];
    estimatedWideValueOdds = oddsByHorseId.get(ranked[1].horseId) ?? null;
    estimatedWideValuePopularity = null;
  } else {
    favorite = [...withPopularity].sort(
      (a, b) => popularityByHorseId.get(a.horseId)! - popularityByHorseId.get(b.horseId)!
    )[0];
    favoritePopularity = popularityByHorseId.get(favorite.horseId)!;

    const others = withPopularity.filter((s) => s.horseId !== favorite.horseId);
    const winPlacePool = others.filter(
      (s) => popularityByHorseId.get(s.horseId)! >= LONGSHOT_MIN_POPULARITY_RANK
    );
    const winPlaceFinalPool = winPlacePool.length > 0 ? winPlacePool : others;
    winPlaceValue = [...winPlaceFinalPool].sort((a, b) => b.avgAdjustedScore - a.avgAdjustedScore)[0];
    winPlaceValuePopularity = popularityByHorseId.get(winPlaceValue.horseId)!;

    const allOthers = ranked.filter((s) => s.horseId !== favorite.horseId);
    const oddsInRange = allOthers.filter((s) => {
      const odds = oddsByHorseId.get(s.horseId);
      return odds !== undefined && odds >= WIDE_LONGSHOT_MIN_ODDS;
    });

    if (oddsInRange.length > 0) {
      estimatedWideValue = [...oddsInRange].sort((a, b) => b.avgAdjustedScore - a.avgAdjustedScore)[0];
      estimatedWideValueOdds = oddsByHorseId.get(estimatedWideValue.horseId)!;
      estimatedWideValuePopularity = popularityByHorseId.get(estimatedWideValue.horseId) ?? null;
    } else {
      if (oddsByHorseId.size > 0) {
        notes.push(
          `単勝${WIDE_LONGSHOT_MIN_ODDS}倍以上の馬がいなかったため、ワイドの穴も${LONGSHOT_MIN_POPULARITY_RANK}番人気以下から代用しています。`
        );
      }
      estimatedWideValue = winPlaceValue;
      estimatedWideValueOdds = oddsByHorseId.get(estimatedWideValue.horseId) ?? null;
      estimatedWideValuePopularity = winPlaceValuePopularity;
    }
  }

  const win: SingleBetPick = {
    horse: winPlaceValue,
    reason: `${winPlaceValue.horseName}は${
      winPlaceValuePopularity ?? "?"
    }番人気ながら実力スコア${winPlaceValue.avgAdjustedScore.toFixed(
      1
    )}点。人気馬の単勝は妙味が薄いため、期待値重視でこちらを本命視。`,
  };

  const place: SingleBetPick = {
    horse: winPlaceValue,
    reason: `本命人気（${favorite.horseName}）の複勝は配当が小さくなりがちなので見送り、${winPlaceValue.horseName}の複勝で回収率を狙う。`,
  };

  const realWide = pickWideFromRealOdds(ranked, wideOddsByPair, popularityByHorseId, notes);

  let wide: WidePick;
  if (realWide) {
    wide = {
      favorite: realWide.first,
      longshot: realWide.second,
      reason: `実際のワイドオッズ${realWide.odds.toFixed(1)}倍: ${realWide.first.horseName}（実力スコア${realWide.first.avgAdjustedScore.toFixed(
        1
      )}点） − ${realWide.second.horseName}（実力スコア${realWide.second.avgAdjustedScore.toFixed(1)}点）`,
    };
  } else {
    const estimatedWideValueLabel =
      estimatedWideValueOdds !== null
        ? `単勝${estimatedWideValueOdds.toFixed(1)}倍`
        : `${estimatedWideValuePopularity ?? "?"}番人気`;

    wide = {
      favorite,
      longshot: estimatedWideValue,
      reason: `本命: ${favorite.horseName}（${
        favoritePopularity ?? "?"
      }番人気 / 実力スコア${favorite.avgAdjustedScore.toFixed(1)}点） + 穴: ${
        estimatedWideValue.horseName
      }（${estimatedWideValueLabel}・実力スコア${estimatedWideValue.avgAdjustedScore.toFixed(
        1
      )}点、単勝オッズからの推定）`,
    };
  }

  return { win, place, wide, trio };
}

interface RealWidePick {
  first: HorseSummary;
  second: HorseSummary;
  odds: number;
}

/**
 * 実際に入力されたワイドオッズの中から、配当が WIDE_COMBO_MIN_ODDS 倍以上で
 * 2頭合計の実力スコアが最も高い組み合わせを選ぶ。
 */
function pickWideFromRealOdds(
  ranked: HorseSummary[],
  wideOddsByPair: Map<string, number>,
  popularityByHorseId: Map<string, number>,
  notes: string[]
): RealWidePick | null {
  if (wideOddsByPair.size === 0) return null;

  const byId = new Map(ranked.map((s) => [s.horseId, s]));
  const candidates: { a: HorseSummary; b: HorseSummary; odds: number }[] = [];
  for (const [key, odds] of wideOddsByPair.entries()) {
    const [idA, idB] = key.split("__");
    const a = byId.get(idA);
    const b = byId.get(idB);
    if (a && b) candidates.push({ a, b, odds });
  }
  if (candidates.length === 0) return null;

  const inRange = candidates.filter((c) => c.odds >= WIDE_COMBO_MIN_ODDS);
  if (inRange.length === 0) {
    notes.push(
      `入力されたワイドオッズの中に${WIDE_COMBO_MIN_ODDS}倍以上の組み合わせがなかったため、単勝オッズ・人気からの推定に切り替えています。`
    );
    return null;
  }

  const best = [...inRange].sort(
    (x, y) => y.a.avgAdjustedScore + y.b.avgAdjustedScore - (x.a.avgAdjustedScore + x.b.avgAdjustedScore)
  )[0];

  const aPop = popularityByHorseId.get(best.a.horseId);
  const bPop = popularityByHorseId.get(best.b.horseId);
  let first = best.a;
  let second = best.b;
  if (aPop !== undefined && bPop !== undefined) {
    if (bPop < aPop) {
      first = best.b;
      second = best.a;
    }
  } else if (best.b.avgAdjustedScore > best.a.avgAdjustedScore) {
    first = best.b;
    second = best.a;
  }

  return { first, second, odds: best.odds };
}

function pickTrio(ranked: HorseSummary[]): TrioPick | null {
  if (ranked.length < 3) return null;
  const [a, b, c] = ranked;
  return {
    horses: [a, b, c],
    reason: `真の実力スコア上位3頭のBOX: ${a.horseName}(${a.avgAdjustedScore.toFixed(
      1
    )}点) / ${b.horseName}(${b.avgAdjustedScore.toFixed(1)}点) / ${c.horseName}(${c.avgAdjustedScore.toFixed(
      1
    )}点)`,
  };
}
