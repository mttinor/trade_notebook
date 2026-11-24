"use client";

import type { Day, Journal, Trade } from "./types";
import { newTrade } from "./types";
import { buildRows, byMonth, summarize, weekdayIndex, WEEKDAYS_EN } from "./stats";

// ===== ورود و خروج اکسل، سازگار با قالب Backtest (Date | Week Day | Trade 1..3 | Win | Loss | استراتژی 1..3 | توضیحات) =====

type Cell = string | number | boolean | Date | null | undefined;

const pad = (n: number) => String(n).padStart(2, "0");

function parseDate(v: Cell, SSF: { parse_date_code: (n: number) => { y: number; m: number; d: number } | null }): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    const p = SSF.parse_date_code(v);
    return p ? `${p.y}-${pad(p.m)}-${pad(p.d)}` : null;
  }
  if (v instanceof Date) return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  const m = String(v).trim().match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  return m ? `${m[1]}-${pad(+m[2])}-${pad(+m[3])}` : null;
}

export function toLatinDigits(s: string) {
  return s
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

/** تبدیل محتوای یک خانه Trade به معامله: عدد = ریوارد (TP)، SL = استاپ، RF/BE = ریسک‌فری */
export function parseTradeCell(v: Cell): Pick<Trade, "result" | "r"> | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const upper = s.toUpperCase();
  if (upper === "SL") return { result: "SL", r: -1 };
  if (upper === "RF" || upper === "BE") return { result: "RF", r: 0 };
  if (upper === "TP") return { result: "TP", r: 1 };
  const n = Number(toLatinDigits(s).replace(/r$/i, "").trim());
  if (!Number.isFinite(n)) return null;
  if (n > 0) return { result: "TP", r: n };
  if (n < 0) return { result: "SL", r: n };
  return { result: "RF", r: 0 };
}

export interface ImportResult {
  days: Record<string, Day>;
  sheets: string[];
  trades: number;
  strategies: string[];
}

export async function importExcel(file: File): Promise<ImportResult> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const days: Record<string, Day> = {};
  const usedSheets: string[] = [];
  const strategies = new Set<string>();

  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<Cell[]>(wb.Sheets[name], { header: 1, raw: true, defval: null });
    const h = rows.findIndex((r) => r?.some((c) => typeof c === "string" && c.trim().toLowerCase() === "date"));
    if (h < 0) continue;
    const head = rows[h].map((c) => (typeof c === "string" ? c.trim() : ""));
    const dateCol = head.findIndex((c) => c.toLowerCase() === "date");
    const tradeCols = head.map((c, i) => (/^trade\s*\d+$/i.test(c) ? i : -1)).filter((i) => i >= 0);
    const stratCols = head.map((c, i) => (c.includes("استراتژی") || /^strategy/i.test(c) ? i : -1)).filter((i) => i >= 0);
    const noteCol = head.findIndex((c) => c === "توضیحات" || /^notes?$/i.test(c));
    if (dateCol < 0 || !tradeCols.length) continue;

    let found = false;
    for (const row of rows.slice(h + 1)) {
      if (!row) continue;
      const date = parseDate(row[dateCol], XLSX.SSF);
      if (!date) continue;
      const trades: Trade[] = [];
      tradeCols.forEach((col, k) => {
        const parsed = parseTradeCell(row[col]);
        if (!parsed) return;
        const strategy = stratCols[k] != null && row[stratCols[k]] != null ? String(row[stratCols[k]]).trim() : "";
        if (strategy) strategies.add(strategy);
        trades.push(newTrade({ ...parsed, strategy }));
      });
      if (!trades.length) continue;
      found = true;
      const note = noteCol >= 0 && row[noteCol] != null ? String(row[noteCol]).trim() : "";
      const existing = days[date];
      // اگر یک تاریخ در چند شیت تکرار شده باشد، نسخه کامل‌تر نگه داشته می‌شود
      if (!existing || existing.trades.length < trades.length) {
        days[date] = { date, planned: trades.length, note, trades };
      }
    }
    if (found) usedSheets.push(name);
  }
  const trades = Object.values(days).reduce((a, d) => a + d.trades.length, 0);
  return { days, sheets: usedSheets, trades, strategies: [...strategies] };
}

