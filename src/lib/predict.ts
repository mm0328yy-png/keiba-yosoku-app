import { summarizeAllHorses, type HorseSummary } from "@/lib/analysis";
import type { PastPerformance } from "@/types/race";

/**
 * 単勝・複勝の「穴」候補は、この番人気以降から選ぶ。
 * 人気馬同士の組み合わせは的中率は高くても回収率が低くなりがちなので、
 * 「人気馬1頭 + 人気は低いが実力スコアが高い穴馬1頭」を狙う戦略に寄せている。
 */
const LONGSHOT_MIN_POPULARITY_RANK = 4;

/**
 * ワイドの「穴」候補は、単勝オッズがこの範囲にある馬から選ぶ。
 * オッズが分からない馬しかいない場合は LONGSHOT_MIN_POPULARITY_RANK にフォールバックする。
 */
const WIDE_LONGSHOT_ODDS_MIN = 8;
const WIDE_LONGSHOT_ODDS_MAX = 10;

export interface SingleBetPick {
  horse: HorseSummary;
  reason: string;
}

export interface WidePick {
  /** 人気馬側の軸 */
  favorite: HorseSummary;
  /** オッズ8〜10倍ゾーンから選ぶ穴馬側の軸 */
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
  /** ワイド: 人気馬1頭 + オッズ8〜10倍ゾーンの穴馬1頭 */
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
 * oddsByHorseId が与えられていれば、ワイドの穴はオッズ8〜10倍ゾーンから選ぶ。
 */
export function predictRace(
  entrantHorseIds: string[],
  entrantHorseNames: Map<string, string>,
  performances: PastPerformance[],
  popularityByHorseId: Map<string, number> = new Map(),
  oddsByHorseId: Map<string, number> = new Map()
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

  const bettingPlan = buildBettingPlan(ranked, popularityByHorseId, oddsByHorseId, notes);

  return { ranked, noDataHorseNames, bettingPlan, notes };
}

function buildBettingPlan(
  ranked: HorseSummary[],
  popularityByHorseId: Map<string, number>,
  oddsByHorseId: Map<string, number>,
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
  let wideValue: HorseSummary;
  let wideValueOdds: number | null;
  let wideValuePopularity: number | null;

  if (withPopularity.length < 2) {
    notes.push("人気の入力が足りないため、実力スコア上位2頭で代用しています。");
    favorite = ranked[0];
    favoritePopularity = null;
    winPlaceValue = ranked[1];
    winPlaceValuePopularity = null;
    wideValue = ranked[1];
    wideValueOdds = oddsByHorseId.get(ranked[1].horseId) ?? null;
    wideValuePopularity = null;
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
      return odds !== undefined && odds >= WIDE_LONGSHOT_ODDS_MIN && odds <= WIDE_LONGSHOT_ODDS_MAX;
    });

    if (oddsInRange.length > 0) {
      wideValue = [...oddsInRange].sort((a, b) => b.avgAdjustedScore - a.avgAdjustedScore)[0];
      wideValueOdds = oddsByHorseId.get(wideValue.horseId)!;
      wideValuePopularity = popularityByHorseId.get(wideValue.horseId) ?? null;
    } else {
      if (oddsByHorseId.size > 0) {
        notes.push(
          `単勝${WIDE_LONGSHOT_ODDS_MIN}〜${WIDE_LONGSHOT_ODDS_MAX}倍の馬がいなかったため、ワイドの穴も${LONGSHOT_MIN_POPULARITY_RANK}番人気以下から代用しています。`
        );
      }
      wideValue = winPlaceValue;
      wideValueOdds = oddsByHorseId.get(wideValue.horseId) ?? null;
      wideValuePopularity = winPlaceValuePopularity;
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

  const wideValueLabel =
    wideValueOdds !== null
      ? `単勝${wideValueOdds.toFixed(1)}倍`
      : `${wideValuePopularity ?? "?"}番人気`;

  const wide: WidePick = {
    favorite,
    longshot: wideValue,
    reason: `本命: ${favorite.horseName}（${
      favoritePopularity ?? "?"
    }番人気 / 実力スコア${favorite.avgAdjustedScore.toFixed(1)}点） + 穴: ${
      wideValue.horseName
    }（${wideValueLabel}・実力スコア${wideValue.avgAdjustedScore.toFixed(1)}点）`,
  };

  return { win, place, wide, trio };
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
