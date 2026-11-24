"use client";

import type { Journal, Profile } from "./types";

const pinKey = (id: string) => `nt-pin:${id}`;

export function getPin(id: string): string | null {
  try {
    return sessionStorage.getItem(pinKey(id));
  } catch {
    return null;
  }
}

export function setPin(id: string, pin: string | null) {
  try {
    if (pin) sessionStorage.setItem(pinKey(id), pin);
    else sessionStorage.removeItem(pinKey(id));
  } catch {
    /* ignore */
  }
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public needPin = false) {
    super(message);
  }
}

async function req<T>(url: string, init: RequestInit = {}, id?: string): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  const pin = id ? getPin(id) : null;
  if (pin) headers.set("x-pin", pin);
  const res = await fetch(url, { ...init, headers, cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || "خطا در ارتباط با سرور", res.status, Boolean(data.needPin));
  return data as T;
}

export const api = {
  listProfiles: () => req<Profile[]>("/api/profiles"),
  createProfile: (body: { name: string; title?: string; pin?: string; initialBalance?: number }) =>
    req<Profile>("/api/profiles", { method: "POST", body: JSON.stringify(body) }),
  load: (id: string) => req<{ profile: Profile; journal: Journal }>(`/api/profiles/${id}`, {}, id),
  save: (id: string, journal: Journal) =>
    req<{ ok: true; updatedAt: string }>(`/api/profiles/${id}`, { method: "PUT", body: JSON.stringify(journal) }, id),
  updateProfile: (id: string, body: { name?: string; title?: string; pin?: string | null }) =>
    req<Profile>(`/api/profiles/${id}`, { method: "PATCH", body: JSON.stringify(body) }, id),
  deleteProfile: (id: string) => req<{ ok: true }>(`/api/profiles/${id}`, { method: "DELETE" }, id),
};
