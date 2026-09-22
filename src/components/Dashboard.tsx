"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { summarizeAllHorses } from "@/lib/analysis";
import { samplePastPerformances } from "@/lib/sampleData";
import type { PastPerformance } from "@/types/race";
import {
  loadPredictionRecords,
  savePredictionRecords,
  type PredictionRecord,
} from "@/lib/predictionLog";
import PerformanceForm from "@/components/PerformanceForm";
import HorseSummaryTable from "@/components/HorseSummaryTable";
import RaceDetailTable from "@/components/RaceDetailTable";
import RacePredictor from "@/components/RacePredictor";
import PredictionLog from "@/components/PredictionLog";

export default function Dashboard() {
  const [performances, setPerformances] = useState<PastPerformance[]>(samplePastPerformances);
  const [predictionRecords, setPredictionRecords] = useState<PredictionRecord[]>([]);
  const skipNextPersist = useRef(true);

  const summaries = useMemo(() => summarizeAllHorses(performances), [performances]);

  useEffect(() => {
    setPredictionRecords(loadPredictionRecords());
  }, []);

  useEffect(() => {
    if (skipNextPersist.current) {
      skipNextPersist.current = false;
      return;
    }
    savePredictionRecords(predictionRecords);
  }, [predictionRecords]);

  const handleAdd = (pp: PastPerformance) => {
    setPerformances((prev) => [...prev, pp]);
  };

  const handleRemove = (id: string) => {
    setPerformances((prev) => prev.filter((pp) => pp.id !== id));
  };

  const handleSavePrediction = (record: PredictionRecord) => {
    setPredictionRecords((prev) => [record, ...prev]);
  };

  const handleRecordResult = (id: string, top3: [string, string, string]) => {
    setPredictionRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, result: { recordedAt: new Date().toISOString(), top3 } } : r))
    );
  };

  return (
    <>
      <section>
        <h2>レース予想（ワイド候補を出す）</h2>
        <RacePredictor performances={performances} onSavePrediction={handleSavePrediction} />
      </section>

      <section>
        <h2>予想の記録（的中率チェック）</h2>
        <PredictionLog records={predictionRecords} onRecordResult={handleRecordResult} />
      </section>

      <section>
        <h2>馬ごとの実力サマリー（不利補正後）</h2>
        <HorseSummaryTable summaries={summaries} />
      </section>

      <section>
        <h2>前走の成績を追加する</h2>
        <PerformanceForm onAdd={handleAdd} />
      </section>

      <section>
        <h2>登録済みの前走データ</h2>
        <RaceDetailTable performances={performances} onRemove={handleRemove} />
      </section>
    </>
  );
}
