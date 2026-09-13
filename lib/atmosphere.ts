/**
 * 森林的时段氛围（PRD F12）。
 *
 * 做法是**换光**而不是换画：树的插画不动，只调整天空/林地的配色，
 * 再在整幅画上叠一层半透明色罩。这样无论几点，树都还是那棵树——
 * 直接改插画颜色的话，一到夜里就会糊成一团。
 *
 * 纯函数、由小时数决定，服务端算好再传下来（避免服务端/客户端算出不同的时段）。
 * 天空里的太阳/月亮/云位置**全部写死**，不用随机数——两端必须画出同一片天。
 */

/** 天空装饰：太阳、月亮、云 */
export interface SkyDecor {
  /** 太阳（或夕阳）。x/y 是画面归一化坐标 0–1 */
  sun: { x: number; y: number; r: number; color: string; glow: number } | null;
  /** 月亮 */
  moon: { x: number; y: number; r: number } | null;
  /** 云朵：每条云一组椭圆的位置（归一化），数量固定 */
  clouds: { x: number; y: number; scale: number; opacity: number }[];
  /** 云色 */
  cloudColor: string;
  /** 云底的淡影色：白云垫一层才有厚度，浅色天上也才看得见 */
  cloudShade: string;
  /** 星星数量（0 = 不画） */
  stars: number;
}

export interface Atmosphere {
  /** 时段名，给界面显示 */
  label: string;
  /** 天空渐变：上 → 中 → 下 */
  sky: [string, string, string];
  /** 林地渐变：远 → 近 */
  ground: [string, string];
  /** 环境光（大范围的柔光） */
  light: string;
  lightOpacity: number;
  /** 远山的基准色 */
  hill: string;
  /** 叠在整幅画上的色罩，用来"换光" */
  tint: string;
  tintOpacity: number;
  /** 树名的填充色与描边色：夜里要反过来，否则深字压深底读不出来 */
  labelFill: string;
  labelStroke: string;
  /** 草地的颜色（画草簇用） */
  grass: string;
  decor: SkyDecor;
}

/* 云的几组固定摆位：x 是画面归一化横坐标，y 是装饰带内的 0–1 */
const CLOUD_SPOTS = [
  { x: 0.3, y: 0.18, scale: 1, opacity: 0.9 },
  { x: 0.58, y: 0.62, scale: 0.76, opacity: 0.78 },
  { x: 0.78, y: 0.3, scale: 1.05, opacity: 0.85 },
  { x: 0.44, y: 0.85, scale: 0.66, opacity: 0.7 },
];

const DAY_BASE = {
  label: "上午",
  // 天空给足蓝：太白的话白云画上去等于没画
  sky: ["#AFD4EE", "#D8EAE4", "#EDF5E6"] as [string, string, string],
  ground: ["#D4E4C4", "#B4CE9F"] as [string, string],
  light: "#FFF7DC",
  lightOpacity: 0.85,
  hill: "#9CC0A6",
  tint: "#FFF6DC",
  tintOpacity: 0.04,
  labelFill: "#33472F",
  labelStroke: "#F4F9EE",
  grass: "#8FB07A",
};

