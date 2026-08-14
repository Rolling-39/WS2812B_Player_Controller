"""
原始 LED 测试 — 直接写物理字节，不做任何映射
LED0=红 R, LED1=红 R, ... 全红
"""
import struct, sys

def pack_header(count, fps):
    return (b'W28P' + struct.pack('<H', 1) + struct.pack('<I', count) +
            struct.pack('<H', fps) + struct.pack('BB', 8, 8) + struct.pack('<H', 0))

def gen(name, r, g, b):
    raw = bytearray(192)
    for i in range(64):
        raw[i*3] = r; raw[i*3+1] = g; raw[i*3+2] = b
    frame = bytes(raw)
    path = f"test_data/raw_{name}.w28"
    with open(path, 'wb') as f:
        f.write(pack_header(60, 30))
        for _ in range(60): f.write(frame)
    print(f"{path}: R={r},G={g},B={b}")

if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else "all"
    if mode == "all":
        gen("red",   255, 0,   0)
        gen("green", 0,   255, 0)
        gen("blue",  0,   0,   255)
        gen("white", 255, 255, 255)
        print("生成完成: raw_red/green/blue/white.w28")
    else:
        r = int(sys.argv[2]) if len(sys.argv) > 2 else 255
        g = int(sys.argv[3]) if len(sys.argv) > 3 else 0
        b = int(sys.argv[4]) if len(sys.argv) > 4 else 0
        gen(mode, r, g, b)
