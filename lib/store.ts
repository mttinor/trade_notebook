import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { DEFAULT_SETTINGS, emptyJournal, type Journal, type Profile, type StoredProfile } from "./types";

// ذخیره‌سازی ساده روی فایل JSON (بدون نیاز به دیتابیس).
// مسیر را می‌توان با متغیر محیطی DATA_DIR عوض کرد.
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const PROFILES_FILE = path.join(DATA_DIR, "profiles.json");
const JOURNAL_DIR = path.join(DATA_DIR, "journals");

const ID_RE = /^[a-z0-9]{6,32}$/;

async function ensureDirs() {
  await fs.mkdir(JOURNAL_DIR, { recursive: true });
}

async function readJSON<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

// نوشتن اتمیک + صف نوشتن برای جلوگیری از تداخل
const queues = new Map<string, Promise<void>>();
async function writeJSON(file: string, data: unknown) {
  await ensureDirs();
  const prev = queues.get(file) ?? Promise.resolve();
  const next = prev
    .catch(() => undefined)
    .then(async () => {
      const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
      await fs.rename(tmp, file);
    });
  queues.set(file, next);
  return next;
}

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
  return readJSON<StoredProfile[]>(PROFILES_FILE, []);
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
  await writeJSON(PROFILES_FILE, list);
  const j = emptyJournal(id);
  if (input.initialBalance && input.initialBalance > 0) j.settings.initialBalance = input.initialBalance;
  await writeJSON(path.join(JOURNAL_DIR, `${id}.json`), j);
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
  await writeJSON(PROFILES_FILE, list);
  return toPublic(p);
}

export async function deleteProfile(id: string) {
  const list = await allStored();
  await writeJSON(PROFILES_FILE, list.filter((x) => x.id !== id));
  await fs.rm(path.join(JOURNAL_DIR, `${id}.json`), { force: true });
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
  const j = await readJSON<Journal | null>(path.join(JOURNAL_DIR, `${id}.json`), null);
  if (!j) return emptyJournal(id);
  // سازگاری با نسخه‌های قبلی تنظیمات
  j.settings = { ...DEFAULT_SETTINGS, ...j.settings, risk: { ...DEFAULT_SETTINGS.risk, ...(j.settings?.risk ?? {}) } };
  j.days = j.days ?? {};
  return j;
}

export async function saveJournal(id: string, journal: Journal) {
  const clean: Journal = { ...journal, profileId: id, updatedAt: new Date().toISOString() };
  await writeJSON(path.join(JOURNAL_DIR, `${id}.json`), clean);
  return clean;
}
