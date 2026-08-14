"""
生成边框测试 .w28
点亮最外圈 (白)，内部 (红)，用于验证 LED 映射
"""

import struct, sys

W, H = 8, 8

def pack_header(count, fps):
    return (b'W28P' + struct.pack('<H', 1) + struct.pack('<I', count) +
            struct.pack('<H', fps) + struct.pack('BB', W, H) + struct.pack('<H', 0))

def apply_serpentine(pixels_rgb):
    """输出 RGB 顺序 (FastLED 内部格式)"""
    raw = bytearray(192)
    for col in range(8):
        for row in range(8):
            src_row = (7 - row) if (col % 2 == 1) else row
            r, g, b = pixels_rgb[src_row * 8 + col]
            dst = (col * 8 + row) * 3
            raw[dst] = r; raw[dst+1] = g; raw[dst+2] = b
    return bytes(raw)

# 边框白 + 内部红
pixels = []
for y in range(H):
    for x in range(W):
        if y == 0 or y == 7 or x == 0 or x == 7:
            pixels.append((255, 255, 255))  # WHITE border
        else:
            pixels.append((255, 0, 0))      # RED inside

frame_data = apply_serpentine(pixels)
path = sys.argv[1] if len(sys.argv) > 1 else "test_data/border_test.w28"

with open(path, 'wb') as f:
    f.write(pack_header(60, 30))
    for _ in range(60):
        f.write(frame_data)

print(f"OK {path}: 边框白+内部红, 60帧")
