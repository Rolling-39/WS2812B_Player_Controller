"""流星雨 — 直接写物理字节，零映射"""
import struct, random, sys, colorsys

W, H = 8, 8

def pack_header(count, fps):
    return (b'W28P' + struct.pack('<H', 1) + struct.pack('<I', count) +
            struct.pack('<H', fps) + struct.pack('BB', W, H) + struct.pack('<H', 0))

# 物理 LED 布局 (垂直S形, 已确认)
# 列0(偶): LED 0-7 in logical order 0→7 (top→bottom)
# 列1(奇): LED 8-15, flipped → physical 8=bottom, 15=top
def logical_to_physical(row, col):
    if col % 2 == 1:
        row = 7 - row
    return col * 8 + row

class Meteor:
    def __init__(self):
        self.col = random.randint(0, 7)
        self.row = random.uniform(-3, 0)
        self.speed = random.uniform(0.2, 0.6)
        self.brightness = random.uniform(0.6, 1.0)
        hue = random.random()
        r, g, b = [int(c * 255) for c in colorsys.hsv_to_rgb(hue, 1.0, 1.0)]
        self.r, self.g, self.b = r, g, b
        self.trail = random.randint(2, 4)

    def update(self):
        self.row += self.speed

    def alive(self):
        return self.row < H + self.trail

def gen(frames, path):
    random.seed(42)
    meteors = []
    spawn_timer = 0

    with open(path, 'wb') as f:
        f.write(pack_header(frames, 30))
        for fi in range(frames):
            spawn_timer -= 1
            if spawn_timer <= 0:
                meteors.append(Meteor())
                spawn_timer = random.randint(3, 8)
            for m in meteors: m.update()
            meteors = [m for m in meteors if m.alive()]

            # 直接写物理字节
            raw = bytearray(192)
            for m in meteors:
                head_row = int(m.row)
                head_col = m.col
                for t in range(m.trail + 1):
                    tr = head_row - t
                    if 0 <= tr < H:
                        phys = logical_to_physical(tr, head_col)
                        fade = (1.0 - t / (m.trail + 1)) * m.brightness
                        # 累加 (多颗流星可能叠加)
                        raw[phys*3]   = min(255, raw[phys*3]   + int(m.r * fade))
                        raw[phys*3+1] = min(255, raw[phys*3+1] + int(m.g * fade))
                        raw[phys*3+2] = min(255, raw[phys*3+2] + int(m.b * fade))

            f.write(bytes(raw))

    size_kb = (16 + frames * 192) / 1024
    print(f"OK {path}: {frames}帧 {frames/30:.0f}s {size_kb:.1f}KB")

if __name__ == '__main__':
    gen(int(sys.argv[1]), sys.argv[2])
