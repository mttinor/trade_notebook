"use client";

import { useMemo } from "react";
import type { Journal } from "@/lib/types";
import {
  byMonth,
  byWeekday,
  enMonth,
  fmtMoney,
  fmtPct,
  fmtR,
  groupBy,
  rDistribution,
  rollingWinRate,
  sortedDays,
  winRateBlocks,
  type Summary,
  type TradeRow,
} from "@/lib/stats";
import { ChartCard, DistributionChart, DrawdownChart, EquityChart, MonthlyChart, PlanChart, SignedBars, WinRateLine } from "./Charts";

interface Props {
  journal: Journal;
  rows: TradeRow[];
  summary: Summary;
}

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "tp" | "sl" }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-mute">{label}</div>
      <div className={`num mt-1 text-2xl font-black ${tone === "tp" ? "text-tp" : tone === "sl" ? "text-sl" : ""}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-mute">{hint}</div>}
    </div>
  );
}

export default function Dashboard({ journal, rows, summary: s }: Props) {
  const cur = journal.settings.currency;
  const block = journal.settings.winRateBlock || 100;

  const d = useMemo(() => {
    const equity = [{ index: 0, balance: journal.settings.initialBalance, date: "شروع" }, ...rows.map((r) => ({ index: r.index, balance: r.balanceAfter, date: r.date }))];
    const drawdown = [{ index: 0, drawdown: 0 }, ...rows.map((r) => ({ index: r.index, drawdown: r.drawdownPct }))];
    const months = byMonth(journal, rows).map((m) => ({ label: enMonth(m.month), wins: m.wins, losses: m.losses, winRate: Math.round(m.winRate * 1000) / 10 }));
    const strategies = groupBy(rows, (r) => r.strategy.trim()).sort((a, b) => b.netR - a.netR);
    const weekdays = byWeekday(rows);
    const dist = rDistribution(rows);
    const rolling = rollingWinRate(rows, 20);
    const blocks = winRateBlocks(rows, block);
    const plan = sortedDays(journal)
      .filter((x) => x.planned || x.trades.length)
      .slice(-30)
      .map((x) => ({ label: x.date.slice(5), planned: x.planned, done: x.trades.length }));
    const symbols = groupBy(rows, (r) => r.symbol.trim()).filter((x) => x.key !== "—").sort((a, b) => b.netR - a.netR).slice(0, 10);
    return { equity, drawdown, months, strategies, weekdays, dist, rolling, blocks, plan, symbols };
  }, [journal, rows, block]);

  if (!rows.length) {
    return (
      <div className="card p-10 text-center">
        <h2 className="text-xl font-bold">هنوز معامله‌ای ثبت نشده</h2>
        <p className="mt-2 text-mute">از تب «ثبت روزانه» معامله ثبت کن یا از «تنظیمات» فایل اکسل بک‌تستت را وارد کن.</p>
      </div>
    );
  }

  const pf = Number.isFinite(s.profitFactor) ? s.profitFactor.toFixed(2) : "∞";

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi label="بالانس" value={fmtMoney(s.balance, cur)} hint={`شروع ${fmtMoney(s.initialBalance, cur)}`} />
        <Kpi label="سود خالص" value={fmtPct(s.netPct, 2)} tone={s.netPct >= 0 ? "tp" : "sl"} hint={fmtMoney(s.balance - s.initialBalance, cur)} />
        <Kpi label="وین‌ریت" value={`${(s.winRate * 100).toFixed(1)}%`} hint={`${s.wins} سود · ${s.losses} ضرر · ${s.riskFree} ریسک‌فری`} />
        <Kpi label="کل معاملات" value={String(s.total)} hint={`${s.tradingDays} روز معاملاتی`} />
        <Kpi label="مجموع R" value={fmtR(s.netR)} tone={s.netR >= 0 ? "tp" : "sl"} hint={`امید ریاضی ${fmtR(s.expectancyR)} در هر معامله`} />
        <Kpi label="پرافیت فاکتور" value={pf} hint="سود ناخالص ÷ ضرر ناخالص" />
        <Kpi label="میانگین ریوارد سودها" value={fmtR(s.avgWinR)} hint={`میانگین ضرر ${fmtR(s.avgLossR)}`} />
        <Kpi label="بیشترین دراوداون" value={fmtPct(s.maxDrawdownPct, 2)} tone="sl" hint={`الان ${fmtPct(s.currentDrawdownPct, 2)}`} />
        <Kpi label="بیشترین ضرر پشت‌سرهم" value={String(s.maxLossStreak)} hint={`بیشترین سود پشت‌سرهم ${s.maxWinStreak}`} />
        <Kpi label="انضباط برنامه" value={`${s.disciplinePct.toFixed(0)}%`} hint="روزهایی که از برنامه بیشتر معامله نشد" />
      </div>

      <ChartCard title="منحنی سرمایه" subtitle="بالانس بعد از هر معامله با ریسک طبق قوانین مدیریت سرمایه؛ خط‌چین = بالانس اولیه" h={300}>
        <EquityChart data={d.equity} initial={journal.settings.initialBalance} cur={cur} />
      </ChartCard>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="سود و ضرر ماهانه" subtitle="تعداد معاملات سودده/ضررده و وین‌ریت هر ماه">
          <MonthlyChart data={d.months} />
        </ChartCard>
        <ChartCard title="دراوداون" subtitle="فاصله بالانس از سقف قبلی">
          <DrawdownChart data={d.drawdown} />
        </ChartCard>
        <ChartCard title="عملکرد استراتژی‌ها" subtitle="مجموع R هر استراتژی" h={Math.max(200, d.strategies.length * 38)}>
          <SignedBars data={d.strategies.map((x) => ({ name: x.key, netR: x.netR }))} dataKey="netR" label="name" layout="vertical" />
        </ChartCard>
        <ChartCard title="توزیع ریوارد" subtitle="چند معامله با چه R بسته شده">
          <DistributionChart data={d.dist} />
        </ChartCard>
        <ChartCard title="وین‌ریت غلتان" subtitle="میانگین ۲۰ معامله آخر (بدون ریسک‌فری)">
          <WinRateLine data={d.rolling} xKey="index" yKey="winRate" name="وین‌ریت" />
        </ChartCard>
        <ChartCard title={`وین‌ریت هر ${block} معامله`} subtitle="سنجش دوره‌ای وین‌ریت">
          <WinRateLine data={d.blocks} xKey="block" yKey="winRate" name="وین‌ریت" />
        </ChartCard>
        <ChartCard title="روزهای هفته" subtitle="مجموع R به تفکیک روز">
          <SignedBars data={d.weekdays.map((x) => ({ name: x.key, netR: x.netR }))} dataKey="netR" label="name" />
        </ChartCard>
        <ChartCard title="برنامه در برابر اجرا" subtitle="۳۰ روز آخر">
          <PlanChart data={d.plan} />
        </ChartCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card min-w-0 p-4">
          <h3 className="mb-3 font-bold">جدول استراتژی‌ها</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr><th className="th">استراتژی</th><th className="th">تعداد</th><th className="th">وین‌ریت</th><th className="th">مجموع R</th><th className="th">سود/ضرر</th></tr>
              </thead>
              <tbody>
                {d.strategies.map((x) => (
                  <tr key={x.key}>
                    <td className="td">{x.key === "—" ? "بدون استراتژی" : x.key}</td>
                    <td className="td num">{x.trades}</td>
                    <td className="td num">{(x.winRate * 100).toFixed(1)}%</td>
                    <td className={`td num ${x.netR >= 0 ? "text-tp" : "text-sl"}`}>{fmtR(x.netR)}</td>
                    <td className={`td num ${x.pnl >= 0 ? "text-tp" : "text-sl"}`}>{fmtMoney(x.pnl, cur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card min-w-0 p-4">
          <h3 className="mb-3 font-bold">رشته‌های ضرر پشت‌سرهم</h3>
          {s.lossStreaks.length ? (
            <div className="flex flex-wrap gap-2">
              {s.lossStreaks.map((n, i) => (
                <span key={i} className={`num rounded-lg px-3 py-1 font-bold ${n >= 4 ? "bg-sl text-white" : "bg-sl/10 text-sl"}`}>{n}</span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-mute">رشته ضرری (۲ یا بیشتر) نداشتی.</p>
          )}
          {d.symbols.length > 0 && (
            <>
              <h3 className="mb-3 mt-6 font-bold">نمادها</h3>
              <ul className="grid gap-1 text-sm">
                {d.symbols.map((x) => (
                  <li key={x.key} className="flex justify-between border-t border-line py-1.5">
                    <span className="num">{x.key}</span>
                    <span className="text-mute">{x.trades} معامله · {(x.winRate * 100).toFixed(0)}%</span>
                    <span className={`num font-medium ${x.netR >= 0 ? "text-tp" : "text-sl"}`}>{fmtR(x.netR)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
