"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, setPin } from "@/lib/api";
import type { Profile } from "@/lib/types";

export default function Home() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", title: "", initialBalance: "1000", pin: "" });
  const [busy, setBusy] = useState(false);
  const [pinFor, setPinFor] = useState<Profile | null>(null);
  const [pinValue, setPinValue] = useState("");
  const [pinError, setPinError] = useState("");

  useEffect(() => {
    api.listProfiles().then(setProfiles).catch((e) => setError(e.message));
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return setError("نام معامله‌گر را وارد کن");
    setBusy(true);
    setError("");
    try {
      const p = await api.createProfile({
        name: form.name,
        title: form.title,
        pin: form.pin || undefined,
        initialBalance: Number(form.initialBalance) || 1000,
      });
      if (form.pin) setPin(p.id, form.pin);
      router.push(`/journal/${p.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  function open(p: Profile) {
    if (p.hasPin) {
      setPinFor(p);
      setPinValue("");
      setPinError("");
    } else router.push(`/journal/${p.id}`);
  }

  async function submitPin(e: React.FormEvent) {
    e.preventDefault();
    if (!pinFor) return;
    setPin(pinFor.id, pinValue);
    try {
      await api.load(pinFor.id);
      router.push(`/journal/${pinFor.id}`);
    } catch (err) {
      setPin(pinFor.id, null);
      setPinError(err instanceof ApiError && err.needPin ? "رمز اشتباه است" : (err as Error).message);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:py-16">
      <header className="mb-10">
        <p className="mb-2 text-sm text-mute">دفترچه معاملاتی</p>
        <h1 className="text-4xl font-black leading-tight sm:text-5xl">ژورنال معاملاتی</h1>
        <p className="mt-3 max-w-xl text-mute">
          هر روز بگو چند معامله برنامه داری، بعد نتیجه هر معامله (TP، SL یا ریسک‌فری)، ریوارد و استراتژی را ثبت کن. آمار،
          وین‌ریت، مدیریت ریسک و نمودارها خودکار حساب می‌شوند.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section>
          <h2 className="mb-3 text-lg font-bold">ژورنال‌ها</h2>
          {profiles === null && !error && <p className="text-mute">در حال بارگذاری…</p>}
          {profiles?.length === 0 && (
            <div className="card p-6 text-mute">هنوز ژورنالی ساخته نشده. از فرم کناری اولین ژورنال را بساز.</div>
          )}
          <ul className="grid gap-3 sm:grid-cols-2">
            {profiles?.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => open(p)}
                  className="card flex w-full cursor-pointer items-center gap-4 p-4 text-start transition hover:border-ink"
                >
                  <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-hl text-lg font-black text-hl-ink">
                    {p.name.trim().charAt(0) || "?"}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-bold">{p.name}</span>
                    <span className="block truncate text-sm text-mute">
                      {p.title || "ژورنال"} {p.hasPin ? "· رمزدار" : ""}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="card p-5">
          <h2 className="mb-4 text-lg font-bold">ژورنال جدید</h2>
          <form onSubmit={create} className="grid gap-4">
            <div>
              <label className="label" htmlFor="name">نام معامله‌گر</label>
              <input id="name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثلاً علی رضایی" />
            </div>
            <div>
              <label className="label" htmlFor="title">عنوان ژورنال</label>
              <input id="title" className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثلاً بک‌تست ۲۰۲۷ یا حساب واقعی" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="bal">بالانس اولیه ($)</label>
                <input id="bal" className="input num w-full" inputMode="decimal" value={form.initialBalance} onChange={(e) => setForm({ ...form, initialBalance: e.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor="pin">رمز (اختیاری)</label>
                <input id="pin" className="input num w-full" inputMode="numeric" type="password" maxLength={8} value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "") })} placeholder="۴ تا ۸ رقم" />
              </div>
            </div>
            {error && <p className="text-sm text-sl">{error}</p>}
            <button className="btn-primary" disabled={busy}>{busy ? "در حال ساخت…" : "ساخت ژورنال"}</button>
          </form>
        </section>
      </div>

      {pinFor && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setPinFor(null)}>
          <form onSubmit={submitPin} onClick={(e) => e.stopPropagation()} className="card w-full max-w-sm p-5">
            <h3 className="mb-1 font-bold">ورود به ژورنال {pinFor.name}</h3>
            <p className="mb-4 text-sm text-mute">این ژورنال رمز دارد.</p>
            <input autoFocus className="input num w-full" type="password" inputMode="numeric" value={pinValue} onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ""))} />
            {pinError && <p className="mt-2 text-sm text-sl">{pinError}</p>}
            <div className="mt-4 flex gap-2">
              <button className="btn-primary flex-1">ورود</button>
              <button type="button" className="btn-ghost" onClick={() => setPinFor(null)}>انصراف</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
