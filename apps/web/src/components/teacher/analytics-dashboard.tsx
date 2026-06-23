"use client";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface KPI {
  label: string;
  value: string | number;
  unit?: string;
}

interface AnalyticsDashboardProps {
  kpis?: KPI[];
  masteryData?: { label: string; value: number }[];
  scoreDistribution?: { label: string; value: number; color: string }[];
  accuracyByQuestion?: { stem: string; accuracy: number }[];
}

const DEMO_KPIS: KPI[] = [
  { label: "Avg score", value: "78", unit: "%" },
  { label: "Completion", value: "91", unit: "%" },
  { label: "Avg time", value: "4.2", unit: "min" },
  { label: "Needs attention", value: 3, unit: " Qs" },
];

const DEMO_MASTERY = [
  { label: "Week 1", value: 52 },
  { label: "Week 2", value: 61 },
  { label: "Week 3", value: 68 },
  { label: "Week 4", value: 74 },
  { label: "Week 5", value: 78 },
];

const DEMO_DIST = [
  { label: "Mastery", value: 45, color: "var(--success)" },
  { label: "On track", value: 35, color: "var(--amber-solid)" },
  { label: "Needs review", value: 20, color: "var(--danger)" },
];

const DEMO_ACCURACY = [
  { stem: "Photosynthesis process", accuracy: 42 },
  { stem: "Cell membrane function", accuracy: 58 },
  { stem: "DNA replication", accuracy: 63 },
  { stem: "Mitosis phases", accuracy: 71 },
  { stem: "Protein synthesis", accuracy: 85 },
];

export function AnalyticsDashboard({
  kpis = DEMO_KPIS,
  masteryData = DEMO_MASTERY,
  scoreDistribution = DEMO_DIST,
  accuracyByQuestion = DEMO_ACCURACY,
}: AnalyticsDashboardProps) {
  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg)] p-4"
          >
            <p className="text-xs uppercase tracking-wide text-[var(--fg-subtle)]">{kpi.label}</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-[var(--fg-strong)]">
              {kpi.value}
              {kpi.unit && <span className="text-sm text-[var(--fg-muted)]">{kpi.unit}</span>}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Mastery over time */}
        <div className="lg:col-span-2 rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--bg)] p-5">
          <p className="mb-4 text-sm font-medium text-[var(--fg)]">Class mastery over time</p>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={masteryData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="masteryGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--fg-subtle)" }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "var(--fg-subtle)" }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", fontSize: 12 }}
                labelStyle={{ color: "var(--fg)" }}
              />
              <Area type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2} fill="url(#masteryGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Score distribution donut */}
        <div className="rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--bg)] p-5">
          <p className="mb-4 text-sm font-medium text-[var(--fg)]">Score distribution</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={scoreDistribution} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={45} outerRadius={70} strokeWidth={0}>
                {scoreDistribution.map((entry) => (
                  <Cell key={entry.label} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 space-y-1">
            {scoreDistribution.map((d) => (
              <div key={d.label} className="flex items-center gap-2 text-xs">
                <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                <span className="text-[var(--fg-muted)]">{d.label}</span>
                <span className="ml-auto font-mono text-[var(--fg-subtle)]">{d.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Accuracy by question */}
      <div className="rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--bg)] p-5">
        <p className="mb-4 text-sm font-medium text-[var(--fg)]">Accuracy by question</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={accuracyByQuestion} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "var(--fg-subtle)" }} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="stem" width={160} tick={{ fontSize: 11, fill: "var(--fg-subtle)" }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", fontSize: 12 }}
            />
            <Bar dataKey="accuracy" radius={[0, 4, 4, 0]}>
              {accuracyByQuestion.map((entry) => (
                <Cell
                  key={entry.stem}
                  fill={entry.accuracy < 60 ? "var(--danger)" : entry.accuracy < 75 ? "var(--amber-solid)" : "var(--success-solid)"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
