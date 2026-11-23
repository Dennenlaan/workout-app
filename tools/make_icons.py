"""Genereert de PNG-app-iconen (geen dependencies nodig).

Gebruik:  python tools/make_icons.py
Schrijft icons/icon-180.png, icon-192.png en icon-512.png (full-bleed, maskable-safe).
"""
import os
import struct
import zlib

BG = (0xB6, 0x4A, 0x7D)   # roze accent (#b64a7d)
FG = (0xFD, 0xF3, 0xF6)   # zachtroze wit

# Halter in een 512x512 coördinatenstelsel: (x0, y0, x1, y1, radius)
SHAPES = [
    (170, 240, 342, 272, 10),   # stang
    (136, 160, 178, 352, 16),   # binnenste schijf links
    (96, 196, 136, 316, 14),    # buitenste schijf links
    (334, 160, 376, 352, 16),   # binnenste schijf rechts
    (376, 196, 416, 316, 14),   # buitenste schijf rechts
]


def inside(x, y, x0, y0, x1, y1, r):
    if x < x0 or x > x1 or y < y0 or y > y1:
        return False
    cx = min(max(x, x0 + r), x1 - r)
    cy = min(max(y, y0 + r), y1 - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r


def render(size, ss=3):
    scale = size / 512
    rows = []
    for py in range(size):
        row = bytearray([0])
        for px in range(size):
            hits = 0
            for sy in range(ss):
                for sx in range(ss):
                    x = (px + (sx + 0.5) / ss) / scale
                    y = (py + (sy + 0.5) / ss) / scale
                    if any(inside(x, y, *s) for s in SHAPES):
                        hits += 1
            a = hits / (ss * ss)
            row += bytes(round(BG[i] * (1 - a) + FG[i] * a) for i in range(3))
        rows.append(bytes(row))
    return png(size, b"".join(rows))


def png(size, raw):
    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


if __name__ == "__main__":
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "icons")
    os.makedirs(out, exist_ok=True)
    for size in (180, 192, 512):
        with open(os.path.join(out, f"icon-{size}.png"), "wb") as f:
            f.write(render(size))
        print(f"icon-{size}.png")
