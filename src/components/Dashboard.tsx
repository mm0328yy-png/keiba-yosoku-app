"use client";

import { useMemo, useState } from "react";
import { summarizeAllHorses } from "@/lib/analysis";
import { samplePastPerformances } from "@/lib/sampleData";
import type { PastPerformance } from "@/types/race";
import PerformanceForm from "@/components/PerformanceForm";
import HorseSummaryTable from "@/components/HorseSummaryTable";
import RaceDetailTable from "@/components/RaceDetailTable";

export default function Dashboard() {
  const [performances, setPerformances] = useState<PastPerformance[]>(samplePastPerformances);

  const summaries = useMemo(() => summarizeAllHorses(performances), [performances]);

  const handleAdd = (pp: PastPerformance) => {
    setPerformances((prev) => [...prev, pp]);
  };

  const handleRemove = (id: string) => {
    setPerformances((prev) => prev.filter((pp) => pp.id !== id));
  };

  return (
    <>
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
