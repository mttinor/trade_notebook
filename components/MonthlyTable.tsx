"use client";

import { useMemo } from "react";
import type { Journal } from "@/lib/types";
import { byMonth, enMonth, faMonth, fmtMoney, fmtPct, fmtR, type TradeRow } from "@/lib/stats";

export default function MonthlyTable({ journal, rows }: { journal: Journal; rows: TradeRow[] }) {
  const months = useMemo(() => byMonth(journal, rows), [journal, rows]);
  const cur = journal.settings.currency;

  if (!months.length) {
    return <div className="card p-10 text-center text-mute">هنوز ماهی با معامله ثبت نشده.</div>;
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {months
          .slice()
          .reverse()
          .map((m) => {
            const progress = m.target > m.startBalance ? ((m.endBalance - m.startBalance) / (m.target - m.startBalance)) * 100 : 0;
            return (
              <article key={m.month} className="card p-5">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-lg font-black">{faMonth(m.month)}</h3>
                  <span className="num text-xs text-mute">{enMonth(m.month)} STATS</span>
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div><dt className="text-xs text-mute">همه</dt><dd className="num text-xl font-black">{m.trades}</dd></div>
                  <div><dt className="text-xs text-mute">سود</dt><dd className="num text-xl font-black text-tp">{m.wins}</dd></div>
                  <div><dt className="text-xs text-mute">ضرر</dt><dd className="num text-xl font-black text-sl">{m.losses}</dd></div>
                </dl>
                <dl className="mt-4 grid gap-1.5 text-sm">
                  <div className="flex justify-between"><dt className="text-mute">وین‌ریت</dt><dd className="num font-bold">{(m.winRate * 100).toFixed(1)}%</dd></div>
                  <div className="flex justify-between"><dt className="text-mute">مجموع R</dt><dd className={`num font-bold ${m.netR >= 0 ? "text-tp" : "text-sl"}`}>{fmtR(m.netR)}</dd></div>
                  <div className="flex justify-between"><dt className="text-mute">بالانس اول ماه</dt><dd className="num">{fmtMoney(m.startBalance, cur)}</dd></div>
                  <div className="flex justify-between"><dt className="text-mute">بالانس آخر ماه</dt><dd className="num font-bold">{fmtMoney(m.endBalance, cur)}</dd></div>
                  <div className="flex justify-between"><dt className="text-mute">بازده ماه</dt><dd className={`num font-bold ${m.pnlPct >= 0 ? "text-tp" : "text-sl"}`}>{fmtPct(m.pnlPct, 2)}</dd></div>
                  <div className="flex justify-between"><dt className="text-mute">ضررهای پشت‌سرهم</dt><dd className="num">{m.lossStreaks.join("  ") || "—"}</dd></div>
                </dl>
                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-xs text-mute">
                    <span>هدف {fmtMoney(m.target, cur)}</span>
                    <span className={m.targetHit ? "font-bold text-tp" : ""}>{m.targetHit ? "هدف رسید" : `${Math.max(0, progress).toFixed(0)}%`}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-bg">
                    <div className={`h-full rounded-full ${m.targetHit ? "bg-tp" : "bg-hl"}`} style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
                  </div>
                </div>
              </article>
            );
          })}
      </div>

      <section className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              {["ماه", "همه", "سود", "ضرر", "RF", "وین‌ریت", "مجموع R", "شروع", "پایان", "بازده", "هدف"].map((h) => (
                <th key={h} className="th">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.month}>
                <td className="td">{faMonth(m.month)} <span className="num text-xs text-mute">{m.month}</span></td>
                <td className="td num">{m.trades}</td>
                <td className="td num text-tp">{m.wins}</td>
                <td className="td num text-sl">{m.losses}</td>
                <td className="td num text-rf">{m.riskFree}</td>
                <td className="td num font-bold">{(m.winRate * 100).toFixed(1)}%</td>
                <td className={`td num ${m.netR >= 0 ? "text-tp" : "text-sl"}`}>{fmtR(m.netR)}</td>
                <td className="td num">{fmtMoney(m.startBalance, cur)}</td>
                <td className="td num">{fmtMoney(m.endBalance, cur)}</td>
                <td className={`td num ${m.pnlPct >= 0 ? "text-tp" : "text-sl"}`}>{fmtPct(m.pnlPct, 2)}</td>
                <td className="td">{m.targetHit ? <span className="text-tp">رسید</span> : <span className="text-mute">نرسید</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
