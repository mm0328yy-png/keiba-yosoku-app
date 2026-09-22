import { summarizeAllHorses, type HorseSummary } from "@/lib/analysis";
import type { PastPerformance } from "@/types/race";

/**
 * 単勝・複勝・ワイドの「穴」候補で、オッズが分からない馬しかいない場合に使う
 * 人気の下限。人気馬同士の組み合わせは的中率は高くても回収率が低くなりがちなので、
 * 「人気馬1頭 + 人気は低いが実力スコアが高い穴馬1頭」を狙う戦略に寄せている。
 */
const LONGSHOT_MIN_POPULARITY_RANK = 4;

/**
 * 単勝・複勝の「穴」候補は、単勝オッズがこの倍率以上の馬から選ぶ。
 * 複勝は人気馬だと配当がほとんど付かないため、ワイドより厳しめの基準にしている。
 */
const WIN_PLACE_MIN_ODDS = 10;

/**
 * ワイドの「穴」候補は、実際のワイドオッズが分からない場合の代用として、
 * 単勝オッズがこの倍率以上の馬にする（ワイド配当そのものではなく、あくまで簡易的な目安）。
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

interface OddsOrPopularityPick {
  horse: HorseSummary;
  odds: number | null;
  popularity: number | null;
}

/**
 * favorite を除いた候補の中から、まず単勝オッズが minOdds 倍以上の馬を優先して選び
 * （その中で実力スコア最高の馬）、該当がなければ「popularity 番人気以下」プールに
 * フォールバックする。
 */
function pickByOddsThenPopularity(
  others: HorseSummary[],
  oddsByHorseId: Map<string, number>,
  popularityByHorseId: Map<string, number>,
  minOdds: number,
  fallbackNote: string,
  notes: string[]
): OddsOrPopularityPick {
  const oddsPool = others.filter((s) => {
    const odds = oddsByHorseId.get(s.horseId);
    return odds !== undefined && odds >= minOdds;
  });

  if (oddsPool.length > 0) {
    const horse = [...oddsPool].sort((a, b) => b.avgAdjustedScore - a.avgAdjustedScore)[0];
    return {
      horse,
      odds: oddsByHorseId.get(horse.horseId)!,
      popularity: popularityByHorseId.get(horse.horseId) ?? null,
    };
  }

  if (oddsByHorseId.size > 0) notes.push(fallbackNote);

  const withPopularity = others.filter((s) => popularityByHorseId.has(s.horseId));
  const popPool = withPopularity.filter(
    (s) => popularityByHorseId.get(s.horseId)! >= LONGSHOT_MIN_POPULARITY_RANK
  );
  const finalPool = popPool.length > 0 ? popPool : withPopularity.length > 0 ? withPopularity : others;
  const horse = [...finalPool].sort((a, b) => b.avgAdjustedScore - a.avgAdjustedScore)[0];

  return {
    horse,
    odds: oddsByHorseId.get(horse.horseId) ?? null,
    popularity: popularityByHorseId.get(horse.horseId) ?? null,
  };
}

function oddsOrPopularityLabel(pick: OddsOrPopularityPick): string {
  return pick.odds !== null ? `単勝${pick.odds.toFixed(1)}倍` : `${pick.popularity ?? "?"}番人気`;
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
  let winPlacePick: OddsOrPopularityPick;
  let estimatedWidePick: OddsOrPopularityPick;

  if (withPopularity.length < 2) {
    notes.push("人気の入力が足りないため、実力スコア上位2頭で代用しています。");
    favorite = ranked[0];
    favoritePopularity = null;
    const fallback: OddsOrPopularityPick = {
      horse: ranked[1],
      odds: oddsByHorseId.get(ranked[1].horseId) ?? null,
      popularity: null,
    };
    winPlacePick = fallback;
    estimatedWidePick = fallback;
  } else {
    favorite = [...withPopularity].sort(
      (a, b) => popularityByHorseId.get(a.horseId)! - popularityByHorseId.get(b.horseId)!
    )[0];
    favoritePopularity = popularityByHorseId.get(favorite.horseId)!;

    const others = ranked.filter((s) => s.horseId !== favorite.horseId);

    winPlacePick = pickByOddsThenPopularity(
      others,
      oddsByHorseId,
      popularityByHorseId,
      WIN_PLACE_MIN_ODDS,
      `単勝${WIN_PLACE_MIN_ODDS}倍以上の馬がいなかったため、単勝・複勝は${LONGSHOT_MIN_POPULARITY_RANK}番人気以下から代用しています。`,
      notes
    );

    estimatedWidePick = pickByOddsThenPopularity(
      others,
      oddsByHorseId,
      popularityByHorseId,
      WIDE_LONGSHOT_MIN_ODDS,
      `単勝${WIDE_LONGSHOT_MIN_ODDS}倍以上の馬がいなかったため、ワイドの穴も${LONGSHOT_MIN_POPULARITY_RANK}番人気以下から代用しています。`,
      notes
    );
  }

  const win: SingleBetPick = {
    horse: winPlacePick.horse,
    reason: `${winPlacePick.horse.horseName}は${oddsOrPopularityLabel(
      winPlacePick
    )}ながら実力スコア${winPlacePick.horse.avgAdjustedScore.toFixed(
      1
    )}点。単勝${WIN_PLACE_MIN_ODDS}倍未満の人気馬は妙味が薄いため、期待値重視でこちらを本命視。`,
  };

  const place: SingleBetPick = {
    horse: winPlacePick.horse,
    reason: `本命人気（${favorite.horseName}）の複勝は配当が小さくなりがちなので見送り、${
      winPlacePick.horse.horseName
    }（${oddsOrPopularityLabel(winPlacePick)}）の複勝で回収率を狙う。`,
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
    wide = {
      favorite,
      longshot: estimatedWidePick.horse,
      reason: `本命: ${favorite.horseName}（${
        favoritePopularity ?? "?"
      }番人気 / 実力スコア${favorite.avgAdjustedScore.toFixed(1)}点） + 穴: ${
        estimatedWidePick.horse.horseName
      }（${oddsOrPopularityLabel(estimatedWidePick)}・実力スコア${estimatedWidePick.horse.avgAdjustedScore.toFixed(
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