const PRESETS: Atmosphere[] = [
  {
    ...DAY_BASE,
    label: "清晨",
    sky: ["#E9CBB6", "#EFE6D6", "#F4F8EE"],
    ground: ["#DCE6CC", "#C0D6AE"],
    light: "#FFD9A8",
    lightOpacity: 0.7,
    tint: "#FFBE8C",
    tintOpacity: 0.1,
    grass: "#96B47F",
    decor: {
      // 低低的朝阳，带一层雾
      sun: { x: 0.3, y: 0.4, r: 34, color: "#FFC978", glow: 1 },
      moon: null,
      clouds: CLOUD_SPOTS.slice(0, 3),
      cloudColor: "#FFF6EC",
      cloudShade: "#CBB6A4",
      stars: 0,
    },
  },
  {
    ...DAY_BASE,
    label: "上午",
    decor: {
      sun: { x: 0.5, y: 0.2, r: 38, color: "#FFD98A", glow: 1 },
      moon: null,
      clouds: CLOUD_SPOTS.slice(0, 3),
      cloudColor: "#FFFFFF",
      cloudShade: "#B9CBDC",
      stars: 0,
    },
  },
  {
    ...DAY_BASE,
    label: "正午",
    sky: ["#9FCDEE", "#CFE7E6", "#EAF4E4"],
    ground: ["#CFE2C0", "#AECB99"],
    light: "#FFFDF0",
    lightOpacity: 0.9,
    tint: "#FFFFF0",
    tintOpacity: 0.03,
    decor: {
      // 正午太阳最靠上
      sun: { x: 0.52, y: 0.06, r: 36, color: "#FFE79B", glow: 1 },
      moon: null,
      clouds: CLOUD_SPOTS.slice(1, 4),
      cloudColor: "#FFFFFF",
      cloudShade: "#BCCFE0",
      stars: 0,
    },
  },
  {
    ...DAY_BASE,
    label: "午后",
    sky: ["#C3D9E6", "#EDE6D4", "#F2F1E4"],
    ground: ["#D3E0C0", "#B1CA9C"],
    light: "#FFE9B8",
    lightOpacity: 0.8,
    tint: "#FFD69A",
    tintOpacity: 0.08,
    decor: {
      sun: { x: 0.66, y: 0.3, r: 36, color: "#FFD07A", glow: 1 },
      moon: null,
      clouds: CLOUD_SPOTS.slice(-3),
      cloudColor: "#FFF8EC",
      cloudShade: "#CFC3AC",
      stars: 0,
    },
  },
  {
    ...DAY_BASE,
    label: "黄昏",
    sky: ["#F4D2AE", "#EFD9C4", "#F3E9DA"],
    ground: ["#DAD8B6", "#B9C5A0"],
    light: "#FFB878",
    lightOpacity: 0.78,
    hill: "#B49E86",
    tint: "#FF965A",
    tintOpacity: 0.16,
    grass: "#A8AC7E",
    decor: {
      // 夕阳：更大、更低、更橘
      sun: { x: 0.34, y: 0.55, r: 50, color: "#FF8A3D", glow: 1 },
      moon: null,
      clouds: [
        { x: 0.5, y: 0.22, scale: 1.1, opacity: 0.85 },
        { x: 0.72, y: 0.6, scale: 0.85, opacity: 0.75 },
      ],
      cloudColor: "#FFD2AE",
      cloudShade: "#C78058",
      stars: 0,
    },
  },
  {
    ...DAY_BASE,
    label: "夜晚",
    sky: ["#31435C", "#3D5070", "#4A5F7A"],
    ground: ["#415647", "#33473C"],
    light: "#DCE6F5",
    lightOpacity: 0.5,
    hill: "#2E4055",
    tint: "#1A2C48",
    tintOpacity: 0.3,
    labelFill: "#EAF2E4",
    labelStroke: "rgba(18, 30, 50, 0.85)",
    grass: "#4E6A52",
    decor: {
      sun: null,
      // 月亮：偏右上，带一圈冷光
      moon: { x: 0.5, y: 0.28, r: 28 },
      clouds: [{ x: 0.32, y: 0.5, scale: 0.9, opacity: 0.3 }],
      cloudColor: "#9FB3CC",
      cloudShade: "#3A4E68",
      stars: 52,
    },
  },
];

/**
 * 小时（0–23）→ 氛围。
 * 清晨 5-7 / 上午 7-11 / 正午 11-15 / 午后 15-18 / 黄昏 18-20 / 夜晚 20-5
 */
export function atmosphereFor(hour: number): Atmosphere {
  if (hour >= 5 && hour < 7) return PRESETS[0];
  if (hour < 11) return PRESETS[1];
  if (hour < 15) return PRESETS[2];
  if (hour < 18) return PRESETS[3];
  if (hour < 20) return PRESETS[4];
  return PRESETS[5];
}

/** 从契约口径的 ISO 串（带 +08:00）里取小时，不做时区换算 */
export function hourFromIso(iso: string): number {
  const h = Number(iso.slice(11, 13));
  return Number.isFinite(h) ? h : 12;
}
