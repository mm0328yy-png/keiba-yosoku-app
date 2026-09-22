import type { PastPerformance } from "@/types/race";

/**
 * サンプルデータ。実際のレースを模した例:
 * - サンライズホープは5着に敗れたが、直線で前が壁になり進路がなかった（重度の不利）。
 *   見た目の着順は悪いが、真の実力スコアでは上位に浮上する想定。
 * - キセキノホシは3着だが不利なく実力どおりの走り。
 * - ハヤテオウジは2着だったが接触を受けており、着差以上に評価すべき内容。
 */
export const samplePastPerformances: PastPerformance[] = [
  {
    id: "pp-1",
    horseId: "horse-sunrise-hope",
    horseName: "サンライズホープ",
    raceDate: "2026-08-30",
    raceName: "第10回 中山金杯",
    track: "中山",
    surface: "turf",
    distanceMeters: 2000,
    numRunners: 16,
    finishPosition: 5,
    marginLengths: 1.2,
    cornerPositions: [10, 9, 6, 5],
    troubles: [
      {
        kind: "boxed_in",
        severity: 5,
        phase: "stretch",
        note: "直線で前が壁になり、進路を探すも間に合わなかった",
      },
    ],
  },
  {
    id: "pp-2",
    horseId: "horse-sunrise-hope",
    horseName: "サンライズホープ",
    raceDate: "2026-07-15",
    raceName: "オープン特別",
    track: "東京",
    surface: "turf",
    distanceMeters: 1800,
    numRunners: 14,
    finishPosition: 6,
    marginLengths: 1.8,
    troubles: [],
  },
  {
    id: "pp-3",
    horseId: "horse-kiseki-no-hoshi",
    horseName: "キセキノホシ",
    raceDate: "2026-08-30",
    raceName: "第10回 中山金杯",
    track: "中山",
    surface: "turf",
    distanceMeters: 2000,
    numRunners: 16,
    finishPosition: 3,
    marginLengths: 0.4,
    troubles: [],
  },
  {
    id: "pp-4",
    horseId: "horse-hayate-oji",
    horseName: "ハヤテオウジ",
    raceDate: "2026-08-30",
    raceName: "第10回 中山金杯",
    track: "中山",
    surface: "turf",
    distanceMeters: 2000,
    numRunners: 16,
    finishPosition: 2,
    marginLengths: 0.2,
    troubles: [
      {
        kind: "bumped",
        severity: 2,
        phase: "final_corner",
        note: "最終コーナーで外から接触を受けた",
      },
    ],
  },
];
