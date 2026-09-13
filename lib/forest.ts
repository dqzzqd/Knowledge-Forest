/**
 * 演示数据加载（仅服务端）
 * 数据来源：mock-data/（详见 mock-data/README.md）
 *
 * 注意：本文件使用 node:fs，只能被 Server Component / Route Handler 引入。
 */
import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { ContentItem, ForestState, TopicTree } from "./contract";

const ROOT = process.cwd();
const MOCK_DIR = path.join(ROOT, "mock-data");

export const DEMO_USERS = ["user-a", "user-b", "user-c"] as const;
export type DemoUserId = (typeof DEMO_USERS)[number];

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

/** 读取预生成森林（演示兜底数据） */
export function loadForest(id: DemoUserId): ForestState {
  return readJson<ForestState>(path.join("expected-forest", `${id}.json`));
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

export const TOTAL_DAYS = 30;

/** 第 N 天对应的日期（2026-08-15 起） */
export function dayToDate(day: number): string {
  const d = new Date(Date.UTC(2026, 7, 15));
  d.setUTCDate(d.getUTCDate() + day - 1);
  return d.toISOString().slice(0, 10);
}

/** 按树聚合叶子，便于渲染 */
export function groupLeaves(forest: ForestState) {
  const byTree = new Map<string, ForestState["leaves"]>();
  for (const leaf of forest.leaves) {
    const list = byTree.get(leaf.treeId) ?? [];
    list.push(leaf);
    byTree.set(leaf.treeId, list);
  }
  return byTree;
}

/** 森林概览统计 */
export function forestStats(forest: ForestState) {
  const totalLeaves = forest.leaves.length;
  const withered = forest.leaves.filter((l) => l.state === "withered").length;
  const fading = forest.leaves.filter((l) => l.state === "fading").length;
  const totalContents = forest.trees.reduce(
    (s: number, t: TopicTree) => s + t.totalContentCount,
    0,
  );
  return { totalLeaves, withered, fading, totalContents, trees: forest.trees.length };
}
