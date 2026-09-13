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

/** 用户反馈动作（契约 §2.7） */
export type FeedbackAction = "prune" | "water";

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

/** 知了精灵状态（契约 §3）。行为由数据驱动，前端只做插值与播放。 */
export interface CicadaState {
  action: CicadaAction;
  targetTreeId: string | null;
  line: string;
  updatedAt: string;
}

/**
 * 森林的静态部分：来自 mock-data 的预生成快照，不含精灵状态。
 * 生长、回放、降级生成都只看这一层——它们不该知道精灵的存在。
 */
export interface ForestSnapshot {
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

/** 森林状态 —— 前端渲染的唯一数据源（契约 §3），比快照多一个随请求推导的精灵 */
export interface ForestState extends ForestSnapshot {
  cicada: CicadaState;
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

/** 所有接口的统一响应外壳（契约 §4） */
export interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

interface ReportHighlight {
  treeId: string;
  treeName: string;
  category: TopicCategory;
  summary: string;
  contentIds: string[];
}

/** 光合作用报告（契约 §3 / §5.4） */
export interface PhotosynthesisReport {
  reportId: string;
  userId: string;
  date: string;
  headline: string;
  highlights: ReportHighlight[];
  stats: {
    newLeafCount: number;
    newTreeCount: number;
    totalContentCount: number;
  };
}

/** 农夫日记条目（契约 §3 / §5.3） */
export interface DiaryEntry {
  entryId: string;
  userId: string;
  createdAt: string;
  periodStart: string;
  periodEnd: string;
  eventType: DiaryEventType;
  treeId: string;
  treeName: string;
  leafIds: string[];
  message: string;
  suggestedAction: "water" | "prune" | "none";
}

interface ProfileTrait {
  label: string;
  score: number;
  evidence: string;
}

/** 兴趣画像（契约 §3 / §5.5） */
export interface PersonalityProfile {
  userId: string;
  generatedAt: string;
  soulType: string;
  soulTypeEmoji: string;
  description: string;
  traits: ProfileTrait[];
  topCategories: { category: TopicCategory; weight: number }[];
}

/** 用户反馈信号（契约 §3 / §4） */
export interface FeedbackSignal {
  signalId: string;
  userId: string;
  treeId: string;
  leafId: string;
  action: FeedbackAction;
  createdAt: string;
}

/** POST /api/feedback 的请求体：signalId 与 createdAt 由后端补（契约 §4） */
export type FeedbackRequest = Omit<FeedbackSignal, "signalId" | "createdAt">;

/** POST /api/feedback 返回体：反馈生效后的新状态 */
export interface FeedbackResult {
  forest: ForestState;
  cicada: CicadaState;
  signal: FeedbackSignal;
}
