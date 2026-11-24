"use client";

import { useEffect, useRef, useState } from "react";
import type { Day, Journal, Profile, Settings } from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/types";
import { api, setPin } from "@/lib/api";
import { downloadBlob, exportExcel, importExcel, toLatinDigits, type ImportResult } from "@/lib/excel";

interface Props {
  journal: Journal;
  profile: Profile;
  update: (fn: (j: Journal) => Journal) => void;
  onProfile: (p: Profile) => void;
  onDeleted: () => void;
}

function NumField({ label, value, onChange, suffix, step = "any" }: { label: string; value: number; onChange: (n: number) => void; suffix?: string; step?: string }) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    if (Number(toLatinDigits(text)) !== value) setText(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <label className="block">
      <span className="label">{label}</span>
      <span className="flex items-center gap-2">
        <input
          className="input num"
          inputMode="decimal"
          step={step}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const n = Number(toLatinDigits(e.target.value));
            if (e.target.value.trim() !== "" && Number.isFinite(n)) onChange(n);
          }}
        />
        {suffix && <span className="shrink-0 text-sm text-mute">{suffix}</span>}
      </span>
    </label>
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="text-lg font-bold">{title}</h2>
      {desc && <p className="mb-4 mt-1 text-sm text-mute">{desc}</p>}
      {!desc && <div className="mb-4" />}
      {children}
    </section>
  );
}

