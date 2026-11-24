import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { DEFAULT_SETTINGS, emptyJournal, type Journal, type Profile, type StoredProfile } from "./types";

// ─────────────────────────────────────────────────────────────
// لایه ذخیره‌سازی
// - اگر متغیرهای Upstash Redis تنظیم شده باشند (مثلاً روی Vercel)،
//   داده‌ها در Redis ذخیره می‌شوند (از طریق REST، بدون پکیج اضافه).
// - در غیر این صورت روی فایل JSON در پوشه DATA_DIR (پیش‌فرض: ./data).
// روی Vercel فایل‌سیستم فقط‌خواندنی و موقت است، پس آنجا حتماً Redis لازم است.
// ─────────────────────────────────────────────────────────────

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const KEY_PREFIX = process.env.STORE_PREFIX || "notebook-trade";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");

// کلیدها با مسیر فایل‌های قبلی یکی هستند: data/profiles.json و data/journals/<id>.json
const PROFILES_KEY = "profiles";
const journalKey = (id: string) => `journals/${id}`;

interface Backend {
  get<T>(key: string, fallback: T): Promise<T>;
  set(key: string, data: unknown): Promise<void>;
  del(key: string): Promise<void>;
}

// ---------- Upstash Redis (REST) ----------
function redisBackend(url: string, token: string): Backend {
  async function cmd(args: string[]) {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as { result?: unknown; error?: string };
    if (!res.ok || json.error) throw new Error(`Redis error: ${json.error ?? res.status}`);
    return json.result;
  }
  const k = (key: string) => `${KEY_PREFIX}:${key}`;
  return {
    async get<T>(key: string, fallback: T) {
      const raw = await cmd(["GET", k(key)]);
      if (typeof raw !== "string") return fallback;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return fallback;
      }
    },
    async set(key, data) {
      await cmd(["SET", k(key), JSON.stringify(data)]);
    },
    async del(key) {
      await cmd(["DEL", k(key)]);
    },
  };
}

// ---------- فایل JSON ----------
function fileBackend(): Backend {
  const fileOf = (key: string) => path.join(DATA_DIR, `${key}.json`);
  const queues = new Map<string, Promise<void>>();
  return {
    async get<T>(key: string, fallback: T) {
      try {
        return JSON.parse(await fs.readFile(fileOf(key), "utf8")) as T;
      } catch {
        return fallback;
      }
    },
    // نوشتن اتمیک + صف نوشتن برای جلوگیری از تداخل
    async set(key, data) {
      const file = fileOf(key);
      const prev = queues.get(file) ?? Promise.resolve();
      const next = prev
        .catch(() => undefined)
        .then(async () => {
          await fs.mkdir(path.dirname(file), { recursive: true });
          const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
          await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
          await fs.rename(tmp, file);
        });
      queues.set(file, next);
      return next;
    },
    async del(key) {
      await fs.rm(fileOf(key), { force: true });
    },
  };
}

function pickBackend(): Backend {
  if (REDIS_URL && REDIS_TOKEN) return redisBackend(REDIS_URL, REDIS_TOKEN);
  if (process.env.VERCEL) {
    throw new Error(
      "روی Vercel امکان ذخیره روی فایل نیست. یک دیتابیس Upstash Redis وصل کنید و " +
        "UPSTASH_REDIS_REST_URL و UPSTASH_REDIS_REST_TOKEN (یا KV_REST_API_URL و KV_REST_API_TOKEN) را تنظیم کنید."
    );
  }
  return fileBackend();
}

let backend: Backend | null = null;
const db = () => (backend ??= pickBackend());

// ─────────────────────────────────────────────────────────────

const ID_RE = /^[a-z0-9]{6,32}$/;

function hashPin(pin: string, salt: string) {
  return crypto.scryptSync(pin, salt, 32).toString("hex");
}

function toPublic(p: StoredProfile): Profile {
  return { id: p.id, name: p.name, title: p.title, createdAt: p.createdAt, hasPin: Boolean(p.pinHash) };
}

export function validId(id: string) {
  return ID_RE.test(id);
}

async function allStored(): Promise<StoredProfile[]> {
  return db().get<StoredProfile[]>(PROFILES_KEY, []);
}

export async function listProfiles(): Promise<Profile[]> {
  return (await allStored()).map(toPublic);
}

export async function getProfile(id: string): Promise<Profile | null> {
  const p = (await allStored()).find((x) => x.id === id);
  return p ? toPublic(p) : null;
}

export async function createProfile(input: { name: string; title?: string; pin?: string; initialBalance?: number }) {
  const list = await allStored();
  const id = crypto.randomBytes(6).toString("hex");
  const p: StoredProfile = {
    id,
    name: input.name.trim().slice(0, 60),
    title: (input.title ?? "").trim().slice(0, 60),
    createdAt: new Date().toISOString(),
  };
  if (input.pin) {
    p.pinSalt = crypto.randomBytes(8).toString("hex");
    p.pinHash = hashPin(input.pin, p.pinSalt);
  }
  list.push(p);
  await db().set(PROFILES_KEY, list);
  const j = emptyJournal(id);
  if (input.initialBalance && input.initialBalance > 0) j.settings.initialBalance = input.initialBalance;
  await db().set(journalKey(id), j);
  return toPublic(p);
}

export async function updateProfile(id: string, patch: { name?: string; title?: string; pin?: string | null }) {
  const list = await allStored();
  const p = list.find((x) => x.id === id);
  if (!p) return null;
  if (typeof patch.name === "string" && patch.name.trim()) p.name = patch.name.trim().slice(0, 60);
  if (typeof patch.title === "string") p.title = patch.title.trim().slice(0, 60);
  if (patch.pin === null || patch.pin === "") {
    delete p.pinHash;
    delete p.pinSalt;
  } else if (typeof patch.pin === "string") {
    p.pinSalt = crypto.randomBytes(8).toString("hex");
    p.pinHash = hashPin(patch.pin, p.pinSalt);
  }
  await db().set(PROFILES_KEY, list);
  return toPublic(p);
}

export async function deleteProfile(id: string) {
  const list = await allStored();
  await db().set(PROFILES_KEY, list.filter((x) => x.id !== id));
  await db().del(journalKey(id));
}

export async function checkPin(id: string, pin: string | null): Promise<boolean> {
  const p = (await allStored()).find((x) => x.id === id);
  if (!p) return false;
  if (!p.pinHash || !p.pinSalt) return true;
  if (!pin) return false;
  const a = Buffer.from(hashPin(pin, p.pinSalt), "hex");
  const b = Buffer.from(p.pinHash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function getJournal(id: string): Promise<Journal> {
  const j = await db().get<Journal | null>(journalKey(id), null);
  if (!j) return emptyJournal(id);
  // سازگاری با نسخه‌های قبلی تنظیمات
  j.settings = { ...DEFAULT_SETTINGS, ...j.settings, risk: { ...DEFAULT_SETTINGS.risk, ...(j.settings?.risk ?? {}) } };
  j.days = j.days ?? {};
  return j;
}

export async function saveJournal(id: string, journal: Journal) {
  const clean: Journal = { ...journal, profileId: id, updatedAt: new Date().toISOString() };
  await db().set(journalKey(id), clean);
  return clean;
}
