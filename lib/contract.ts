/**
 * 知了森林 · 类型契约
 * 唯一事实来源：docs/接口契约.md
 * 改动类型必须同步改契约文档，并升版本号。
 */

export type ContentSource = "favorite" | "like" | "search";

export type TopicCategory =
  | "tech"
  | "humanities"
  | "business"
  | "science"
  | "life"
  | "arts"
  | "social"
  | "other";

export type TreeStage = "seed" | "sprout" | "young" | "mature" | "flourishing";

export type LeafState = "fresh" | "fading" | "withered";

export type CicadaAction = "idle" | "fly" | "prune" | "water" | "sweep";

export type DiaryEventType = "newTree" | "surge" | "decay" | "revive";

/** 兴趣大类 → 颜色。前后端与设计必须一致。 */
export const CATEGORY_COLORS: Record<TopicCategory, string> = {
  tech: "#4A90D9",
  humanities: "#5BA87A",
  business: "#D9A441",
  science: "#7B68C4",
  life: "#E08A5F",
  arts: "#C96B9B",
  social: "#6BA3B8",
  other: "#9E9E9E",
};

export const CATEGORY_LABELS: Record<TopicCategory, string> = {
  tech: "科技",
  humanities: "人文",
  business: "商业",
  science: "科学",
  life: "生活",
  arts: "艺术",
  social: "社会",
  other: "其它",
};

export interface ContentItem {
  contentId: string;
  title: string;
  excerpt: string | null;
  url: string | null;
  source: ContentSource;
  category: TopicCategory | null;
  voteUpCount: number;
  interactedAt: string;
}

export interface Leaf {
  leafId: string;
  treeId: string;
  name: string;
  summary: string;
  contentIds: string[];
  state: LeafState;
  createdAt: string;
  lastActiveAt: string;
  waterCount: number;
}

export interface TopicTree {
  treeId: string;
  name: string;
  category: TopicCategory;
  stage: TreeStage;
  leafIds: string[];
  totalContentCount: number;
  createdAt: string;
  lastGrownAt: string;
  prunedLeafIds: string[];
}

export interface TreeLayout {
  treeId: string;
  x: number;
  y: number;
  scale: number;
}

export interface ForestState {
  userId: string;
  displayName: string;
  nickname: string;
  bio: string;
  tags: string[];
  avatar: string;
  generatedAt: string;
  trees: TopicTree[];
  leaves: Leaf[];
  layout: TreeLayout[];
}

export const STAGE_LABELS: Record<TreeStage, string> = {
  seed: "种子",
  sprout: "幼苗",
  young: "小树",
  mature: "成树",
  flourishing: "繁茂",
};

export const STATE_LABELS: Record<LeafState, string> = {
  fresh: "新鲜",
  fading: "枯萎中",
  withered: "已枯萎",
};

export const SOURCE_LABELS: Record<ContentSource, string> = {
  favorite: "收藏",
  like: "点赞",
  search: "搜索",
};
