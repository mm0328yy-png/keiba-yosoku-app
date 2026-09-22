import { analyzePastPerformance } from "@/lib/analysis";
import { RACE_GRADE_LABELS, TROUBLE_KIND_LABELS, TROUBLE_PHASE_LABELS } from "@/types/race";
import type { PastPerformance } from "@/types/race";

export default function RaceDetailTable({
  performances,
  onRemove,
}: {
  performances: PastPerformance[];
  onRemove: (id: string) => void;
}) {
  if (performances.length === 0) {
    return <p>データがありません。</p>;
  }

  const rows = [...performances].sort((a, b) => b.raceDate.localeCompare(a.raceDate));

  return (
    <table>
      <thead>
        <tr>
          <th>日付</th>
          <th>レース</th>
          <th>クラス</th>
          <th>馬名</th>
          <th>着順</th>
          <th>着差</th>
          <th>額面</th>
          <th>実力スコア</th>
          <th>不利の内容</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((pp) => {
          const { rawScore, adjustedScore, isUnluckyLoss } = analyzePastPerformance(pp);
          return (
            <tr key={pp.id}>
              <td>{pp.raceDate}</td>
              <td>{pp.raceName}</td>
              <td>{RACE_GRADE_LABELS[pp.raceGrade]}</td>
              <td>{pp.horseName}</td>
              <td>
                {pp.finishPosition}着 / {pp.numRunners}頭
              </td>
              <td>
                {pp.finishPosition === 1 ? "+" : ""}
                {pp.marginLengths.toFixed(1)}
              </td>
              <td>{rawScore.toFixed(1)}</td>
              <td>
                {adjustedScore.toFixed(1)}
                {isUnluckyLoss && <span className="badge badge-unlucky" style={{ marginLeft: 6 }}>不運</span>}
              </td>
              <td>
                {pp.troubles.length === 0
                  ? "―"
                  : pp.troubles
                      .map(
                        (t) =>
                          `${TROUBLE_KIND_LABELS[t.kind]}(${TROUBLE_PHASE_LABELS[t.phase]}, 深刻度${t.severity})`
                      )
                      .join(" / ")}
              </td>
              <td>
                <button className="danger" onClick={() => onRemove(pp.id)}>
                  削除
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
