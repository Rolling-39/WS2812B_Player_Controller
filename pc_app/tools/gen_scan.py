"""逐点追踪: LED#0→#63，每帧亮 3 帧 (0.1 秒)"""
import struct

W, H = 8, 8
FPS = 30
FRAMES_PER_POS = 3  # 每个 LED 亮 3 帧

def pack_header(count, fps):
    return (b'W28P' + struct.pack('<H', 1) + struct.pack('<I', count) +
            struct.pack('<H', fps) + struct.pack('BB', W, H) + struct.pack('<H', 0))

with open("E:/AI_Coding_File/WS2812B_Player/firmware/data/video.w28", 'wb') as f:
    total = 64 * FRAMES_PER_POS
    f.write(pack_header(total, FPS))

    for led_idx in range(64):
        raw = bytearray(192)
        # 只亮 LED#led_idx = RED (R=255, G=0, B=0)
        raw[led_idx * 3] = 255
        frame = bytes(raw)

        for _ in range(FRAMES_PER_POS):
            f.write(frame)

size_kb = (16 + total * 192) / 1024
print(f"OK: {total} 帧 ({64} LED x 3), {size_kb:.1f} KB")
print("LED#0亮→LED#1亮→...→LED#63亮, 每颗0.1秒")
