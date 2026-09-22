export type TrackSurface = "turf" | "dirt";

/**
 * レースのレベル。着差だけでは「どれくらいのメンバーと走ったか」が分からないため、
 * 実力スコアの補正に使う。地方競馬・未勝利〜G1まで、レベルが上がるほど同じ着差でも
 * 評価を上げる（逆にレベルが低いほど割り引く）。
 */
export type RaceGrade =
  | "chihou" // 地方競馬
  | "shinba" // 新馬
  | "mishoyuri" // 未勝利
  | "class1" // 1勝クラス
  | "class2" // 2勝クラス
  | "class3" // 3勝クラス
  | "open" // オープン特別
  | "g3"
  | "g2"
  | "g1";

/** レース中に発生した不利の種類 */
export type TroubleKind =
  | "slow_start" // 出遅れ
  | "boxed_in" // 前が詰まって進路がなかった
  | "steadied" // 不利で手綱を控えた（ブレーキ）
  | "forced_wide" // 大外を回された
  | "bumped" // 接触・斜行を受けた
  | "traffic_tight" // 一瞬詰まったが立て直した
  | "temperament" // 気性面・入れ込み
  | "equipment" // 装具トラブル
  | "other";

/** 不利が発生したタイミング（同じ不利でも直線での不利ほど致命的） */
export type TroublePhase = "start" | "backstretch" | "final_corner" | "stretch";

/** 1(軽微) 〜 5(致命的) */
export type TroubleSeverity = 1 | 2 | 3 | 4 | 5;

export interface TroubleEvent {
  kind: TroubleKind;
  severity: TroubleSeverity;
  phase: TroublePhase;
  note?: string;
}

export interface PastPerformance {
  id: string;
  horseId: string;
  horseName: string;
  raceDate: string; // ISO date
  raceName: string;
  track: string;
  surface: TrackSurface;
  raceGrade: RaceGrade;
  distanceMeters: number;
  numRunners: number;
  finishPosition: number;
  /** 着差（馬身）。1着の場合は2着との差（勝ち馬身差）として扱う */
  marginLengths: number;
  /** 通過順位（コーナーごと） */
  cornerPositions?: number[];
  troubles: TroubleEvent[];
}

export const TROUBLE_KIND_LABELS: Record<TroubleKind, string> = {
  slow_start: "出遅れ",
  boxed_in: "前が詰まって進路なし",
  steadied: "不利で手綱を控えた",
  forced_wide: "大外を回された",
  bumped: "接触・斜行を受けた",
  traffic_tight: "一瞬詰まったが立て直し",
  temperament: "気性面・入れ込み",
  equipment: "装具トラブル",
  other: "その他の不利",
};

export const TROUBLE_PHASE_LABELS: Record<TroublePhase, string> = {
  start: "スタート",
  backstretch: "向正面",
  final_corner: "最終コーナー",
  stretch: "直線",
};

/** 弱い順（地方競馬）→強い順（G1）に並んでいる */
export const RACE_GRADE_LABELS: Record<RaceGrade, string> = {
  chihou: "地方競馬",
  shinba: "新馬",
  mishoyuri: "未勝利",
  class1: "1勝クラス",
  class2: "2勝クラス",
  class3: "3勝クラス",
  open: "オープン特別",
  g3: "G3",
  g2: "G2",
  g1: "G1",
};

export const RACE_GRADE_ORDER: RaceGrade[] = [
  "chihou",
  "shinba",
  "mishoyuri",
  "class1",
  "class2",
  "class3",
  "open",
  "g3",
  "g2",
  "g1",
];
