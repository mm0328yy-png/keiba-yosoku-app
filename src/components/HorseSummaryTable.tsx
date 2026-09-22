import type { HorseSummary } from "@/lib/analysis";

export default function HorseSummaryTable({ summaries }: { summaries: HorseSummary[] }) {
  if (summaries.length === 0) {
    return <p>まだデータがありません。下のフォームから前走成績を追加してください。</p>;
  }

  return (
    <table>
      <thead>
        <tr>
          <th>馬名</th>
          <th>走数</th>
          <th>額面スコア（平均）</th>
          <th>真の実力スコア（平均）</th>
          <th>不利補正幅</th>
          <th>不運な敗戦</th>
        </tr>
      </thead>
      <tbody>
        {summaries.map((s) => (
          <tr key={s.horseId}>
            <td>{s.horseName}</td>
            <td>{s.races.length}</td>
            <td>{s.avgRawScore.toFixed(1)}</td>
            <td>
              {s.avgAdjustedScore.toFixed(1)}
              {s.avgLuckAdjustment > 0.5 && (
                <span className="score-diff"> (+{s.avgLuckAdjustment.toFixed(1)})</span>
              )}
            </td>
            <td>{s.avgLuckAdjustment.toFixed(1)}</td>
            <td>
              {s.unluckyLossCount > 0 ? (
                <span className="badge badge-unlucky">{s.unluckyLossCount}回あり</span>
              ) : (
                <span className="badge badge-clean">なし</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
