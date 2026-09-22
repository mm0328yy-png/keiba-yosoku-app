"use client";

import { useState } from "react";
import {
  RACE_GRADE_LABELS,
  RACE_GRADE_ORDER,
  TROUBLE_KIND_LABELS,
  TROUBLE_PHASE_LABELS,
  type PastPerformance,
  type RaceGrade,
  type TroubleEvent,
  type TroubleKind,
  type TroublePhase,
  type TroubleSeverity,
} from "@/types/race";

const emptyTrouble = (): TroubleEvent => ({
  kind: "boxed_in",
  severity: 3,
  phase: "stretch",
});

interface FormState {
  horseName: string;
  raceName: string;
  track: string;
  surface: "turf" | "dirt";
  raceGrade: RaceGrade;
  distanceMeters: string;
  numRunners: string;
  finishPosition: string;
  marginLengths: string;
  raceDate: string;
}

const initialFormState: FormState = {
  horseName: "",
  raceName: "",
  track: "",
  surface: "turf",
  raceGrade: "class1",
  distanceMeters: "2000",
  numRunners: "16",
  finishPosition: "1",
  marginLengths: "0",
  raceDate: new Date().toISOString().slice(0, 10),
};

export default function PerformanceForm({ onAdd }: { onAdd: (pp: PastPerformance) => void }) {
  const [form, setForm] = useState<FormState>(initialFormState);
  const [troubles, setTroubles] = useState<TroubleEvent[]>([]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const addTrouble = () => setTroubles((prev) => [...prev, emptyTrouble()]);
  const removeTrouble = (index: number) =>
    setTroubles((prev) => prev.filter((_, i) => i !== index));
  const updateTrouble = (index: number, patch: Partial<TroubleEvent>) => {
    setTroubles((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.horseName.trim() || !form.raceName.trim()) return;

    const pp: PastPerformance = {
      id: crypto.randomUUID(),
      horseId: form.horseName.trim(),
      horseName: form.horseName.trim(),
      raceDate: form.raceDate,
      raceName: form.raceName.trim(),
      track: form.track.trim(),
      surface: form.surface,
      raceGrade: form.raceGrade,
      distanceMeters: Number(form.distanceMeters) || 0,
      numRunners: Number(form.numRunners) || 1,
      finishPosition: Number(form.finishPosition) || 1,
      marginLengths: Number(form.marginLengths) || 0,
      troubles,
    };

    onAdd(pp);
    setForm(initialFormState);
    setTroubles([]);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-row">
        <label>
          馬名
          <input
            value={form.horseName}
            onChange={(e) => update("horseName", e.target.value)}
            placeholder="例: サンライズホープ"
            required
          />
        </label>
        <label>
          レース名
          <input
            value={form.raceName}
            onChange={(e) => update("raceName", e.target.value)}
            placeholder="例: 中山金杯"
            required
          />
        </label>
        <label>
          日付
          <input type="date" value={form.raceDate} onChange={(e) => update("raceDate", e.target.value)} />
        </label>
      </div>

      <div className="form-row">
        <label>
          競馬場
          <input value={form.track} onChange={(e) => update("track", e.target.value)} placeholder="例: 中山" />
        </label>
        <label>
          馬場
          <select value={form.surface} onChange={(e) => update("surface", e.target.value as "turf" | "dirt")}>
            <option value="turf">芝</option>
            <option value="dirt">ダート</option>
          </select>
        </label>
        <label>
          クラス
          <select value={form.raceGrade} onChange={(e) => update("raceGrade", e.target.value as RaceGrade)}>
            {RACE_GRADE_ORDER.map((grade) => (
              <option key={grade} value={grade}>
                {RACE_GRADE_LABELS[grade]}
              </option>
            ))}
          </select>
        </label>
        <label>
          距離(m)
          <input
            type="number"
            value={form.distanceMeters}
            onChange={(e) => update("distanceMeters", e.target.value)}
          />
        </label>
      </div>

      <div className="form-row">
        <label>
          頭数
          <input type="number" min={1} value={form.numRunners} onChange={(e) => update("numRunners", e.target.value)} />
        </label>
        <label>
          着順
          <input
            type="number"
            min={1}
            value={form.finishPosition}
            onChange={(e) => update("finishPosition", e.target.value)}
          />
        </label>
        <label>
          {form.finishPosition === "1" ? "勝ち馬身差(2着との差)" : "着差(馬身)"}
          <input
            type="number"
            step="0.1"
            min={0}
            value={form.marginLengths}
            onChange={(e) => update("marginLengths", e.target.value)}
          />
        </label>
      </div>

      <div>
        <label style={{ marginBottom: 8 }}>不利の内容（あれば追加）</label>
        <div className="trouble-list">
          {troubles.map((t, i) => (
            <div className="trouble-item" key={i}>
              <label>
                種類
                <select
                  value={t.kind}
                  onChange={(e) => updateTrouble(i, { kind: e.target.value as TroubleKind })}
                >
                  {Object.entries(TROUBLE_KIND_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                発生タイミング
                <select
                  value={t.phase}
                  onChange={(e) => updateTrouble(i, { phase: e.target.value as TroublePhase })}
                >
                  {Object.entries(TROUBLE_PHASE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                深刻度(1-5)
                <select
                  value={t.severity}
                  onChange={(e) =>
                    updateTrouble(i, { severity: Number(e.target.value) as TroubleSeverity })
                  }
                >
                  {[1, 2, 3, 4, 5].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="danger" onClick={() => removeTrouble(i)}>
                削除
              </button>
            </div>
          ))}
        </div>
        <button type="button" className="secondary" onClick={addTrouble} style={{ marginTop: 8 }}>
          + 不利を追加
        </button>
      </div>

      <button type="submit">この成績を登録</button>
    </form>
  );
}
