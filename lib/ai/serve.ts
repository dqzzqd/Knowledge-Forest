import "server-only";
import type { PersonalityProfile, PhotosynthesisReport } from "@/lib/contract";
import { loadDemoUser, loadForest, type DemoUserId } from "@/lib/forest";
import { TOTAL_DAYS, dayIndexOf, dayToDate } from "@/lib/replay";
import {
  listReportDates,
  loadDiaryArtifact,
  loadProfileArtifact,
  loadReportArtifact,
} from "./artifacts";
import { fallbackDiary, fallbackProfile, fallbackReport } from "./fallback";
import { withEventDays, type DatedDiaryEntry } from "./timeline";

/**
 * AI 三件套的**唯一解析入口**：路由与页面都走这里，避免两处各写一套
 * 「优先用预生成产物、否则降级」的逻辑而慢慢走偏。
 *
 * 产物是预生成的静态内容（见 mock-data/ai/README.md），所以这里没有 IO 成本。
 */

/**
 * 农夫日记的默认观察窗口。★ 必须与 ai-gen/generate.mjs 的
 * DEFAULT_WINDOW_DAYS 一致，否则命不中产物、会退回规则版。
 */
export const DIARY_WINDOW_DAYS = 21;
const DEFAULT_DIARY_LIMIT = 12;

/**
 * 报告按天取：传 date 取那天，不传则取**最新有产物的一天**（即演示的「今天」）。
 * 没有产物时退回确定性降级版。
 */
export function getReport(
  userId: DemoUserId,
  date?: string,
): PhotosynthesisReport {
  const targetDate = date ?? latestReportDate(userId);
  const artifact = loadReportArtifact(userId, targetDate);
  if (artifact) return artifact;

  const user = loadDemoUser(userId);
  const forest = loadForest(userId);
  return fallbackReport(
    userId,
    user.contents,
    forest,
    dayIndexOf(`${targetDate}T12:00:00+08:00`),
  );
}

/** 最近有模型产物的一天；一份都没有时退回数据最后一天 */
export function latestReportDate(userId: DemoUserId): string {
  const dates = listReportDates(userId);
  return dates.at(-1) ?? dayToDate(TOTAL_DAYS);
}

/** 该用户所有已生成报告的日期（升序），供报告页做按天切换 */
export function availableReportDates(userId: DemoUserId): string[] {
  return listReportDates(userId);
}

/**
 * 返回的条目已**按时间排好序**，并带上 `day`（事件发生在第几天）。
 * 排序与补日期都在这里做，API 与页面共用同一条路径，不会各排各的。
 */
export function getDiary(
  userId: DemoUserId,
  limit: number = DEFAULT_DIARY_LIMIT,
  windowDays: number = DIARY_WINDOW_DAYS,
): DatedDiaryEntry[] {
  const fromDay = TOTAL_DAYS - windowDays + 1;
  const user = loadDemoUser(userId);
  const forest = loadForest(userId);
  const artifact = loadDiaryArtifact(userId);

  const entries =
    artifact && windowDays === DIARY_WINDOW_DAYS
      ? artifact
      : fallbackDiary(userId, user.contents, forest, fromDay, TOTAL_DAYS, limit);

  return withEventDays(entries, user.contents, forest, fromDay, TOTAL_DAYS).slice(
    0,
    limit,
  );
}

export function getProfile(userId: DemoUserId): PersonalityProfile {
  const artifact = loadProfileArtifact(userId);
  if (artifact) return artifact;

  const user = loadDemoUser(userId);
  const forest = loadForest(userId);
  return fallbackProfile(userId, user.contents, forest);
}
