// ===== مدل داده ژورنال معاملاتی =====

/** نتیجه معامله: TP = سود (تیک‌پروفیت)، SL = استاپ‌لاس، RF = ریسک‌فری (سربه‌سر) */
export type TradeResult = "TP" | "SL" | "RF";

export type TradeSide = "buy" | "sell" | "";

export interface Trade {
  id: string;
  result: TradeResult;
  /**
   * ریوارد گرفته‌شده بر حسب R (علامت‌دار):
   * TP → مثبت (مثلاً 3 یعنی 3 برابر ریسک)، SL → منفی (پیش‌فرض -1)، RF → صفر
   */
  r: number;
  strategy: string;
  symbol: string;
  side: TradeSide;
  note: string;
}

export interface Day {
  date: string; // YYYY-MM-DD (میلادی)
  planned: number; // تعداد معاملاتی که اول روز برنامه‌ریزی شد
  note: string;
  trades: Trade[];
}

export interface RiskRules {
  /** ریسک هر معامله وقتی سود کل کمتر از آستانه است (%) */
  base: number;
  /** ریسک هر معامله وقتی سود کل از آستانه بیشتر شد (%) */
  boosted: number;
  /** آستانه سود برای افزایش ریسک (%) */
  boostThresholdPct: number;
  /** ریسک هر معامله وقتی حساب زیر بالانس اولیه است (دراوداون) (%) */
  drawdown: number;
  /** حد ضرر کامل حساب (%) — بعد از آن معامله متوقف می‌شود */
  maxDrawdownPct: number;
}

export interface Settings {
  initialBalance: number;
  /** هدف ماهانه (% از بالانس ابتدای ماه) */
  monthlyTargetPct: number;
  /** هر چند معامله یک‌بار وین‌ریت سنجیده شود */
  winRateBlock: number;
  risk: RiskRules;
  strategies: string[];
  currency: string;
}

export interface Journal {
  profileId: string;
  settings: Settings;
  days: Record<string, Day>;
  updatedAt: string;
}

export interface Profile {
  id: string;
  name: string;
  title: string; // مثلاً «بک‌تست ۲۰۲۷» یا «حساب واقعی»
  hasPin: boolean;
  createdAt: string;
}

export interface StoredProfile extends Omit<Profile, "hasPin"> {
  pinHash?: string;
  pinSalt?: string;
}

export const DEFAULT_SETTINGS: Settings = {
  initialBalance: 1000,
  monthlyTargetPct: 10,
  winRateBlock: 100,
  risk: {
    base: 1,
    boosted: 1.5,
    boostThresholdPct: 2,
    drawdown: 0.5,
    maxDrawdownPct: 10,
  },
  strategies: [],
  currency: "$",
};

export function emptyJournal(profileId: string): Journal {
  return {
    profileId,
    settings: structuredClone(DEFAULT_SETTINGS),
    days: {},
    updatedAt: new Date().toISOString(),
  };
}

export function newTrade(partial: Partial<Trade> = {}): Trade {
  return {
    id: Math.random().toString(36).slice(2, 10) + Date.now().toString(36),
    result: "TP",
    r: 2,
    strategy: "",
    symbol: "",
    side: "",
    note: "",
    ...partial,
  };
}
