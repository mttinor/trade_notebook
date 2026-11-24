"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, onlyDigits, setPin } from "@/lib/api";

export default function Home() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", initialBalance: "1000", pin: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return setError("نام را وارد کن");
    if (form.pin.length < 4) return setError("رمز باید ۴ تا ۸ رقم باشد");
    setBusy(true);
    setError("");
    try {
      const p = await api.login({
        name: form.name,
        pin: form.pin,
        initialBalance: Number(onlyDigits(form.initialBalance, 15)) || 1000,
      });
      setPin(p.id, form.pin);
      router.push(`/journal/${p.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto grid min-h-dvh max-w-md place-items-center px-4 py-10">
      <div className="w-full">
        <header className="mb-8 text-center">
          <p className="mb-2 text-sm text-mute">دفترچه معاملاتی</p>
          <h1 className="text-4xl font-black leading-tight">ژورنال معاملاتی</h1>
          <p className="mt-3 text-sm text-mute">
            نام و رمزت را بزن و وارد شو. اگر بار اول است، ژورنالت با همین نام و رمز ساخته می‌شود.
          </p>
        </header>

        <form onSubmit={submit} className="card grid gap-4 p-5">
          <div>
            <label className="label" htmlFor="name">نام</label>
            <input
              id="name"
              className="input w-full"
              autoComplete="username"
              autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="مثلاً علی رضایی"
            />
          </div>
          <div>
            <label className="label" htmlFor="bal">مبلغ اولیه حساب ($)</label>
            <input
              id="bal"
              className="input num w-full"
              inputMode="numeric"
              value={form.initialBalance}
              onChange={(e) => setForm({ ...form, initialBalance: onlyDigits(e.target.value, 15) })}
            />
            <p className="mt-1 text-xs text-mute">فقط برای ژورنال جدید استفاده می‌شود؛ بعداً از تنظیمات قابل تغییر است.</p>
          </div>
          <div>
            <label className="label" htmlFor="pin">رمز</label>
            <input
              id="pin"
              className="input num w-full"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              maxLength={8}
              value={form.pin}
              onChange={(e) => setForm({ ...form, pin: onlyDigits(e.target.value) })}
              placeholder="۴ تا ۸ رقم"
            />
          </div>
          {error && <p className="text-sm text-sl">{error}</p>}
          <button className="btn-primary" disabled={busy}>{busy ? "در حال ورود…" : "ورود"}</button>
        </form>
      </div>
    </main>
  );
}