const MONTH_SHEETS = ["JAN", "FEB", "MAR", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function tradeCell(t: Trade): string | number {
  if (t.result === "SL") return t.r === -1 ? "SL" : t.r;
  if (t.result === "RF") return "RF";
  return t.r;
}

export async function exportExcel(journal: Journal, fileName: string) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const allDays = Object.values(journal.days).sort((a, b) => a.date.localeCompare(b.date));
  const maxTrades = Math.max(3, ...allDays.map((d) => d.trades.length));
  const tradeHead = Array.from({ length: maxTrades }, (_, i) => `Trade ${i + 1}`);
  const stratHead = Array.from({ length: maxTrades }, (_, i) => `استراتژی ${i + 1}`);
  const header = ["Date", "Week Day", ...tradeHead, "Win", "Loss", ...stratHead, "توضیحات"];

  const dayRow = (date: string) => {
    const d = journal.days[date];
    const ts = d?.trades ?? [];
    const cells = Array.from({ length: maxTrades }, (_, i) => (ts[i] ? tradeCell(ts[i]) : null));
    const strats = Array.from({ length: maxTrades }, (_, i) => ts[i]?.strategy || null);
    const wins = ts.filter((t) => t.result === "TP").length;
    const losses = ts.filter((t) => t.result === "SL").length;
    return [date, WEEKDAYS_EN[weekdayIndex(date)], ...cells, wins || null, losses || null, ...strats, d?.note || null];
  };

  // روزهای هر ماه به‌صورت کامل (مثل قالب اصلی)
  const months = [...new Set(allDays.map((d) => d.date.slice(0, 7)))];
  const datesOf = (month: string) => {
    const [y, m] = month.split("-").map(Number);
    const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return Array.from({ length: n }, (_, i) => `${month}-${pad(i + 1)}`);
  };

  const allRows = [header, ...months.flatMap((m) => datesOf(m).map(dayRow))];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(allRows), "ALL");

  const rows = buildRows(journal);
  const monthStats = byMonth(journal, rows);
  for (const m of months) {
    const st = monthStats.find((x) => x.month === m);
    const body = datesOf(m).map(dayRow);
    const summary = st
      ? [
          [],
          ["", "", "Win", st.wins, "Loss", st.losses],
          ["", "", "All", st.trades, "W/R", `${(st.winRate * 100).toFixed(1)}%`],
          ["", "", "Initial Balance", Number(st.startBalance.toFixed(2)), "Final Balance", Number(st.endBalance.toFixed(2))],
          ["", "", "Target", Number(st.target.toFixed(2)), "Loss streaks", st.lossStreaks.join(" ") || "-"],
        ]
      : [];
    const [y, mm] = m.split("-");
    let name = `${MONTH_SHEETS[Number(mm) - 1]} ${y}`;
    if (wb.SheetNames.includes(name)) name += "_";
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, ...body, ...summary]), name);
  }

  const detail = [
    ["#", "Date", "Week Day", "Result", "R", "Strategy", "Symbol", "Side", "Risk %", "PnL", "Balance", "Drawdown %", "Note"],
    ...rows.map((r) => [
      r.index, r.date, WEEKDAYS_EN[weekdayIndex(r.date)], r.result, r.r, r.strategy, r.symbol, r.side,
      r.riskPct, Number(r.pnl.toFixed(2)), Number(r.balanceAfter.toFixed(2)), Number(r.drawdownPct.toFixed(2)), r.note,
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(detail), "Trades");

  const s = summarize(journal, rows);
  const stats = [
    ["ALL TRADES", s.total],
    ["wins", s.wins],
    ["loss", s.losses],
    ["risk free", s.riskFree],
    ["W/R", `${(s.winRate * 100).toFixed(1)}%`],
    ["Net R", Number(s.netR.toFixed(2))],
    ["Profit Factor", Number.isFinite(s.profitFactor) ? Number(s.profitFactor.toFixed(2)) : "∞"],
    ["Initial Balance", s.initialBalance],
    ["Final Balance", Number(s.balance.toFixed(2))],
    ["Max Drawdown %", Number(s.maxDrawdownPct.toFixed(2))],
    ["loss streaks", s.lossStreaks.join(" ") || "-"],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(stats), "Stats");

  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  downloadBlob(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), fileName);
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
