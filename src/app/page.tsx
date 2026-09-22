import Dashboard from "@/components/Dashboard";

export default function Home() {
  return (
    <main>
      <h1>前走トラブル分析</h1>
      <p className="subtitle">
        着順や着差だけでなく、「前が詰まった」「出遅れた」といった不利を加味して、
        馬の真の実力を分析します。
      </p>
      <Dashboard />
    </main>
  );
}
