import { NextResponse } from "next/server";
import { loginOrCreate } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// فهرست ژورنال‌ها عمداً عمومی نیست.
export async function GET() {
  return NextResponse.json({ error: "Not allowed" }, { status: 405 });
}

// ورود با نام + رمز؛ اگر نام جدید باشد ژورنال ساخته می‌شود.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    pin?: string;
    initialBalance?: number;
  };
  if (!body.name || !body.name.trim()) {
    return NextResponse.json({ error: "نام را وارد کن" }, { status: 400 });
  }
  if (!body.pin || !/^\d{4,8}$/.test(body.pin)) {
    return NextResponse.json({ error: "رمز باید ۴ تا ۸ رقم باشد" }, { status: 400 });
  }
  const r = await loginOrCreate({
    name: body.name,
    pin: body.pin,
    initialBalance: Number(body.initialBalance) || undefined,
  });
  if (r.status === "wrong-pin") {
    return NextResponse.json({ error: "نام یا رمز اشتباه است" }, { status: 401 });
  }
  return NextResponse.json({ ...r.profile, created: r.created }, { status: r.created ? 201 : 200 });
}
