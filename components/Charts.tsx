"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// رنگ‌ها از متغیرهای CSS خوانده می‌شوند تا با حالت تیره هماهنگ باشند
const C = {
  tp: "var(--color-tp)",
  sl: "var(--color-sl)",
  rf: "var(--color-rf)",
  ink: "var(--color-ink)",
  mute: "var(--color-mute)",
  line: "var(--color-line)",
  hl: "var(--color-hl)",
};

const axis = { stroke: C.mute, fontSize: 11, tickLine: false, axisLine: false } as const;
const tooltipStyle = {
  contentStyle: { background: "var(--color-card)", border: "1px solid var(--color-line)", borderRadius: 12, fontFamily: "Vazirmatn", fontSize: 12, direction: "rtl" as const },
  labelStyle: { color: "var(--color-mute)" },
};

export function ChartCard({ title, subtitle, children, h = 260 }: { title: string; subtitle?: string; children: React.ReactNode; h?: number }) {
  return (
    <section className="card min-w-0 p-4">
      <h3 className="font-bold">{title}</h3>
      {subtitle && <p className="text-xs text-mute">{subtitle}</p>}
      <div dir="ltr" className="mt-3" style={{ height: h }}>
        <ResponsiveContainer width="100%" height="100%">
          {children as React.ReactElement}
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export function EquityChart({ data, initial, cur }: { data: { index: number; balance: number; date: string }[]; initial: number; cur: string }) {
  return (
    <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
      <defs>
        <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.tp} stopOpacity={0.35} />
          <stop offset="100%" stopColor={C.tp} stopOpacity={0} />
        </linearGradient>
      </defs>
      <CartesianGrid stroke={C.line} vertical={false} />
      <XAxis dataKey="index" {...axis} />
      <YAxis {...axis} width={64} domain={["auto", "auto"]} tickFormatter={(v: number) => `${cur}${Math.round(v)}`} />
      <Tooltip {...tooltipStyle} formatter={(raw: unknown) => { const v = Number(raw); return [`${cur}${v.toFixed(2)}`, "بالانس"]; }} labelFormatter={(l, p) => `معامله ${l} · ${p?.[0]?.payload?.date ?? ""}`} />
      <ReferenceLine y={initial} stroke={C.mute} strokeDasharray="4 4" />
      <Area type="monotone" dataKey="balance" stroke={C.tp} strokeWidth={2} fill="url(#eq)" />
    </AreaChart>
  );
}

export function DrawdownChart({ data }: { data: { index: number; drawdown: number }[] }) {
  return (
    <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
      <CartesianGrid stroke={C.line} vertical={false} />
      <XAxis dataKey="index" {...axis} />
      <YAxis {...axis} width={48} tickFormatter={(v: number) => `${v.toFixed(0)}%`} />
      <Tooltip {...tooltipStyle} formatter={(raw: unknown) => { const v = Number(raw); return [`${v.toFixed(2)}%`, "دراوداون"]; }} labelFormatter={(l) => `معامله ${l}`} />
      <Area type="stepAfter" dataKey="drawdown" stroke={C.sl} fill={C.sl} fillOpacity={0.18} />
    </AreaChart>
  );
}

export function MonthlyChart({ data }: { data: { label: string; wins: number; losses: number; winRate: number }[] }) {
  return (
    <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
      <CartesianGrid stroke={C.line} vertical={false} />
      <XAxis dataKey="label" {...axis} />
      <YAxis yAxisId="n" {...axis} width={32} allowDecimals={false} />
      <YAxis yAxisId="p" orientation="right" {...axis} width={40} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
      <Tooltip {...tooltipStyle} />
      <Legend wrapperStyle={{ fontSize: 12, fontFamily: "Vazirmatn" }} />
      <Bar yAxisId="n" dataKey="wins" name="سود" fill={C.tp} radius={[4, 4, 0, 0]} />
      <Bar yAxisId="n" dataKey="losses" name="ضرر" fill={C.sl} radius={[4, 4, 0, 0]} />
      <Line yAxisId="p" dataKey="winRate" name="وین‌ریت %" stroke={C.ink} strokeWidth={2} dot={{ r: 3 }} />
    </ComposedChart>
  );
}

export function SignedBars({ data, dataKey, label, unit = "R", layout = "horizontal" }: { data: Record<string, unknown>[]; dataKey: string; label: string; unit?: string; layout?: "horizontal" | "vertical" }) {
  if (layout === "vertical") {
    return (
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid stroke={C.line} horizontal={false} />
        <XAxis type="number" {...axis} />
        <YAxis type="category" dataKey={label} {...axis} width={110} />
        <Tooltip {...tooltipStyle} formatter={(raw: unknown) => { const v = Number(raw); return [`${Number(v.toFixed(2))}${unit}`, ""]; }} />
        <ReferenceLine x={0} stroke={C.mute} />
        <Bar dataKey={dataKey} radius={4}>
          {data.map((d, i) => (
            <Cell key={i} fill={Number(d[dataKey]) >= 0 ? C.tp : C.sl} />
          ))}
        </Bar>
      </BarChart>
    );
  }
  return (
    <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
      <CartesianGrid stroke={C.line} vertical={false} />
      <XAxis dataKey={label} {...axis} />
      <YAxis {...axis} width={40} />
      <Tooltip {...tooltipStyle} formatter={(raw: unknown) => { const v = Number(raw); return [`${Number(v.toFixed(2))}${unit}`, ""]; }} />
      <ReferenceLine y={0} stroke={C.mute} />
      <Bar dataKey={dataKey} radius={[4, 4, 0, 0]}>
        {data.map((d, i) => (
          <Cell key={i} fill={Number(d[dataKey]) >= 0 ? C.tp : C.sl} />
        ))}
      </Bar>
    </BarChart>
  );
}

export function DistributionChart({ data }: { data: { r: string; value: number; count: number }[] }) {
  return (
    <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
      <CartesianGrid stroke={C.line} vertical={false} />
      <XAxis dataKey="r" {...axis} />
      <YAxis {...axis} width={32} allowDecimals={false} />
      <Tooltip {...tooltipStyle} formatter={(raw: unknown) => { const v = Number(raw); return [v, "تعداد"]; }} />
      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
        {data.map((d, i) => (
          <Cell key={i} fill={d.value > 0 ? C.tp : d.value < 0 ? C.sl : C.rf} />
        ))}
      </Bar>
    </BarChart>
  );
}

export function WinRateLine({ data, xKey, yKey, name }: { data: Record<string, unknown>[]; xKey: string; yKey: string; name: string }) {
  return (
    <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
      <CartesianGrid stroke={C.line} vertical={false} />
      <XAxis dataKey={xKey} {...axis} />
      <YAxis {...axis} width={40} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
      <Tooltip {...tooltipStyle} formatter={(raw: unknown) => { const v = Number(raw); return [`${v.toFixed(1)}%`, name]; }} />
      <ReferenceLine y={50} stroke={C.mute} strokeDasharray="4 4" />
      <Line dataKey={yKey} stroke={C.ink} strokeWidth={2} dot={data.length < 30} />
    </LineChart>
  );
}

export function PlanChart({ data }: { data: { label: string; planned: number; done: number }[] }) {
  return (
    <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
      <CartesianGrid stroke={C.line} vertical={false} />
      <XAxis dataKey="label" {...axis} />
      <YAxis {...axis} width={28} allowDecimals={false} />
      <Tooltip {...tooltipStyle} />
      <Legend wrapperStyle={{ fontSize: 12, fontFamily: "Vazirmatn" }} />
      <Bar dataKey="planned" name="برنامه" fill={C.line} radius={[4, 4, 0, 0]} />
      <Bar dataKey="done" name="انجام‌شده" fill={C.ink} radius={[4, 4, 0, 0]} />
    </BarChart>
  );
}
