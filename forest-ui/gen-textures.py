# -*- coding: utf-8 -*-
"""知了森林 · 水彩纹理生成器（纯标准库，零依赖）
生成带「浓淡渐变 + 纸纹颗粒」的水彩色块 PNG，输出到 textures/ 目录。
"""
import zlib, struct, random, os

SIZE = 512

# 需要生成的颜色（base 为 RGB）
COLORS = {
    "green-light": (178, 199, 154),  # 浅绿（高光/远景）
    "green-mid":   (143, 174, 115),  # 中绿（树冠主体）
    "green-dark":  (110, 144, 88),   # 深绿（英雄树阴影）
    "cream":       (246, 238, 220),  # 奶油白（云朵/纸）
    "gold":        (230, 201, 128),  # 金黄（按钮/落叶/阳光）
    "bluegrey":    (157, 188, 199),  # 蓝灰（知了身体）
    "brown":       (169, 138, 104),  # 棕（树干）
}


def write_png(path, w, h, rgba):
    def chunk(typ, data):
        c = struct.pack(">I", len(data)) + typ + data
        c += struct.pack(">I", zlib.crc32(typ + data) & 0xFFFFFFFF)
        return c
    raw = b"".join(b"\x00" + rgba[y * w * 4:(y + 1) * w * 4] for y in range(h))
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)


def make_grid(seed, n):
    rng = random.Random(seed)
    return [[rng.random() for _ in range(n)] for _ in range(n)]


def _smooth(t):
    return t * t * (3 - 2 * t)


def noise_at(grid, n, x, y):
    x = x % n
    y = y % n
    x0 = int(x); y0 = int(y)
    x1 = (x0 + 1) % n; y1 = (y0 + 1) % n
    fx = x - x0; fy = y - y0
    sx = _smooth(fx); sy = _smooth(fy)
    v00 = grid[y0][x0]; v10 = grid[y0][x1]
    v01 = grid[y1][x0]; v11 = grid[y1][x1]
    return (v00 * (1 - sx) + v10 * sx) * (1 - sy) + (v01 * (1 - sx) + v11 * sx) * sy


def _lerp(a, b, t):
    return a + (b - a) * t


def gen_wash(base, seed):
    # 低频值噪声 -> 大面积浓淡色块；高频值噪声 -> 纸纹颗粒
    coarse = make_grid(seed, 26)
    fine = make_grid(seed + 1000, 130)
    light = [_lerp(c, 255, 0.40) for c in base]
    dark = [c * 0.48 for c in base]
    dark[2] *= 1.06  # 阴影略偏冷

    cscale = 26.0 / SIZE
    fscale = 130.0 / SIZE
    rgba = bytearray()
    for py in range(SIZE):
        for px in range(SIZE):
            t = noise_at(coarse, 26, px * cscale, py * cscale)
            g = noise_at(fine, 130, px * fscale, py * fscale)
            r = _lerp(light[0], dark[0], t)
            gr = _lerp(light[1], dark[1], t)
            b = _lerp(light[2], dark[2], t)
            amp = 5 + 20 * t  # 越深颗粒越明显（颜料堆积）
            r += (g - 0.5) * amp
            gr += (g - 0.5) * amp
            b += (g - 0.5) * amp * 0.85
            rgba += bytes((
                max(0, min(255, int(r))),
                max(0, min(255, int(gr))),
                max(0, min(255, int(b))),
                255,
            ))
    return rgba


def main():
    outdir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "textures")
    os.makedirs(outdir, exist_ok=True)
    for i, (name, base) in enumerate(COLORS.items()):
        path = os.path.join(outdir, name + ".png")
        print("生成 %s ..." % name, flush=True)
        write_png(path, SIZE, SIZE, gen_wash(base, seed=7 + i * 131))
        print("   -> %s (%d bytes)" % (path, os.path.getsize(path)), flush=True)
    print("完成，共 %d 张。" % len(COLORS))


if __name__ == "__main__":
    main()
