"""
生成测试 .w28 文件 (纯 Python，无依赖)

用法:
  python gen_w28.py solid RED 100 30 test_mini.w28
  python gen_w28.py rainbow 100 30 test_rainbow.w28
"""

import struct
import sys
import colorsys

def pack_header(frame_count, fps):
    magic = b'W28P'
    version = struct.pack('<H', 1)
    frames = struct.pack('<I', frame_count)
    fps_val = struct.pack('<H', fps)
    res = struct.pack('BB', 8, 8)
    reserved = struct.pack('<H', 0)
    return magic + version + frames + fps_val + res + reserved

def apply_vertical_serpentine(pixels_8x8):
    """
    pixels_8x8: list of 64 tuples (B, G, R)
    返回: 192 字节 GRB，垂直 S 形
    """
    raw = bytearray(192)
    for col in range(8):
        for row in range(8):
            src_row = (7 - row) if (col % 2 == 1) else row
            src_idx = src_row * 8 + col
            b, g, r = pixels_8x8[src_idx]
            dst_idx = (col * 8 + row) * 3
            raw[dst_idx] = r
            raw[dst_idx + 1] = g
            raw[dst_idx + 2] = b
    return bytes(raw)

def gen_solid(color_name, count, fps, out_path):
    colors = {
        'RED':   (0, 0, 255),
        'GREEN': (0, 255, 0),
        'BLUE':  (255, 0, 0),
        'WHITE': (255, 255, 255),
        'BLACK': (0, 0, 0),
    }
    b, g, r = colors.get(color_name.upper(), (255, 255, 255))
    pixels = [(b, g, r)] * 64
    data = apply_vertical_serpentine(pixels)

    with open(out_path, 'wb') as f:
        f.write(pack_header(count, fps))
        for _ in range(count):
            f.write(data)

    size_kb = (16 + count * 192) / 1024
    print(f"OK {out_path}: {count} 帧 {color_name}, {fps} FPS, {size_kb:.1f} KB")

def gen_rainbow(count, fps, out_path):
    with open(out_path, 'wb') as f:
        f.write(pack_header(count, fps))
        for i in range(count):
            hue = i / count
            r, g, b = colorsys.hsv_to_rgb(hue, 1.0, 1.0)
            br, bg, bb = int(b * 255), int(g * 255), int(r * 255)
            pixels = [(bb, bg, br)] * 64
            f.write(apply_vertical_serpentine(pixels))

    size_kb = (16 + count * 192) / 1024
    print(f"OK {out_path}: {count} 帧 彩虹, {fps} FPS, {size_kb:.1f} KB")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("用法:")
        print("  python gen_w28.py solid <COLOR> <count> <fps> <out>")
        print("  python gen_w28.py rainbow <count> <fps> <out>")
        sys.exit(1)

    mode = sys.argv[1]
    if mode == 'solid':
        gen_solid(sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), sys.argv[5])
    elif mode == 'rainbow':
        gen_rainbow(int(sys.argv[2]), int(sys.argv[3]), sys.argv[4])
