import "server-only";
import { NextResponse } from "next/server";
import type { ApiEnvelope } from "@/lib/contract";
import { DEMO_USERS, type DemoUserId } from "@/lib/forest";

/** 产物是预生成的静态内容，可以放心让 CDN 缓存 */
const CACHE_HEADERS = {
  "cache-control": "public, max-age=300, s-maxage=3600",
} as const;

/** 反馈是写操作，其响应不该被任何中间层缓存 */
const NO_STORE_HEADERS = { "cache-control": "no-store" } as const;

export function ok<T>(
  data: T,
  options: { cache?: boolean } = {},
): NextResponse<ApiEnvelope<T>> {
  return NextResponse.json<ApiEnvelope<T>>(
    { success: true, data, error: null },
    { headers: options.cache === false ? NO_STORE_HEADERS : CACHE_HEADERS },
  );
}

/**
 * 当前时刻，ISO 8601 带 +08:00（契约 §1 要求时间统一 +08:00）。
 *
 * `toISOString()` 给的是 UTC（`Z` 结尾），直接用它会让契约里的时间口径分叉，
 * 所以先整体平移 8 小时再贴标签。
 */
export function nowIso(): string {
  const shifted = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return `${shifted.toISOString().slice(0, 19)}+08:00`;
}

export function fail(message: string, status = 400) {
  return NextResponse.json<ApiEnvelope<never>>(
    { success: false, data: null, error: message },
    { status },
  );
}

/**
 * 解析并校验 userId。演示只有三个固定用户，非法值直接拒绝——
 * 也顺便挡掉把 userId 拼进文件路径的目录穿越。
 */
export function parseUserId(url: URL): DemoUserId | null {
  const raw = url.searchParams.get("userId");
  if (!raw) return DEMO_USERS[0];
  return isDemoUserId(raw) ? raw : null;
}

/** 同一个白名单判定，供 body 里带 userId 的接口（如 /api/feedback）复用 */
export function isDemoUserId(raw: string): raw is DemoUserId {
  return (DEMO_USERS as readonly string[]).includes(raw);
}

/** 解析区间内的整数参数，非法或缺省时返回 fallback */
export function parseIntParam(
  url: URL,
  key: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = url.searchParams.get(key);
  if (raw === null) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) return fallback;
  return n;
}

/** 校验 YYYY-MM-DD；不合法返回 null */
export function parseDateParam(url: URL, key: string): string | null {
  const raw = url.searchParams.get(key);
  if (raw === null) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}
