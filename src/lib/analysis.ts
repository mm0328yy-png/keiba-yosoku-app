import type { PastPerformance, RaceGrade, TroubleEvent, TroublePhase, TroubleSeverity } from "@/types/race";

/**
 * 着差1馬身あたりの減点。値が大きいほど「着差が大きい=実力差」とみなす度合いが強くなる。
 * 実際の1馬身のタイム差は距離・馬場によって変わるため、ここでは簡略化した固定値を使う。
 */
const POINTS_PER_LENGTH = 2;

/**
 * 1着馬の「勝ち馬身差」1馬身あたりの加点。
 * 僅差の勝利と圧勝を区別するためのボーナスで、これが無いと「勝った馬は一律100点」に
 * なってしまい、際どい勝利と圧勝が同じ評価になってしまう。
 */
const WIN_MARGIN_BONUS_PER_LENGTH = 1;

/**
 * レースのレベルによる加減点。着差だけでは「どんなメンバーと走ったか」が分からないため、
 * 地方競馬・未勝利〜G1まで、レベルが上がるほど同じ着差でも高く評価する
 * （逆にレベルが低いレースでの好走は割り引く）。1勝クラスを基準(0点)にしている。
 */
const RACE_GRADE_ADJUSTMENT: Record<RaceGrade, number> = {
  chihou: -5,
  shinba: -3,
  mishoyuri: -2,
  class1: 0,
  class2: 2,
  class3: 4,
  open: 6,
  g3: 8,
  g2: 10,
  g1: 12,
};

/** 圧勝・高レベル戦でも際限なく加点されないための上限スコア */
const MAX_SCORE = 130;

/**
 * 不利の深刻度（1〜5）ごとの回復ポイント。
 * 数字が上がるほど「本来の力を発揮できなかった度合い」が大きいとみなし、
 * 非線形（凸型）に重み付けする。
 */
const SEVERITY_POINTS: Record<TroubleSeverity, number> = {
  1: 1,
  2: 2.5,
  3: 4.5,
  4: 7,
  5: 11,
};

/**
 * 不利が発生したタイミングによる重み。
 * 直線での不利ほど「もう挽回できない」ため最も致命的とみなす。
 * スタート直後の不利はレース中に挽回できる余地があるため軽めに評価する。
 */
const PHASE_WEIGHT: Record<TroublePhase, number> = {
  start: 0.6,
  backstretch: 0.8,
  final_corner: 1.0,
  stretch: 1.2,
};

export function troubleCreditFor(trouble: TroubleEvent): number {
  return SEVERITY_POINTS[trouble.severity] * PHASE_WEIGHT[trouble.phase];
}

/** その走りで発生した不利による、加点の合計（＝どれだけ「運が悪かった」か） */
export function totalTroubleCredit(troubles: TroubleEvent[]): number {
  return troubles.reduce((sum, t) => sum + troubleCreditFor(t), 0);
}

/**
 * 着順・着差・レースレベルを見た「額面どおりの走破内容スコア」（0〜MAX_SCORE）。
 * 不利は一切考慮しない、レース結果の見たままの評価。
 *
 * 1着の場合、marginLengths は「2着馬に勝った差」として扱い、圧勝ほど加点する
 * （これが無いと勝った馬が一律100点になり、僅差の勝利と圧勝を区別できない）。
 * 2着以下の場合は従来どおり、着差が大きいほど減点する。
 * さらに raceGrade に応じた加減点（地方競馬やレベルの低いクラスは割り引き、
 * オープン・重賞は上乗せ）を加える。
 */
export function rawPerformanceScore(pp: PastPerformance): number {
  const finishScore =
    pp.finishPosition === 1
      ? 100 + pp.marginLengths * WIN_MARGIN_BONUS_PER_LENGTH
      : 100 - pp.marginLengths * POINTS_PER_LENGTH;

  const score = finishScore + RACE_GRADE_ADJUSTMENT[pp.raceGrade];
  return clamp(score, 0, MAX_SCORE);
}

/**
 * 不利を加味した「真の実力スコア」（0〜MAX_SCORE）。
 * 前が詰まった・出遅れたなどで発揮できなかった分を加点で補正する。
 */
export function adjustedPerformanceScore(pp: PastPerformance): number {
  const raw = rawPerformanceScore(pp);
  const credit = totalTroubleCredit(pp.troubles);
  return clamp(raw + credit, 0, MAX_SCORE);
}

export interface PastPerformanceAnalysis {
  performance: PastPerformance;
  rawScore: number;
  adjustedScore: number;
  /** 不利による補正幅。大きいほど「不利がなければもっと良い着順だった」可能性が高い */
  luckAdjustment: number;
  /** 掲示板外（4着以下）なのに大きな不利補正がある＝「不運な敗戦」と判定 */
  isUnluckyLoss: boolean;
}

const UNLUCKY_LOSS_CREDIT_THRESHOLD = 5;
const UNLUCKY_LOSS_MIN_FINISH_POSITION = 4;

export function analyzePastPerformance(pp: PastPerformance): PastPerformanceAnalysis {
  const rawScore = rawPerformanceScore(pp);
  const luckAdjustment = totalTroubleCredit(pp.troubles);
  const adjustedScore = clamp(rawScore + luckAdjustment, 0, MAX_SCORE);
  const isUnluckyLoss =
    luckAdjustment >= UNLUCKY_LOSS_CREDIT_THRESHOLD &&
    pp.finishPosition >= UNLUCKY_LOSS_MIN_FINISH_POSITION;

  return { performance: pp, rawScore, adjustedScore, luckAdjustment, isUnluckyLoss };
}

export interface HorseSummary {
  horseId: string;
  horseName: string;
  races: PastPerformanceAnalysis[];
  avgRawScore: number;
  avgAdjustedScore: number;
  /** 平均の不利補正幅。大きいほど「不利に泣かされがち」な馬 */
  avgLuckAdjustment: number;
  unluckyLossCount: number;
}

/** 同一馬の複数レースをまとめて集計する */
export function summarizeHorse(performances: PastPerformance[]): HorseSummary | null {
  if (performances.length === 0) return null;

  const races = performances
    .map(analyzePastPerformance)
    .sort((a, b) => b.performance.raceDate.localeCompare(a.performance.raceDate));

  const avg = (values: number[]) => values.reduce((s, v) => s + v, 0) / values.length;

  return {
    horseId: performances[0].horseId,
    horseName: performances[0].horseName,
    races,
    avgRawScore: avg(races.map((r) => r.rawScore)),
    avgAdjustedScore: avg(races.map((r) => r.adjustedScore)),
    avgLuckAdjustment: avg(races.map((r) => r.luckAdjustment)),
    unluckyLossCount: races.filter((r) => r.isUnluckyLoss).length,
  };
}

/** horseId ごとにグルーピングして集計し、真の実力スコア順に並べる */
export function summarizeAllHorses(performances: PastPerformance[]): HorseSummary[] {
  const byHorse = new Map<string, PastPerformance[]>();
  for (const pp of performances) {
    const list = byHorse.get(pp.horseId) ?? [];
    list.push(pp);
    byHorse.set(pp.horseId, list);
  }

  return Array.from(byHorse.values())
    .map(summarizeHorse)
    .filter((s): s is HorseSummary => s !== null)
    .sort((a, b) => b.avgAdjustedScore - a.avgAdjustedScore);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
