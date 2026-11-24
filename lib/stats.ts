import type { Day, Journal, Settings, Trade } from "./types";

// ===== موتور محاسبات ژورنال =====

export interface TradeRow extends Trade {
  date: string;
  index: number; // شماره معامله در کل ژورنال (از 1)
  dayIndex: number; // شماره معامله در آن روز (از 1)
  riskPct: number; // ریسکی که طبق قوانین مدیریت سرمایه برای این معامله اعمال شد
  pnl: number; // سود/ضرر دلاری
  balanceBefore: number;
  balanceAfter: number;
  drawdownPct: number; // فاصله از سقف بالانس (%)
  stopped: boolean; // آیا بعد از رسیدن به حد ضرر کامل ثبت شده
}

export interface Summary {
  total: number;
  wins: number;
  losses: number;
  riskFree: number;
  winRate: number; // 0..1  (RF حساب نمی‌شود، مثل فایل اکسل)
  netR: number;
  avgWinR: number;
  avgLossR: number;
  expectancyR: number; // میانگین R هر معامله
  profitFactor: number;
  initialBalance: number;
  balance: number;
  netPct: number;
  peak: number;
  maxDrawdownPct: number;
  currentDrawdownPct: number;
  maxWinStreak: number;
  maxLossStreak: number;
  currentStreak: { type: "W" | "L" | null; count: number };
  lossStreaks: number[]; // همه رشته‌های ضرر پشت‌سرهم (≥2)، به ترتیب زمان
  nextRiskPct: number;
  nextRiskReason: string;
  accountStopped: boolean;
  tradingDays: number;
  plannedTotal: number;
  disciplinePct: number; // درصد روزهایی که تعداد معامله ≤ برنامه بود
}

export interface MonthRow {
  month: string; // YYYY-MM
  trades: number;
  wins: number;
  losses: number;
  riskFree: number;
  winRate: number;
  netR: number;
  startBalance: number;
  endBalance: number;
  target: number;
  targetHit: boolean;
  pnlPct: number;
  lossStreaks: number[];
}

export interface GroupRow {
  key: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  netR: number;
  pnl: number;
}

export function sortedDays(journal: Journal): Day[] {
  return Object.values(journal.days).sort((a, b) => a.date.localeCompare(b.date));
}

export function riskFor(
  balance: number,
  s: Settings
): { pct: number; reason: string; stopped: boolean } {
  const init = s.initialBalance || 1;
  const profitPct = ((balance - init) / init) * 100;
  if (profitPct <= -Math.abs(s.risk.maxDrawdownPct)) {
    return { pct: 0, reason: `حد ضرر کامل (−${s.risk.maxDrawdownPct}%) — معامله متوقف`, stopped: true };
  }
  if (balance < init) {
    return { pct: s.risk.drawdown, reason: "حساب در دراوداون است", stopped: false };
  }
  if (profitPct > s.risk.boostThresholdPct) {
    return { pct: s.risk.boosted, reason: `سود بالای +${s.risk.boostThresholdPct}%`, stopped: false };
  }
  return { pct: s.risk.base, reason: `سود زیر +${s.risk.boostThresholdPct}%`, stopped: false };
}

/** همه معاملات به ترتیب زمان، با محاسبه ریسک و بالانس مرکب */
export function buildRows(journal: Journal): TradeRow[] {
  const s = journal.settings;
  let bal = s.initialBalance;
  let peak = bal;
  let idx = 0;
  const rows: TradeRow[] = [];
  for (const day of sortedDays(journal)) {
    day.trades.forEach((t, i) => {
      idx += 1;
      const risk = riskFor(bal, s);
      const before = bal;
      const pnl = risk.stopped ? 0 : before * (risk.pct / 100) * (Number(t.r) || 0);
      bal = before + pnl;
      peak = Math.max(peak, bal);
      rows.push({
        ...t,
        date: day.date,
        index: idx,
        dayIndex: i + 1,
        riskPct: risk.pct,
        pnl,
        balanceBefore: before,
        balanceAfter: bal,
        drawdownPct: peak > 0 ? ((bal - peak) / peak) * 100 : 0,
        stopped: risk.stopped,
      });
    });
  }
  return rows;
}

