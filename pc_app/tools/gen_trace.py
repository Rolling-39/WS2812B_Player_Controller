"""
逐点测试: 只亮一个 LED，红色
LED 0 → LED 1 → ... → LED 63
"""

import struct, sys

W, H = 8, 8

def pack_header(count, fps):
    return (b'W28P' + struct.pack('<H', 1) + struct.pack('<I', count) +
            struct.pack('<H', fps) + struct.pack('BB', W, H) + struct.pack('<H', 0))

if len(sys.argv) < 3:
    print("用法: python trace.py <LED编号> <输出.w28>")
    print("示例: python trace.py 0 trace_0.w28")
    sys.exit(1)

n = int(sys.argv[1])
path = sys.argv[2]

raw = bytearray(192)
# LED #n = RED (R=255, B=0, G=0 for GBR)
raw[n*3] = 255    # R

frame = bytes(raw)
with open(path, 'wb') as f:
    f.write(pack_header(30, 30))
    for _ in range(30): f.write(frame)

print(f"OK {path}: LED #{n} = RED")
