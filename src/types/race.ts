export type TrackSurface = "turf" | "dirt";

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
  distanceMeters: number;
  numRunners: number;
  finishPosition: number;
  /** 着差（馬身）。勝ち馬なら0 */
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
