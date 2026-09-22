"use client";

import { useMemo, useState } from "react";
import { predictRace, widePairKey } from "@/lib/predict";
import type { PastPerformance } from "@/types/race";

interface WideOddsEntry {
  horseIdA: string;
  horseIdB: string;
  odds: number;
}

export default function RacePredictor({ performances }: { performances: PastPerformance[] }) {
  const [raceName, setRaceName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [popularity, setPopularity] = useState<Map<string, number>>(new Map());
  const [odds, setOdds] = useState<Map<string, number>>(new Map());
  const [wideOddsEntries, setWideOddsEntries] = useState<WideOddsEntry[]>([]);

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

  const addWideOdds = (horseIdA: string, horseIdB: string, oddsValue: number) => {
    if (!horseIdA || !horseIdB || horseIdA === horseIdB || Number.isNaN(oddsValue)) return;
    setWideOddsEntries((prev) => [
      ...prev.filter((e) => widePairKey(e.horseIdA, e.horseIdB) !== widePairKey(horseIdA, horseIdB)),
      { horseIdA, horseIdB, odds: oddsValue },
    ]);
  };

  const removeWideOdds = (index: number) => {
    setWideOddsEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const wideOddsByPair = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of wideOddsEntries) {
      if (selected.has(e.horseIdA) && selected.has(e.horseIdB)) {
        m.set(widePairKey(e.horseIdA, e.horseIdB), e.odds);
      }
    }
    return m;
  }, [wideOddsEntries, selected]);

  const prediction = useMemo(() => {
    if (selected.size < 2) return null;
    return predictRace(Array.from(selected), nameById, performances, popularity, odds, wideOddsByPair);
  }, [selected, nameById, performances, popularity, odds, wideOddsByPair]);

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

      {selected.size >= 2 && (
        <WideOddsInput
          horses={uniqueHorses.filter((h) => selected.has(h.horseId))}
          entries={wideOddsEntries}
          onAdd={addWideOdds}
          onRemove={removeWideOdds}
        />
      )}

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

function WideOddsInput({
  horses,
  entries,
  onAdd,
  onRemove,
}: {
  horses: { horseId: string; horseName: string }[];
  entries: WideOddsEntry[];
  onAdd: (horseIdA: string, horseIdB: string, odds: number) => void;
  onRemove: (index: number) => void;
}) {
  const [horseIdA, setHorseIdA] = useState("");
  const [horseIdB, setHorseIdB] = useState("");
  const [oddsInput, setOddsInput] = useState("");

  const nameById = new Map(horses.map((h) => [h.horseId, h.horseName]));

  const handleAdd = () => {
    const value = Number(oddsInput);
    if (!horseIdA || !horseIdB || horseIdA === horseIdB || Number.isNaN(value)) return;
    onAdd(horseIdA, horseIdB, value);
    setOddsInput("");
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 8 }}>
        分かる組み合わせだけでOK: 実際のワイドオッズを入力すると、単勝オッズ・人気からの推定より
        優先してワイドの買い目に使います。
      </p>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <select value={horseIdA} onChange={(e) => setHorseIdA(e.target.value)}>
          <option value="">馬を選択</option>
          {horses.map((h) => (
            <option key={h.horseId} value={h.horseId}>
              {h.horseName}
            </option>
          ))}
        </select>
        <span>−</span>
        <select value={horseIdB} onChange={(e) => setHorseIdB(e.target.value)}>
          <option value="">馬を選択</option>
          {horses.map((h) => (
            <option key={h.horseId} value={h.horseId}>
              {h.horseName}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          step="0.1"
          placeholder="ワイドオッズ"
          value={oddsInput}
          onChange={(e) => setOddsInput(e.target.value)}
          style={{ width: 100 }}
        />
        <button type="button" className="secondary" onClick={handleAdd}>
          追加
        </button>
      </div>

      {entries.length > 0 && (
        <ul style={{ marginTop: 8, fontSize: 14 }}>
          {entries.map((e, i) => (
            <li key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {nameById.get(e.horseIdA) ?? e.horseIdA} − {nameById.get(e.horseIdB) ?? e.horseIdB}:{" "}
              {e.odds.toFixed(1)}倍
              <button type="button" className="danger" onClick={() => onRemove(i)}>
                削除
              </button>
            </li>
          ))}
        </ul>
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