export default function SettingsPanel({ journal, profile, update, onProfile, onDeleted }: Props) {
  const s = journal.settings;
  const setS = (patch: Partial<Settings>) => update((j) => ({ ...j, settings: { ...j.settings, ...patch } }));
  const setRisk = (patch: Partial<Settings["risk"]>) => update((j) => ({ ...j, settings: { ...j.settings, risk: { ...j.settings.risk, ...patch } } }));

  // پروفایل
  const [name, setName] = useState(profile.name);
  const [title, setTitle] = useState(profile.title);
  const [newPin, setNewPin] = useState("");
  const [profileMsg, setProfileMsg] = useState("");
  async function saveProfile(pin?: string | null) {
    setProfileMsg("");
    try {
      const p = await api.updateProfile(profile.id, { name, title, ...(pin !== undefined ? { pin } : {}) });
      if (pin !== undefined) setPin(profile.id, pin || null);
      onProfile(p);
      setNewPin("");
      setProfileMsg("ذخیره شد");
    } catch (e) {
      setProfileMsg((e as Error).message);
    }
  }

  // استراتژی‌ها
  const [strategy, setStrategy] = useState("");
  function addStrategy() {
    const v = strategy.trim();
    if (v && !s.strategies.includes(v)) setS({ strategies: [...s.strategies, v] });
    setStrategy("");
  }

  // ورود اکسل
  const fileRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [importMsg, setImportMsg] = useState("");
  async function onExcel(file?: File) {
    setImportMsg("");
    setPreview(null);
    if (!file) return;
    try {
      const res = await importExcel(file);
      if (!res.trades) setImportMsg("معامله‌ای در فایل پیدا نشد. ستون‌های Date و Trade 1، Trade 2، … لازم است.");
      else setPreview(res);
    } catch (e) {
      setImportMsg("خواندن فایل ممکن نشد: " + (e as Error).message);
    }
    if (fileRef.current) fileRef.current.value = "";
  }
  function applyImport(mode: "merge" | "replace") {
    if (!preview) return;
    update((j) => {
      const days: Record<string, Day> = mode === "replace" ? {} : { ...j.days };
      let skipped = 0;
      for (const [date, d] of Object.entries(preview.days)) {
        if (mode === "merge" && days[date]?.trades.length) {
          skipped++;
          continue;
        }
        days[date] = d;
      }
      const strategies = [...new Set([...j.settings.strategies, ...preview.strategies])];
      setImportMsg(`${preview.trades} معامله وارد شد${skipped ? ` (${skipped} روز تکراری رد شد)` : ""}.`);
      return { ...j, days, settings: { ...j.settings, strategies } };
    });
    setPreview(null);
  }

  // پشتیبان JSON
  function backup() {
    const blob = new Blob([JSON.stringify(journal, null, 2)], { type: "application/json" });
    downloadBlob(blob, `journal-${profile.name}-${new Date().toISOString().slice(0, 10)}.json`);
  }
  async function restore(file?: File) {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text()) as Journal;
      if (!data.days || !data.settings) throw new Error("فرمت فایل درست نیست");
      update((j) => ({ ...j, days: data.days, settings: { ...DEFAULT_SETTINGS, ...data.settings, risk: { ...DEFAULT_SETTINGS.risk, ...data.settings.risk } } }));
      setImportMsg("پشتیبان بازیابی شد.");
    } catch (e) {
      setImportMsg("بازیابی ممکن نشد: " + (e as Error).message);
    }
    if (jsonRef.current) jsonRef.current.value = "";
  }

  // حذف
  const [danger, setDanger] = useState<"" | "clear" | "delete">("");
  const [confirmText, setConfirmText] = useState("");

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Section title="پروفایل معامله‌گر" desc="هر نفر ژورنال خودش را دارد. با رمز، فقط خودت وارد ژورنالت می‌شوی.">
        <div className="grid gap-3">
          <label className="block"><span className="label">نام</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="block"><span className="label">عنوان ژورنال</span><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          <button className="btn-primary justify-self-start" onClick={() => saveProfile()}>ذخیره پروفایل</button>
          <div className="mt-2 border-t border-line pt-4">
            <span className="label">{profile.hasPin ? "تغییر رمز" : "گذاشتن رمز"}</span>
            <div className="flex flex-wrap gap-2">
              <input className="input num w-40" type="password" inputMode="numeric" maxLength={8} placeholder="۴ تا ۸ رقم" value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))} />
              <button className="btn-ghost" disabled={newPin.length < 4} onClick={() => saveProfile(newPin)}>ثبت رمز</button>
              {profile.hasPin && <button className="btn-danger" onClick={() => saveProfile(null)}>برداشتن رمز</button>}
            </div>
          </div>
          {profileMsg && <p className="text-sm text-mute">{profileMsg}</p>}
        </div>
      </Section>

      <Section title="حساب و هدف" desc="بالانس اولیه، واحد پول و هدف ماهانه (مثل Initial Balance و Target در اکسل).">
        <div className="grid grid-cols-2 gap-3">
          <NumField label="بالانس اولیه" value={s.initialBalance} onChange={(n) => n > 0 && setS({ initialBalance: n })} />
          <label className="block"><span className="label">واحد پول</span><input className="input num" value={s.currency} maxLength={4} onChange={(e) => setS({ currency: e.target.value })} /></label>
          <NumField label="هدف ماهانه" value={s.monthlyTargetPct} onChange={(n) => setS({ monthlyTargetPct: n })} suffix="%" />
          <NumField label="سنجش وین‌ریت هر" value={s.winRateBlock} onChange={(n) => n >= 1 && setS({ winRateBlock: Math.round(n) })} suffix="معامله" />
        </div>
      </Section>

      <Section title="مدیریت ریسک" desc="ریسک هر معامله خودکار از روی وضعیت حساب انتخاب می‌شود و سود/ضرر دلاری با آن حساب می‌شود.">
        <div className="grid grid-cols-2 gap-3">
          <NumField label="ریسک عادی (سود کمتر از آستانه)" value={s.risk.base} onChange={(n) => setRisk({ base: n })} suffix="%" />
          <NumField label="آستانه سود" value={s.risk.boostThresholdPct} onChange={(n) => setRisk({ boostThresholdPct: n })} suffix="%" />
          <NumField label="ریسک بعد از عبور از آستانه" value={s.risk.boosted} onChange={(n) => setRisk({ boosted: n })} suffix="%" />
          <NumField label="ریسک در دراوداون" value={s.risk.drawdown} onChange={(n) => setRisk({ drawdown: n })} suffix="%" />
          <NumField label="حد ضرر کامل حساب" value={s.risk.maxDrawdownPct} onChange={(n) => setRisk({ maxDrawdownPct: Math.abs(n) })} suffix="%" />
        </div>
        <p className="mt-4 rounded-xl bg-bg p-3 text-sm leading-7 text-mute">
          سود زیر +{s.risk.boostThresholdPct}% ← ریسک {s.risk.base}% · سود بالای +{s.risk.boostThresholdPct}% ← ریسک {s.risk.boosted}% · زیر بالانس اولیه ← ریسک {s.risk.drawdown}% · ضرر −{s.risk.maxDrawdownPct}% ← توقف معامله
        </p>
      </Section>

      <Section title="استراتژی‌ها" desc="فهرست استراتژی‌هایت برای انتخاب سریع هنگام ثبت معامله.">
        <div className="flex gap-2">
          <input className="input" value={strategy} onChange={(e) => setStrategy(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addStrategy()} placeholder="نام استراتژی" />
          <button className="btn-ghost" onClick={addStrategy}>افزودن</button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {s.strategies.length === 0 && <span className="text-sm text-mute">هنوز استراتژی‌ای اضافه نشده.</span>}
          {s.strategies.map((x) => (
            <span key={x} className="inline-flex items-center gap-1 rounded-lg bg-bg py-1 ps-3 pe-1 text-sm">
              {x}
              <button className="grid size-7 cursor-pointer place-items-center rounded-md text-mute hover:text-sl" aria-label={`حذف ${x}`} onClick={() => setS({ strategies: s.strategies.filter((y) => y !== x) })}>×</button>
            </span>
          ))}
        </div>
      </Section>

      <Section title="ورود و خروج اکسل" desc="فایل بک‌تست با ستون‌های Date، Trade 1..3، استراتژی 1..3 و توضیحات را وارد کن. عدد = ریوارد گرفته‌شده، SL = استاپ، RF = ریسک‌فری.">
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={() => fileRef.current?.click()}>وارد کردن اکسل</button>
          <button className="btn-ghost" onClick={() => exportExcel(journal, `journal-${profile.name}.xlsx`)}>خروجی اکسل</button>
          <button className="btn-ghost" onClick={backup}>پشتیبان JSON</button>
          <button className="btn-ghost" onClick={() => jsonRef.current?.click()}>بازیابی پشتیبان</button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => onExcel(e.target.files?.[0])} />
          <input ref={jsonRef} type="file" accept=".json,application/json" hidden onChange={(e) => restore(e.target.files?.[0])} />
        </div>
        {preview && (
          <div className="mt-4 rounded-xl border border-line p-4">
            <p className="text-sm">
              <b className="num">{preview.trades}</b> معامله در <b className="num">{Object.keys(preview.days).length}</b> روز از شیت‌های{" "}
              <span className="num">{preview.sheets.join("، ")}</span> پیدا شد.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn-primary" onClick={() => applyImport("merge")}>اضافه به ژورنال</button>
              <button className="btn-danger" onClick={() => applyImport("replace")}>جایگزینی کامل</button>
              <button className="btn-ghost" onClick={() => setPreview(null)}>انصراف</button>
            </div>
          </div>
        )}
        {importMsg && <p className="mt-3 text-sm text-mute">{importMsg}</p>}
      </Section>

      <Section title="ناحیه خطر">
        {danger === "" && (
          <div className="flex flex-wrap gap-2">
            <button className="btn-danger" onClick={() => setDanger("clear")}>پاک کردن همه معاملات</button>
            <button className="btn-danger" onClick={() => setDanger("delete")}>حذف کامل ژورنال</button>
          </div>
        )}
        {danger !== "" && (
          <div className="grid gap-3">
            <p className="text-sm">
              {danger === "clear" ? "همه روزها و معاملات این ژورنال پاک می‌شود." : "این ژورنال و همه داده‌هایش برای همیشه حذف می‌شود."} برای تأیید، نام «
              <b>{profile.name}</b>» را بنویس.
            </p>
            <input className="input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
            <div className="flex gap-2">
              <button
                className="btn-danger"
                disabled={confirmText.trim() !== profile.name.trim()}
                onClick={async () => {
                  if (danger === "clear") update((j) => ({ ...j, days: {} }));
                  else {
                    await api.deleteProfile(profile.id);
                    setPin(profile.id, null);
                    onDeleted();
                  }
                  setDanger("");
                  setConfirmText("");
                }}
              >
                تأیید
              </button>
              <button className="btn-ghost" onClick={() => { setDanger(""); setConfirmText(""); }}>انصراف</button>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}
