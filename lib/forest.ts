/**
 * 演示数据加载（仅服务端）
 * 数据来源：mock-data/（详见 mock-data/README.md）
 *
 * 注意：本文件使用 node:fs，只能被 Server Component / Route Handler 引入。
 */
import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { ContentItem, ForestSnapshot } from "./contract";
// 用户清单定义在 lib/demo-user.ts（不含 server-only，客户端也要用），这里只做转发
import {
  DEMO_USERS,
  type DemoUserId,
  type DemoUserEntry,
} from "./demo-user";

export { DEMO_USERS };
export type { DemoUserId, DemoUserEntry };

const ROOT = process.cwd();
const MOCK_DIR = path.join(ROOT, "mock-data");

export interface DemoUser {
  userId: string;
  displayName: string;
  nickname: string;
  bio: string;
  tags: string[];
  avatar: string;
  contents: ContentItem[];
}

function readJson<T>(relPath: string): T {
  const full = path.join(MOCK_DIR, relPath);
  return JSON.parse(fs.readFileSync(full, "utf8")) as T;
}

/** 读取某个演示用户的完整档案 + 内容 */
export function loadDemoUser(id: DemoUserId): DemoUser {
  return readJson<DemoUser>(path.join("mock", `${id}.json`));
}

/** 读取预生成森林（演示兜底数据）。
 *
 * 返回 ForestSnapshot：不含 `cicada`——精灵状态不是静态数据，
 * 由 lib/cicada.ts 在请求时推导。 */
export function loadForest(id: DemoUserId): ForestSnapshot {
  return readJson<ForestSnapshot>(path.join("expected-forest", `${id}.json`));
}

/** 读取第 N 天的内容切片（N 从 1 开始，共 30 天） */
export function loadDay(id: DemoUserId, day: number): ContentItem[] {
  const name = `day-${String(day).padStart(2, "0")}.json`;
  const slice = readJson<{ contents: ContentItem[] }>(
    path.join("mock", "days", id, name),
  );
  return slice.contents;
}

/** 累加第 1..day 天的内容（用于「按天回放」演示） */
export function loadUpToDay(id: DemoUserId, day: number): ContentItem[] {
  const out: ContentItem[] = [];
  for (let d = 1; d <= day; d++) out.push(...loadDay(id, d));
  return out;
}

let userIndex: DemoUserEntry[] | null = null;

/**
 * 用户清单，供「切换用户」用。
 * 每读一个用户都要解析 40KB 的正文，所以进程内缓存一份——
 * 这个清单在一次演示里不会变。
 */
export function listDemoUsers(): DemoUserEntry[] {
  if (userIndex) return userIndex;
  userIndex = DEMO_USERS.map((id) => {
    const u = loadDemoUser(id);
    return {
      id,
      nickname: u.nickname,
      displayName: u.displayName,
      avatar: `/avatars/${id}.svg`,
    };
  });
  return userIndex;
}

// 日期换算（dayToDate / dayIndexOf）与统计（replayStats）见 lib/replay.ts，
// 那里是纯函数、客户端也能用，避免两处各写一份日口径。
