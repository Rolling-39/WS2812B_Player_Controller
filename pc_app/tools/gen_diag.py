"""
LED 映射诊断: 逐列点亮, 每列不同颜色
列0=红, 列1=绿, 列2=蓝, 列3=白, 列4=黄, 列5=青, 列6=紫, 列7=橙
观察每列是否完整垂直一条线
"""

import struct, sys

W, H = 8, 8

COLORS = [
    (255,0,0),   # 列0: 红
    (0,255,0),   # 列1: 绿
    (0,0,255),   # 列2: 蓝
    (255,255,255),# 列3: 白
    (255,255,0),  # 列4: 黄
    (0,255,255),  # 列5: 青
    (255,0,255),  # 列6: 紫
    (255,128,0),  # 列7: 橙
]

def pack_header(count, fps):
    return (b'W28P' + struct.pack('<H', 1) + struct.pack('<I', count) +
            struct.pack('<H', fps) + struct.pack('BB', W, H) + struct.pack('<H', 0))

def apply_serpentine(pixels_rgb):
    raw = bytearray(192)
    for col in range(8):
        for row in range(8):
            src_row = (7 - row) if (col % 2 == 1) else row
            r, g, b = pixels_rgb[src_row * 8 + col]
            dst = (col * 8 + row) * 3
            raw[dst] = r; raw[dst+1] = g; raw[dst+2] = b
    return bytes(raw)

def gen_diag(path):
    """逐列不同颜色"""
    pixels = [(0,0,0)] * 64
    for col in range(8):
        r, g, b = COLORS[col]
        for y in range(8):
            pixels[y * 8 + col] = (r, g, b)

    frame = apply_serpentine(pixels)
    with open(path, 'wb') as f:
        f.write(pack_header(90, 30))
        for _ in range(90):
            f.write(frame)
    print(f"OK {path}: 每列不同颜色, 检查每列是否完整垂直")

if __name__ == '__main__':
    path = sys.argv[1] if len(sys.argv) > 1 else "test_data/diag_col.w28"
    gen_diag(path)
