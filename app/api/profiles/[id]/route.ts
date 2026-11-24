import { NextResponse } from "next/server";
import { checkPin, deleteProfile, getJournal, getProfile, saveJournal, updateProfile, validId } from "@/lib/store";
import type { Journal } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

async function guard(req: Request, id: string) {
  if (!validId(id)) return NextResponse.json({ error: "شناسه نامعتبر" }, { status: 400 });
  const profile = await getProfile(id);
  if (!profile) return NextResponse.json({ error: "پروفایل پیدا نشد" }, { status: 404 });
  const ok = await checkPin(id, req.headers.get("x-pin"));
  if (!ok) return NextResponse.json({ error: "رمز اشتباه است", needPin: true }, { status: 401 });
  return null;
}

// دریافت پروفایل + ژورنال
export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  const denied = await guard(req, id);
  if (denied) return denied;
  const [profile, journal] = await Promise.all([getProfile(id), getJournal(id)]);
  return NextResponse.json({ profile, journal });
}

// ذخیره کامل ژورنال
export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  const denied = await guard(req, id);
  if (denied) return denied;
  const body = (await req.json().catch(() => null)) as Journal | null;
  if (!body || typeof body !== "object" || !body.settings || typeof body.days !== "object") {
    return NextResponse.json({ error: "داده نامعتبر" }, { status: 400 });
  }
  const saved = await saveJournal(id, body);
  return NextResponse.json({ ok: true, updatedAt: saved.updatedAt });
}

// ویرایش نام / عنوان / رمز
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const denied = await guard(req, id);
  if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as { name?: string; title?: string; pin?: string | null };
  if (typeof body.pin === "string" && body.pin !== "" && !/^\d{4,8}$/.test(body.pin)) {
    return NextResponse.json({ error: "رمز باید ۴ تا ۸ رقم باشد" }, { status: 400 });
  }
  return NextResponse.json(await updateProfile(id, body));
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  const denied = await guard(req, id);
  if (denied) return denied;
  await deleteProfile(id);
  return NextResponse.json({ ok: true });
}