function streaks(rows: { result: Trade["result"] }[]) {
  let maxW = 0, maxL = 0, curType: "W" | "L" | null = null, cur = 0;
  const lossStreaks: number[] = [];
  const flush = () => {
    if (curType === "L" && cur >= 2) lossStreaks.push(cur);
  };
  for (const r of rows) {
    if (r.result === "RF") continue; // ریسک‌فری رشته را قطع نمی‌کند
    const t = r.result === "TP" ? "W" : "L";
    if (t === curType) cur += 1;
    else {
      flush();
      curType = t;
      cur = 1;
    }
    if (t === "W") maxW = Math.max(maxW, cur);
    else maxL = Math.max(maxL, cur);
  }
  flush();
  return { maxW, maxL, current: { type: curType, count: cur }, lossStreaks };
}

function counts(rows: TradeRow[]) {
  const wins = rows.filter((r) => r.result === "TP").length;
  const losses = rows.filter((r) => r.result === "SL").length;
  const riskFree = rows.filter((r) => r.result === "RF").length;
  const netR = rows.reduce((a, r) => a + (Number(r.r) || 0), 0);
  const pnl = rows.reduce((a, r) => a + r.pnl, 0);
  return { wins, losses, riskFree, netR, pnl, winRate: wins + losses ? wins / (wins + losses) : 0 };
}

export function summarize(journal: Journal, rows: TradeRow[]): Summary {
  const s = journal.settings;
  const c = counts(rows);
  const winRs = rows.filter((r) => r.result === "TP").map((r) => r.r);
  const lossRs = rows.filter((r) => r.result === "SL").map((r) => r.r);
  const grossWin = rows.filter((r) => r.pnl > 0).reduce((a, r) => a + r.pnl, 0);
  const grossLoss = Math.abs(rows.filter((r) => r.pnl < 0).reduce((a, r) => a + r.pnl, 0));
  const balance = rows.length ? rows[rows.length - 1].balanceAfter : s.initialBalance;
  let peak = s.initialBalance;
  let maxDD = 0;
  for (const r of rows) {
    peak = Math.max(peak, r.balanceAfter);
    maxDD = Math.min(maxDD, ((r.balanceAfter - peak) / peak) * 100);
  }
  const st = streaks(rows);
  const next = riskFor(balance, s);
  const days = sortedDays(journal).filter((d) => d.trades.length || d.planned);
  const planDays = days.filter((d) => d.planned > 0);
  const disciplined = planDays.filter((d) => d.trades.length <= d.planned).length;
  return {
    total: rows.length,
    wins: c.wins,
    losses: c.losses,
    riskFree: c.riskFree,
    winRate: c.winRate,
    netR: c.netR,
    avgWinR: winRs.length ? winRs.reduce((a, b) => a + b, 0) / winRs.length : 0,
    avgLossR: lossRs.length ? lossRs.reduce((a, b) => a + b, 0) / lossRs.length : 0,
    expectancyR: rows.length ? c.netR / rows.length : 0,
    profitFactor: grossLoss ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0,
    initialBalance: s.initialBalance,
    balance,
    netPct: s.initialBalance ? ((balance - s.initialBalance) / s.initialBalance) * 100 : 0,
    peak: Math.max(s.initialBalance, ...rows.map((r) => r.balanceAfter)),
    maxDrawdownPct: maxDD,
    currentDrawdownPct: rows.length ? rows[rows.length - 1].drawdownPct : 0,
    maxWinStreak: st.maxW,
    maxLossStreak: st.maxL,
    currentStreak: st.current,
    lossStreaks: st.lossStreaks,
    nextRiskPct: next.pct,
    nextRiskReason: next.reason,
    accountStopped: next.stopped,
    tradingDays: days.filter((d) => d.trades.length).length,
    plannedTotal: days.reduce((a, d) => a + (d.planned || 0), 0),
    disciplinePct: planDays.length ? (disciplined / planDays.length) * 100 : 100,
  };
}

