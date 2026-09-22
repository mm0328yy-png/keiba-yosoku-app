"use client";

import { useState } from "react";
import { aggregateHitStats, computeHits, type PredictionRecord } from "@/lib/predictionLog";

export default function PredictionLog({
  records,
  onRecordResult,
}: {
  records: PredictionRecord[];
  onRecordResult: (id: string, top3: [string, string, string]) => void;
}) {
  if (records.length === 0) {
    return (
      <p>
        まだ記録がありません。上のレース予想で買い目を出したら「この予想を記録する」ボタンで保存できます。
      </p>
    );
  }

  const stats = aggregateHitStats(records);

  return (
    <div>
      <table style={{ marginBottom: 20 }}>
        <thead>
          <tr>
            <th>券種</th>
            <th>的中</th>
            <th>試行数</th>
            <th>的中率</th>
          </tr>
        </thead>
        <tbody>
          {(["win", "place", "wide", "trio"] as const).map((key) => {
            const s = stats[key];
            const label = { win: "単勝", place: "複勝", wide: "ワイド", trio: "3連複" }[key];
            return (
              <tr key={key}>
                <td>{label}</td>
                <td>{s.hits}</td>
                <td>{s.attempts}</td>
                <td>{s.attempts > 0 ? `${((s.hits / s.attempts) * 100).toFixed(0)}%` : "―"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {[...records]
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map((record) => (
            <RecordRow key={record.id} record={record} onRecordResult={onRecordResult} />
          ))}
      </div>
    </div>
  );
}

function RecordRow({
  record,
  onRecordResult,
}: {
  record: PredictionRecord;
  onRecordResult: (id: string, top3: [string, string, string]) => void;
}) {
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");
  const [third, setThird] = useState("");

  const submit = () => {
    if (!first.trim() || !second.trim() || !third.trim()) return;
    onRecordResult(record.id, [first.trim(), second.trim(), third.trim()]);
  };

  const hits = record.result ? computeHits(record.bettingPlan, record.result.top3) : null;

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
      <strong>{record.raceName}</strong>
      <span style={{ color: "var(--muted)", fontSize: 13, marginLeft: 8 }}>
        {new Date(record.createdAt).toLocaleString("ja-JP")}
      </span>

      <ul style={{ marginTop: 8, fontSize: 14 }}>
        {record.bettingPlan.win && (
          <li>
            単勝: {record.bettingPlan.win.horseName} {hitBadge(hits?.win)}
          </li>
        )}
        {record.bettingPlan.place && (
          <li>
            複勝: {record.bettingPlan.place.horseName} {hitBadge(hits?.place)}
          </li>
        )}
        {record.bettingPlan.wide && (
          <li>
            ワイド: {record.bettingPlan.wide.horseNames.join(" − ")} {hitBadge(hits?.wide)}
          </li>
        )}
        {record.bettingPlan.trio && (
          <li>
            3連複: {record.bettingPlan.trio.horseNames.join(" − ")} {hitBadge(hits?.trio)}
          </li>
        )}
      </ul>

      {record.result ? (
        <p style={{ fontSize: 13, color: "var(--muted)" }}>
          結果: {record.result.top3.join(" − ")}
        </p>
      ) : (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>結果を記録:</span>
          <input placeholder="1着" value={first} onChange={(e) => setFirst(e.target.value)} style={{ width: 100 }} />
          <input placeholder="2着" value={second} onChange={(e) => setSecond(e.target.value)} style={{ width: 100 }} />
          <input placeholder="3着" value={third} onChange={(e) => setThird(e.target.value)} style={{ width: 100 }} />
          <button type="button" className="secondary" onClick={submit}>
            記録する
          </button>
        </div>
      )}
    </div>
  );
}

function hitBadge(hit: boolean | null | undefined) {
  if (hit === undefined || hit === null) return null;
  return (
    <span className={`badge ${hit ? "badge-clean" : "badge-unlucky"}`} style={{ marginLeft: 6 }}>
      {hit ? "的中" : "不的中"}
    </span>
  );
}
