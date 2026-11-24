"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError, onlyDigits, setPin } from "@/lib/api";
import type { Journal, Profile } from "@/lib/types";
import { buildRows, summarize } from "@/lib/stats";
import Dashboard from "@/components/Dashboard";
import DayEntry from "@/components/DayEntry";
import TradesTable from "@/components/TradesTable";
import MonthlyTable from "@/components/MonthlyTable";
import SettingsPanel from "@/components/SettingsPanel";

const TABS = [
  { id: "today", label: "ثبت روزانه" },
  { id: "dashboard", label: "داشبورد" },
  { id: "trades", label: "معاملات" },
  { id: "monthly", label: "ماهانه" },
  { id: "settings", label: "تنظیمات" },
] as const;
type TabId = (typeof TABS)[number]["id"];

type SaveState = "idle" | "saving" | "saved" | "error";

export default function JournalPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [journal, setJournal] = useState<Journal | null>(null);
  const [error, setError] = useState("");
  const [needPin, setNeedPin] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const [tab, setTab] = useState<TabId>("today");
  const [focusDate, setFocusDate] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const load = useCallback(async () => {
    try {
      const data = await api.load(id);
      setProfile(data.profile);
      setJournal(data.journal);
      setNeedPin(false);
      setError("");
    } catch (e) {
      if (e instanceof ApiError && e.needPin) setNeedPin(true);
      else setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // ذخیره خودکار با تأخیر کوتاه؛ هر بار فقط یک درخواست در جریان است
  const pending = useRef<Journal | null>(null);
  const inFlight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    if (inFlight.current || !pending.current) return;
    const toSave = pending.current;
    pending.current = null;
    inFlight.current = true;
    setSaveState("saving");
    try {
      await api.save(id, toSave);
      setSaveState(pending.current ? "saving" : "saved");
    } catch {
      setSaveState("error");
      pending.current = pending.current ?? toSave;
    } finally {
      inFlight.current = false;
      if (pending.current) timer.current = setTimeout(flush, 1500);
    }
  }, [id]);

  const update = useCallback(
    (fn: (j: Journal) => Journal) => {
      setJournal((prev) => {
        if (!prev) return prev;
        const next = fn(prev);
        pending.current = next;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(flush, 700);
        return next;
      });
    },
    [flush]
  );

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (pending.current || inFlight.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const rows = useMemo(() => (journal ? buildRows(journal) : []), [journal]);
  const summary = useMemo(() => (journal ? summarize(journal, rows) : null), [journal, rows]);

  async function submitPin(e: React.FormEvent) {
    e.preventDefault();
    setPin(id, pinValue);
    await load();
  }

  if (needPin) {
    return (
      <main className="grid min-h-dvh place-items-center p-4">
        <form onSubmit={submitPin} className="card w-full max-w-sm p-5">
          <h1 className="mb-4 font-bold">این ژورنال رمز دارد</h1>
          <input autoFocus className="input num w-full" type="password" inputMode="numeric" value={pinValue} onChange={(e) => setPinValue(onlyDigits(e.target.value))} />
          <div className="mt-4 flex gap-2">
            <button className="btn-primary flex-1">ورود</button>
            <Link href="/" className="btn-ghost">بازگشت</Link>
          </div>
        </form>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-md p-8 text-center">
        <p className="mb-4 text-sl">{error}</p>
        <Link href="/" className="btn-ghost">بازگشت به فهرست ژورنال‌ها</Link>
      </main>
    );
  }

  if (!journal || !profile || !summary) {
    return <main className="p-8 text-center text-mute">در حال بارگذاری ژورنال…</main>;
  }

  const cur = journal.settings.currency;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <Link href="/" className="text-sm text-mute hover:text-ink">ژورنال‌ها</Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-black">{profile.name}</h1>
            <p className="truncate text-xs text-mute">{profile.title || "ژورنال معاملاتی"}</p>
          </div>
          <div className="text-end">
            <div className="num text-lg font-bold">
              {cur}
              {summary.balance.toLocaleString("en-US", { maximumFractionDigits: 2 })}
            </div>
            <div className={`num text-xs ${summary.netPct >= 0 ? "text-tp" : "text-sl"}`}>
              {summary.netPct >= 0 ? "+" : ""}
              {summary.netPct.toFixed(2)}%
            </div>
          </div>
          <span className="w-16 text-xs text-mute" aria-live="polite">
            {saveState === "saving" ? "ذخیره…" : saveState === "saved" ? "ذخیره شد" : saveState === "error" ? <span className="text-sl">خطای ذخیره</span> : ""}
          </span>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`btn shrink-0 ${tab === t.id ? "bg-ink text-bg" : "text-mute hover:text-ink"}`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {tab === "today" && <DayEntry journal={journal} summary={summary} update={update} focusDate={focusDate} />}
        {tab === "dashboard" && <Dashboard journal={journal} rows={rows} summary={summary} />}
        {tab === "trades" && (
          <TradesTable
            journal={journal}
            rows={rows}
            update={update}
            onOpenDay={(d) => {
              setFocusDate(d);
              setTab("today");
            }}
          />
        )}
        {tab === "monthly" && <MonthlyTable journal={journal} rows={rows} />}
        {tab === "settings" && (
          <SettingsPanel
            journal={journal}
            profile={profile}
            update={update}
            onProfile={setProfile}
            onDeleted={() => router.push("/")}
          />
        )}
      </main>
    </div>
  );
}