export function byMonth(journal: Journal, rows: TradeRow[]): MonthRow[] {
  const map = new Map<string, TradeRow[]>();
  for (const r of rows) {
    const m = r.date.slice(0, 7);
    if (!map.has(m)) map.set(m, []);
    map.get(m)!.push(r);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, rs]) => {
      const c = counts(rs);
      const start = rs[0].balanceBefore;
      const end = rs[rs.length - 1].balanceAfter;
      const target = start * (1 + journal.settings.monthlyTargetPct / 100);
      return {
        month,
        trades: rs.length,
        wins: c.wins,
        losses: c.losses,
        riskFree: c.riskFree,
        winRate: c.winRate,
        netR: c.netR,
        startBalance: start,
        endBalance: end,
        target,
        targetHit: end >= target,
        pnlPct: start ? ((end - start) / start) * 100 : 0,
        lossStreaks: streaks(rs).lossStreaks,
      };
    });
}

export function groupBy(rows: TradeRow[], keyFn: (r: TradeRow) => string): GroupRow[] {
  const map = new Map<string, TradeRow[]>();
  for (const r of rows) {
    const k = keyFn(r) || "—";
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(r);
  }
  return [...map.entries()].map(([key, rs]) => {
    const c = counts(rs);
    return { key, trades: rs.length, wins: c.wins, losses: c.losses, winRate: c.winRate, netR: c.netR, pnl: c.pnl };
  });
}

export const WEEKDAYS_FA = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];
export const WEEKDAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function weekdayIndex(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function byWeekday(rows: TradeRow[]): GroupRow[] {
  const order = [6, 0, 1, 2, 3, 4, 5]; // شنبه تا جمعه
  const g = groupBy(rows, (r) => String(weekdayIndex(r.date)));
  return order
    .map((i) => {
      const row = g.find((x) => x.key === String(i));
      return { ...(row ?? { trades: 0, wins: 0, losses: 0, winRate: 0, netR: 0, pnl: 0 }), key: WEEKDAYS_FA[i] };
    })
    .filter((r) => r.trades > 0);
}

/** وین‌ریت در بلوک‌های N تایی (مثلاً هر ۱۰۰ معامله) */
export function winRateBlocks(rows: TradeRow[], size: number) {
  const n = Math.max(1, Math.floor(size) || 100);
  const out: { block: string; winRate: number; trades: number; netR: number }[] = [];
  for (let i = 0; i < rows.length; i += n) {
    const part = rows.slice(i, i + n);
    const c = counts(part);
    out.push({ block: `${i + 1}–${i + part.length}`, winRate: c.winRate * 100, trades: part.length, netR: c.netR });
  }
  return out;
}

/** وین‌ریت غلتان (میانگین متحرک) */
export function rollingWinRate(rows: TradeRow[], window = 20) {
  const decisive = rows.filter((r) => r.result !== "RF");
  return decisive.map((r, i) => {
    const part = decisive.slice(Math.max(0, i - window + 1), i + 1);
    const w = part.filter((p) => p.result === "TP").length;
    return { index: r.index, winRate: (w / part.length) * 100 };
  });
}

export function rDistribution(rows: TradeRow[]) {
  const map = new Map<number, number>();
  for (const r of rows) {
    const k = Math.round((Number(r.r) || 0) * 2) / 2; // گرد به 0.5
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()].sort(([a], [b]) => a - b).map(([r, count]) => ({ r: `${r > 0 ? "+" : ""}${r}R`, value: r, count }));
}

// ===== قالب‌بندی =====
export const fmtMoney = (n: number, cur = "$") =>
  `${cur}${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const fmtPct = (n: number, digits = 1) => `${n > 0 ? "+" : ""}${n.toFixed(digits)}%`;
export const fmtR = (n: number) => `${n > 0 ? "+" : ""}${Number(n.toFixed(2))}R`;

export function faDate(date: string, opts: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric" }) {
  const [y, m, d] = date.split("-").map(Number);
  try {
    return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { ...opts, timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
  } catch {
    return date;
  }
}

export function faMonth(month: string) {
  return faDate(`${month}-15`, { year: "numeric", month: "long" });
}

export function enMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
