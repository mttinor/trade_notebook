"use client";

import { useEffect, useMemo, useState } from "react";
import type { Day, Journal, Trade, TradeResult } from "@/lib/types";
import { newTrade } from "@/lib/types";
import { faDate, fmtMoney, fmtR, sortedDays, todayISO, weekdayIndex, WEEKDAYS_FA, type Summary } from "@/lib/stats";

interface Props {
  journal: Journal;
  summary: Summary;
  update: (fn: (j: Journal) => Journal) => void;
  focusDate: string | null;
}

const RESULT_LABEL: Record<TradeResult, string> = { TP: "TP · سود", SL: "SL · استاپ", RF: "RF · ریسک‌فری" };
const RESULT_STYLE: Record<TradeResult, string> = {
  TP: "bg-tp text-white border-tp",
  SL: "bg-sl text-white border-sl",
  RF: "bg-rf text-white border-rf",
};

function shiftDate(date: string, delta: number) {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return dt.toISOString().slice(0, 10);
}

export default function DayEntry({ journal, summary, update, focusDate }: Props) {
  const [date, setDate] = useState(focusDate ?? todayISO());
  useEffect(() => {
    if (focusDate) setDate(focusDate);
  }, [focusDate]);

  const day: Day = journal.days[date] ?? { date, planned: 0, note: "", trades: [] };
  const cur = journal.settings.currency;

  const strategies = useMemo(() => {
    const s = new Set(journal.settings.strategies);
    Object.values(journal.days).forEach((d) => d.trades.forEach((t) => t.strategy && s.add(t.strategy)));
    return [...s];
  }, [journal]);

  const recent = useMemo(() => sortedDays(journal).filter((d) => d.trades.length || d.planned).slice(-10).reverse(), [journal]);

  function setDay(fn: (d: Day) => Day) {
    update((j) => {
      const prev = j.days[date] ?? { date, planned: 0, note: "", trades: [] };
      const next = fn(prev);
      const days = { ...j.days };
      if (!next.trades.length && !next.planned && !next.note.trim()) delete days[date];
      else days[date] = next;
      return { ...j, days };
    });
  }

  const setTrade = (tid: string, patch: Partial<Trade>) =>
    setDay((d) => ({ ...d, trades: d.trades.map((t) => (t.id === tid ? { ...t, ...patch } : t)) }));

  function setResult(t: Trade, result: TradeResult) {
    const abs = Math.abs(t.r);
    const r = result === "RF" ? 0 : result === "SL" ? -(t.result === "SL" && abs ? abs : 1) : t.result === "TP" && abs ? abs : 2;
    setTrade(t.id, { result, r });
  }

  function addTrade() {
    setDay((d) => ({
      ...d,
      planned: Math.max(d.planned, d.trades.length + 1),
      trades: [...d.trades, newTrade({ strategy: d.trades[d.trades.length - 1]?.strategy ?? "" })],
    }));
  }

  const wins = day.trades.filter((t) => t.result === "TP").length;
  const losses = day.trades.filter((t) => t.result === "SL").length;
  const dayR = day.trades.reduce((a, t) => a + t.r, 0);
  const remaining = Math.max(0, day.planned - day.trades.length);
  const overTrade = day.planned > 0 && day.trades.length > day.planned;
  const riskAmount = summary.balance * (summary.nextRiskPct / 100);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="grid content-start gap-5">
        {/* انتخاب روز */}
        <section className="card flex flex-wrap items-center gap-3 p-4">
          <button className="btn-ghost px-3" onClick={() => setDate(shiftDate(date, -1))} aria-label="روز قبل">→</button>
          <div className="min-w-0 flex-1">
            <div className="text-xl font-black">{WEEKDAYS_FA[weekdayIndex(date)]} · {faDate(date)}</div>
            <div className="num text-sm text-mute">{date}</div>
          </div>
          <input type="date" className="input num w-auto" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <button className="btn-ghost px-3" onClick={() => setDate(shiftDate(date, 1))} aria-label="روز بعد">←</button>
          {date !== todayISO() && <button className="btn-ghost" onClick={() => setDate(todayISO())}>امروز</button>}
        </section>

        {/* برنامه روز */}
        <section className="card p-5">
          <h2 className="mb-1 text-lg font-bold">امروز چند معامله برنامه داری؟</h2>
          <p className="mb-4 text-sm text-mute">تعداد را اول روز ثبت کن تا انضباط معاملاتی‌ات سنجیده شود.</p>
          <div className="flex flex-wrap items-center gap-2">
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setDay((d) => ({ ...d, planned: n }))}
                className={`btn num size-11 px-0 text-base ${day.planned === n ? "bg-ink text-bg" : "border border-line"}`}
              >
                {n}
              </button>
            ))}
            <input
              type="number"
              min={0}
              max={50}
              className="input num w-24"
              value={day.planned}
              onChange={(e) => setDay((d) => ({ ...d, planned: Math.max(0, Math.min(50, Number(e.target.value) || 0)) }))}
              aria-label="تعداد دلخواه"
            />
          </div>
          {overTrade && (
            <p className="mt-3 rounded-xl bg-sl/10 px-3 py-2 text-sm text-sl">
              بیشتر از برنامه معامله کردی ({day.trades.length} از {day.planned}) — اورترید.
            </p>
          )}
        </section>

        {/* معاملات */}
        <section className="grid gap-3">
          {day.trades.map((t, i) => (
            <article key={t.id} className="card p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="num grid size-9 place-items-center rounded-lg bg-bg font-bold">{i + 1}</span>
                <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="نتیجه">
                  {(["TP", "SL", "RF"] as TradeResult[]).map((r) => (
                    <button
                      key={r}
                      role="radio"
                      aria-checked={t.result === r}
                      onClick={() => setResult(t, r)}
                      className={`btn border px-3 ${t.result === r ? RESULT_STYLE[r] : "border-line text-mute"}`}
                    >
                      {RESULT_LABEL[r]}
                    </button>
                  ))}
                </div>
                <span className={`num ms-auto text-lg font-bold ${t.r > 0 ? "text-tp" : t.r < 0 ? "text-sl" : "text-rf"}`}>{fmtR(t.r)}</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)_120px]">
                <div>
                  <label className="label">{t.result === "SL" ? "ضرر (R)" : "ریوارد (R)"}</label>
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    disabled={t.result === "RF"}
                    className="input num"
                    value={t.result === "RF" ? 0 : Math.abs(t.r)}
                    onChange={(e) => {
                      const v = Math.abs(Number(e.target.value) || 0);
                      setTrade(t.id, { r: t.result === "SL" ? -v : v });
                    }}
                  />
                </div>
                <div>
                  <label className="label">استراتژی</label>
                  <input list="nt-strategies" className="input" value={t.strategy} onChange={(e) => setTrade(t.id, { strategy: e.target.value })} placeholder="مثلاً شکست سقف" />
                </div>
                <div>
                  <label className="label">نماد</label>
                  <input className="input num w-full text-start" value={t.symbol} onChange={(e) => setTrade(t.id, { symbol: e.target.value.toUpperCase() })} placeholder="XAUUSD" />
                </div>
                <div>
                  <label className="label">جهت</label>
                  <select className="input" value={t.side} onChange={(e) => setTrade(t.id, { side: e.target.value as Trade["side"] })}>
                    <option value="">—</option>
                    <option value="buy">Buy</option>
                    <option value="sell">Sell</option>
                  </select>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <input className="input" value={t.note} onChange={(e) => setTrade(t.id, { note: e.target.value })} placeholder="یادداشت: چرا وارد شدی؟ چه چیزی را درست/اشتباه انجام دادی؟" />
                <button className="btn-danger px-3" onClick={() => setDay((d) => ({ ...d, trades: d.trades.filter((x) => x.id !== t.id) }))}>
                  حذف
                </button>
              </div>
            </article>
          ))}

          {Array.from({ length: remaining }).map((_, i) => (
            <button key={`slot-${i}`} onClick={addTrade} className="card flex min-h-16 cursor-pointer items-center gap-3 border-dashed p-4 text-mute hover:border-ink hover:text-ink">
              <span className="num grid size-9 place-items-center rounded-lg bg-bg font-bold">{day.trades.length + i + 1}</span>
              معامله برنامه‌ریزی‌شده — بعد از بسته شدن، نتیجه را ثبت کن
            </button>
          ))}

          <button onClick={addTrade} className="btn-primary justify-self-start">+ ثبت معامله</button>
        </section>

        <section className="card p-4">
          <label className="label" htmlFor="day-note">یادداشت روز</label>
          <textarea id="day-note" rows={3} className="input py-2" value={day.note} onChange={(e) => setDay((d) => ({ ...d, note: e.target.value }))} placeholder="شرایط بازار، اخبار، حال روحی، درس امروز…" />
        </section>

        <datalist id="nt-strategies">
          {strategies.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>

      <aside className="grid content-start gap-4">
        <section className={`rounded-2xl p-5 ${summary.accountStopped ? "bg-sl text-white" : "bg-hl text-hl-ink"}`}>
          <p className="text-sm opacity-80">ریسک معامله بعدی</p>
          <p className="num text-4xl font-black">{summary.nextRiskPct}%</p>
          <p className="num mt-1 text-sm font-medium">{fmtMoney(riskAmount, cur)}</p>
          <p className="mt-2 text-sm">{summary.nextRiskReason}</p>
        </section>

        <section className="card grid grid-cols-3 gap-2 p-4 text-center">
          <div><div className="num text-2xl font-black text-tp">{wins}</div><div className="text-xs text-mute">سود</div></div>
          <div><div className="num text-2xl font-black text-sl">{losses}</div><div className="text-xs text-mute">ضرر</div></div>
          <div><div className={`num text-2xl font-black ${dayR >= 0 ? "text-tp" : "text-sl"}`}>{fmtR(dayR)}</div><div className="text-xs text-mute">امروز</div></div>
        </section>

        <section className="card p-4">
          <h3 className="mb-2 font-bold">روزهای اخیر</h3>
          {recent.length === 0 && <p className="text-sm text-mute">هنوز روزی ثبت نشده.</p>}
          <ul className="grid gap-1">
            {recent.map((d) => {
              const r = d.trades.reduce((a, t) => a + t.r, 0);
              return (
                <li key={d.date}>
                  <button onClick={() => setDate(d.date)} className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-start text-sm hover:bg-bg ${d.date === date ? "bg-bg" : ""}`}>
                    <span className="flex-1 truncate">{faDate(d.date, { month: "short", day: "numeric", weekday: "short" })}</span>
                    <span className="flex gap-0.5">
                      {d.trades.map((t) => (
                        <span key={t.id} className={`size-2.5 rounded-full ${t.result === "TP" ? "bg-tp" : t.result === "SL" ? "bg-sl" : "bg-rf"}`} />
                      ))}
                    </span>
                    <span className={`num w-14 text-end font-medium ${r > 0 ? "text-tp" : r < 0 ? "text-sl" : "text-mute"}`}>{fmtR(r)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </aside>
    </div>
  );
}
