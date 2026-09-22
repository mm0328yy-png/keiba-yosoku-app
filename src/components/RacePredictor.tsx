"use client";

import { useMemo, useState } from "react";
import { predictRace } from "@/lib/predict";
import type { PastPerformance } from "@/types/race";

export default function RacePredictor({ performances }: { performances: PastPerformance[] }) {
  const [raceName, setRaceName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [popularity, setPopularity] = useState<Map<string, number>>(new Map());
  const [odds, setOdds] = useState<Map<string, number>>(new Map());

  const uniqueHorses = useMemo(() => {
    const map = new Map<string, string>();
    for (const pp of performances) {
      map.set(pp.horseId, pp.horseName);
    }
    return Array.from(map.entries())
      .map(([horseId, horseName]) => ({ horseId, horseName }))
      .sort((a, b) => a.horseName.localeCompare(b.horseName, "ja"));
  }, [performances]);

  const nameById = useMemo(() => new Map(uniqueHorses.map((h) => [h.horseId, h.horseName])), [uniqueHorses]);

  const toggle = (horseId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(horseId)) {
        next.delete(horseId);
      } else {
        next.add(horseId);
      }
      return next;
    });
  };

  const setNumericField = (
    setter: React.Dispatch<React.SetStateAction<Map<string, number>>>,
    horseId: string,
    value: string
  ) => {
    setter((prev) => {
      const next = new Map(prev);
      const num = Number(value);
      if (value === "" || Number.isNaN(num)) {
        next.delete(horseId);
      } else {
        next.set(horseId, num);
      }
      return next;
    });
  };

  const prediction = useMemo(() => {
    if (selected.size < 2) return null;
    return predictRace(Array.from(selected), nameById, performances, popularity, odds);
  }, [selected, nameById, performances, popularity, odds]);

  if (uniqueHorses.length === 0) {
    return <p>まず下のフォームから馬の前走データを登録してください。</p>;
  }

  return (
    <div>
      <label style={{ marginBottom: 8, display: "block" }}>
        レース名（任意）
        <input
          value={raceName}
          onChange={(e) => setRaceName(e.target.value)}
          placeholder="例: 中山4R"
          style={{ marginTop: 4, maxWidth: 240 }}
        />
      </label>

      <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 4 }}>
        出走する馬を選んでください（2頭以上）。人気（何番人気か）を入力すると単勝・複勝・3連複を、
        単勝オッズも入力するとワイドの穴（オッズ<strong>8倍以上</strong>）を回収率重視で提案します。
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        {uniqueHorses.map((h) => (
          <div
            key={h.horseId}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: "6px 10px",
              background: selected.has(h.horseId) ? "rgba(79,140,255,0.15)" : "transparent",
              width: "fit-content",
            }}
          >
            <label style={{ flexDirection: "row", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={selected.has(h.horseId)}
                onChange={() => toggle(h.horseId)}
              />
              {h.horseName}
            </label>
            {selected.has(h.horseId) && (
              <>
                <input
                  type="number"
                  min={1}
                  placeholder="人気"
                  value={popularity.get(h.horseId) ?? ""}
                  onChange={(e) => setNumericField(setPopularity, h.horseId, e.target.value)}
                  style={{ width: 60 }}
                />
                <input
                  type="number"
                  min={1}
                  step="0.1"
                  placeholder="単勝オッズ"
                  value={odds.get(h.horseId) ?? ""}
                  onChange={(e) => setNumericField(setOdds, h.horseId, e.target.value)}
                  style={{ width: 80 }}
                />
              </>
            )}
          </div>
        ))}
      </div>

      {prediction && (
        <div>
          <table>
            <thead>
              <tr>
                <th>順位</th>
                <th>馬名</th>
                <th>人気</th>
                <th>単勝オッズ</th>
                <th>真の実力スコア</th>
                <th>不利補正</th>
              </tr>
            </thead>
            <tbody>
              {prediction.ranked.map((s, i) => (
                <tr key={s.horseId}>
                  <td>{i + 1}</td>
                  <td>{s.horseName}</td>
                  <td>{popularity.get(s.horseId) ?? "―"}</td>
                  <td>{odds.get(s.horseId) ?? "―"}</td>
                  <td>{s.avgAdjustedScore.toFixed(1)}</td>
                  <td>{s.avgLuckAdjustment > 0 ? `+${s.avgLuckAdjustment.toFixed(1)}` : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {prediction.noDataHorseNames.length > 0 && (
            <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 8 }}>
              データなし（判定対象外）: {prediction.noDataHorseNames.join(", ")}
            </p>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
            {raceName && <strong>{raceName} の買い目候補</strong>}
            {prediction.bettingPlan.win && (
              <BetCard
                title="単勝"
                label={prediction.bettingPlan.win.horse.horseName}
                reason={prediction.bettingPlan.win.reason}
              />
            )}
            {prediction.bettingPlan.place && (
              <BetCard
                title="複勝"
                label={prediction.bettingPlan.place.horse.horseName}
                reason={prediction.bettingPlan.place.reason}
              />
            )}
            {prediction.bettingPlan.wide && (
              <BetCard
                title="ワイド"
                label={`${prediction.bettingPlan.wide.favorite.horseName} − ${prediction.bettingPlan.wide.longshot.horseName}`}
                reason={prediction.bettingPlan.wide.reason}
              />
            )}
            {prediction.bettingPlan.trio && (
              <BetCard
                title="3連複"
                label={prediction.bettingPlan.trio.horses.map((h) => h.horseName).join(" − ")}
                reason={prediction.bettingPlan.trio.reason}
              />
            )}
          </div>

          {prediction.notes.length > 0 && (
            <ul style={{ marginTop: 12, fontSize: 14, color: "var(--muted)" }}>
              {prediction.notes.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function BetCard({ title, label, reason }: { title: string; label: string; reason: string }) {
  return (
    <div
      style={{
        padding: 16,
        border: "1px solid var(--accent)",
        borderRadius: 8,
        background: "rgba(79,140,255,0.08)",
      }}
    >
      <strong>
        {title}: {label}
      </strong>
      <p style={{ margin: "6px 0 0", fontSize: 14, color: "var(--muted)" }}>{reason}</p>
    </div>
  );
}
