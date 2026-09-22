"use client";

import { useMemo, useState } from "react";
import { predictRace } from "@/lib/predict";
import type { PastPerformance } from "@/types/race";

export default function RacePredictor({ performances }: { performances: PastPerformance[] }) {
  const [raceName, setRaceName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

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

  const prediction = useMemo(() => {
    if (selected.size < 2) return null;
    return predictRace(Array.from(selected), nameById, performances);
  }, [selected, nameById, performances]);

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

      <p style={{ color: "var(--muted)", fontSize: 14 }}>出走する馬を選んでください（2頭以上）</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
        {uniqueHorses.map((h) => (
          <label
            key={h.horseId}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: "6px 10px",
              cursor: "pointer",
              background: selected.has(h.horseId) ? "rgba(79,140,255,0.15)" : "transparent",
            }}
          >
            <input
              type="checkbox"
              checked={selected.has(h.horseId)}
              onChange={() => toggle(h.horseId)}
            />
            {h.horseName}
          </label>
        ))}
      </div>

      {prediction && (
        <div>
          <table>
            <thead>
              <tr>
                <th>順位</th>
                <th>馬名</th>
                <th>真の実力スコア</th>
                <th>不利補正</th>
              </tr>
            </thead>
            <tbody>
              {prediction.ranked.map((s, i) => (
                <tr key={s.horseId}>
                  <td>{i + 1}</td>
                  <td>{s.horseName}</td>
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

          {prediction.widePick && (
            <div
              style={{
                marginTop: 16,
                padding: 16,
                border: "1px solid var(--accent)",
                borderRadius: 8,
                background: "rgba(79,140,255,0.08)",
              }}
            >
              <strong>
                {raceName ? `${raceName} の` : ""}ワイド本命候補: {prediction.widePick.primary.horseName} −{" "}
                {prediction.widePick.secondary.horseName}
              </strong>
              <p style={{ margin: "6px 0 0", fontSize: 14, color: "var(--muted)" }}>
                {prediction.widePick.reason}
              </p>
            </div>
          )}

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
