/**
 * 森林的时段氛围（PRD F12）。
 *
 * 做法是**换光**而不是换画：树的插画不动，只调整天空/林地的配色，
 * 再在整幅画上叠一层半透明色罩。这样无论几点，树都还是那棵树——
 * 直接改插画颜色的话，一到夜里就会糊成一团。
 *
 * 纯函数、由小时数决定，服务端算好再传下来（避免服务端/客户端算出不同的时段）。
 */

export interface Atmosphere {
  /** 时段名，给界面显示 */
  label: string;
  /** 天空渐变：上 → 中 → 下 */
  sky: [string, string, string];
  /** 林地渐变：远 → 近 */
  ground: [string, string];
  /** 光源（太阳 / 月亮）的颜色与强度 */
  light: string;
  lightOpacity: number;
  /** 远山的基准色 */
  hill: string;
  /** 叠在整幅画上的色罩，用来"换光" */
  tint: string;
  tintOpacity: number;
  /** 星星显隐（0–1） */
  stars: number;
  /** 树名的填充色与描边色：夜里要反过来，否则深字压深底读不出来 */
  labelFill: string;
  labelStroke: string;
}

const DAY: Atmosphere = {
  label: "上午",
  sky: ["#DCEBF3", "#EFF6EC", "#F6FAF0"],
  ground: ["#DCE8CE", "#BBD3A9"],
  light: "#FFF7DC",
  lightOpacity: 0.85,
  hill: "#A9C9B0",
  tint: "#FFF6DC",
  tintOpacity: 0.05,
  stars: 0,
  labelFill: "#33472F",
  labelStroke: "#F4F9EE",
};

const PRESETS: Atmosphere[] = [
  {
    ...DAY,
    label: "清晨",
    sky: ["#F7E4D2", "#F3F3E6", "#F8FBF2"],
    ground: ["#E2EAD2", "#C6DAB4"],
    light: "#FFD9A8",
    lightOpacity: 0.75,
    tint: "#FFBE8C",
    tintOpacity: 0.13,
  },
  { ...DAY, label: "上午" },
  {
    ...DAY,
    label: "正午",
    sky: ["#D6EAF7", "#EEF7EF", "#F7FBF2"],
    light: "#FFFDF0",
    lightOpacity: 0.9,
    tint: "#FFFFF0",
    tintOpacity: 0.03,
  },
  {
    ...DAY,
    label: "午后",
    sky: ["#E6EDE6", "#F4EFE2", "#F8F7EE"],
    ground: ["#DBE6CA", "#B9D0A6"],
    light: "#FFE9B8",
    lightOpacity: 0.8,
    tint: "#FFD69A",
    tintOpacity: 0.1,
  },
  {
    ...DAY,
    label: "黄昏",
    sky: ["#F4D2AE", "#EFD9C4", "#F3E9DA"],
    ground: ["#DAD8B6", "#B9C5A0"],
    light: "#FFB878",
    lightOpacity: 0.82,
    hill: "#B49E86",
    tint: "#FF965A",
    tintOpacity: 0.19,
  },
  {
    ...DAY,
    label: "夜晚",
    sky: ["#31435C", "#3D5070", "#4A5F7A"],
    ground: ["#415647", "#33473C"],
    light: "#DCE6F5",
    lightOpacity: 0.55,
    hill: "#2E4055",
    tint: "#1A2C48",
    tintOpacity: 0.34,
    stars: 1,
    labelFill: "#EAF2E4",
    labelStroke: "rgba(18, 30, 50, 0.85)",
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
