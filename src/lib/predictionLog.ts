import type { BettingPlan } from "@/lib/predict";

export interface SavedBettingPlan {
  win: { horseName: string; reason: string } | null;
  place: { horseName: string; reason: string } | null;
  wide: { horseNames: [string, string]; reason: string } | null;
  trio: { horseNames: [string, string, string]; reason: string } | null;
}

export interface PredictionResult {
  recordedAt: string;
  /** 1着・2着・3着の馬名 */
  top3: [string, string, string];
}

export interface PredictionRecord {
  id: string;
  raceName: string;
  createdAt: string;
  bettingPlan: SavedBettingPlan;
  result: PredictionResult | null;
}

const STORAGE_KEY = "keiba-yosoku-app:predictions";

export function snapshotBettingPlan(bettingPlan: BettingPlan): SavedBettingPlan {
  return {
    win: bettingPlan.win
      ? { horseName: bettingPlan.win.horse.horseName, reason: bettingPlan.win.reason }
      : null,
    place: bettingPlan.place
      ? { horseName: bettingPlan.place.horse.horseName, reason: bettingPlan.place.reason }
      : null,
    wide: bettingPlan.wide
      ? {
          horseNames: [bettingPlan.wide.favorite.horseName, bettingPlan.wide.longshot.horseName],
          reason: bettingPlan.wide.reason,
        }
      : null,
    trio: bettingPlan.trio
      ? {
          horseNames: bettingPlan.trio.horses.map((h) => h.horseName) as [string, string, string],
          reason: bettingPlan.trio.reason,
        }
      : null,
  };
}

export function loadPredictionRecords(): PredictionRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePredictionRecords(records: PredictionRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // localStorage unavailable (private browsing, quota, etc.) — silently skip persistence
  }
}

export function createPredictionRecord(raceName: string, bettingPlan: BettingPlan): PredictionRecord {
  return {
    id: crypto.randomUUID(),
    raceName: raceName || "名称未設定のレース",
    createdAt: new Date().toISOString(),
    bettingPlan: snapshotBettingPlan(bettingPlan),
    result: null,
  };
}

export interface HitResult {
  win: boolean | null;
  place: boolean | null;
  wide: boolean | null;
  trio: boolean | null;
}

/** top3 は本命側から見た「1着・2着・3着」の馬名 */
export function computeHits(bettingPlan: SavedBettingPlan, top3: [string, string, string]): HitResult {
  const podium = new Set(top3);
  const [first] = top3;

  return {
    win: bettingPlan.win ? bettingPlan.win.horseName === first : null,
    place: bettingPlan.place ? podium.has(bettingPlan.place.horseName) : null,
    wide: bettingPlan.wide ? bettingPlan.wide.horseNames.every((n) => podium.has(n)) : null,
    trio: bettingPlan.trio ? bettingPlan.trio.horseNames.every((n) => podium.has(n)) : null,
  };
}

export interface AggregateStat {
  hits: number;
  attempts: number;
}

export interface AggregateStats {
  win: AggregateStat;
  place: AggregateStat;
  wide: AggregateStat;
  trio: AggregateStat;
}

export function aggregateHitStats(records: PredictionRecord[]): AggregateStats {
  const stats: AggregateStats = {
    win: { hits: 0, attempts: 0 },
    place: { hits: 0, attempts: 0 },
    wide: { hits: 0, attempts: 0 },
    trio: { hits: 0, attempts: 0 },
  };

  for (const record of records) {
    if (!record.result) continue;
    const hits = computeHits(record.bettingPlan, record.result.top3);
    for (const key of ["win", "place", "wide", "trio"] as const) {
      if (hits[key] === null) continue;
      stats[key].attempts += 1;
      if (hits[key]) stats[key].hits += 1;
    }
  }

  return stats;
}
