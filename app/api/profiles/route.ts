import { NextResponse } from "next/server";
import { createProfile, listProfiles } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await listProfiles());
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    title?: string;
    pin?: string;
    initialBalance?: number;
  };
  if (!body.name || !body.name.trim()) {
    return NextResponse.json({ error: "نام معامله‌گر الزامی است" }, { status: 400 });
  }
  if (body.pin && !/^\d{4,8}$/.test(body.pin)) {
    return NextResponse.json({ error: "رمز باید ۴ تا ۸ رقم باشد" }, { status: 400 });
  }
  const p = await createProfile({
    name: body.name,
    title: body.title,
    pin: body.pin || undefined,
    initialBalance: Number(body.initialBalance) || undefined,
  });
  return NextResponse.json(p, { status: 201 });
}
