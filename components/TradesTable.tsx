"use client";

import { useMemo, useState } from "react";
import type { Journal, TradeResult } from "@/lib/types";
import { faDate, faMonth, fmtMoney, fmtR, weekdayIndex, WEEKDAYS_FA, type TradeRow } from "@/lib/stats";

interface Props {
  journal: Journal;
  rows: TradeRow[];
  update: (fn: (j: Journal) => Journal) => void;
  onOpenDay: (date: string) => void;
}

const BADGE: Record<TradeResult, string> = { TP: "bg-tp/15 text-tp", SL: "bg-sl/15 text-sl", RF: "bg-rf/15 text-rf" };

export default function TradesTable({ journal, rows, update, onOpenDay }: Props) {
  const [month, setMonth] = useState("");
  const [strategy, setStrategy] = useState("");
  const [result, setResult] = useState<"" | TradeResult>("");
  const [q, setQ] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const cur = journal.settings.currency;

  const months = useMemo(() => [...new Set(rows.map((r) => r.date.slice(0, 7)))].sort().reverse(), [rows]);
  const strategies = useMemo(() => [...new Set(rows.map((r) => r.strategy).filter(Boolean))].sort(), [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter((r) => (!month || r.date.startsWith(month)) && (!strategy || r.strategy === strategy) && (!result || r.result === result))
      .filter((r) => !needle || [r.symbol, r.note, r.strategy].some((x) => x.toLowerCase().includes(needle)))
      .slice()
      .reverse();
  }, [rows, month, strategy, result, q]);

  const totals = useMemo(() => {
    const w = filtered.filter((r) => r.result === "TP").length;
    const l = filtered.filter((r) => r.result === "SL").length;
    return { n: filtered.length, w, l, wr: w + l ? (w / (w + l)) * 100 : 0, r: filtered.reduce((a, r) => a + r.r, 0), pnl: filtered.reduce((a, r) => a + r.pnl, 0) };
  }, [filtered]);

  function remove(row: TradeRow) {
    update((j) => {
      const day = j.days[row.date];
      if (!day) return j;
      const days = { ...j.days, [row.date]: { ...day, trades: day.trades.filter((t) => t.id !== row.id) } };
      return { ...j, days };
    });
    setConfirmId(null);
  }

  return (
    <div className="grid gap-4">
      <div className="card grid gap-3 p-4 sm:grid-cols-4">
        <select className="input" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="ماه">
          <option value="">همه ماه‌ها</option>
          {months.map((m) => (
            <option key={m} value={m}>{faMonth(m)} ({m})</option>
          ))}
        </select>
        <select className="input" value={strategy} onChange={(e) => setStrategy(e.target.value)} aria-label="استراتژی">
          <option value="">همه استراتژی‌ها</option>
          {strategies.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select className="input" value={result} onChange={(e) => setResult(e.target.value as "" | TradeResult)} aria-label="نتیجه">
          <option value="">همه نتایج</option>
          <option value="TP">TP · سود</option>
          <option value="SL">SL · استاپ</option>
          <option value="RF">RF · ریسک‌فری</option>
        </select>
        <input className="input" placeholder="جستجو در نماد، یادداشت…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 px-1 text-sm text-mute">
        <span><b className="num text-ink">{totals.n}</b> معامله</span>
        <span>وین‌ریت <b className="num text-ink">{totals.wr.toFixed(1)}%</b></span>
        <span>مجموع <b className={`num ${totals.r >= 0 ? "text-tp" : "text-sl"}`}>{fmtR(totals.r)}</b></span>
        <span>سود/ضرر <b className={`num ${totals.pnl >= 0 ? "text-tp" : "text-sl"}`}>{fmtMoney(totals.pnl, cur)}</b></span>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              {["#", "تاریخ", "روز", "نتیجه", "R", "استراتژی", "نماد", "جهت", "ریسک", "سود/ضرر", "بالانس", "یادداشت", ""].map((h, i) => (
                <th key={i} className="th">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={13} className="td py-8 text-center text-mute">معامله‌ای با این فیلترها پیدا نشد.</td></tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-bg">
                <td className="td num text-mute">{r.index}</td>
                <td className="td">{faDate(r.date, { month: "short", day: "numeric", year: "2-digit" })} <span className="num text-xs text-mute">{r.date}</span></td>
                <td className="td">{WEEKDAYS_FA[weekdayIndex(r.date)]}</td>
                <td className="td"><span className={`rounded-md px-2 py-0.5 text-xs font-bold ${BADGE[r.result]}`}>{r.result}</span></td>
                <td className={`td num font-bold ${r.r > 0 ? "text-tp" : r.r < 0 ? "text-sl" : "text-rf"}`}>{fmtR(r.r)}</td>
                <td className="td">{r.strategy || <span className="text-mute">—</span>}</td>
                <td className="td num">{r.symbol || "—"}</td>
                <td className="td">{r.side === "buy" ? "Buy" : r.side === "sell" ? "Sell" : "—"}</td>
                <td className="td num">{r.riskPct}%</td>
                <td className={`td num ${r.pnl >= 0 ? "text-tp" : "text-sl"}`}>{fmtMoney(r.pnl, cur)}</td>
                <td className="td num">{fmtMoney(r.balanceAfter, cur)}</td>
                <td className="td max-w-64 truncate" title={r.note}>{r.note}</td>
                <td className="td">
                  <div className="flex gap-1">
                    <button className="btn-ghost min-h-9 px-2 text-xs" onClick={() => onOpenDay(r.date)}>ویرایش</button>
                    {confirmId === r.id ? (
                      <>
                        <button className="btn-danger min-h-9 px-2 text-xs" onClick={() => remove(r)}>حذف شود</button>
                        <button className="btn-ghost min-h-9 px-2 text-xs" onClick={() => setConfirmId(null)}>نه</button>
                      </>
                    ) : (
                      <button className="btn-ghost min-h-9 px-2 text-xs text-sl" onClick={() => setConfirmId(r.id)}>حذف</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
