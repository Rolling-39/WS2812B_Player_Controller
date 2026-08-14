"""验证诊断文件内容"""
import struct, sys

with open(sys.argv[1], 'rb') as f:
    header = f.read(16)
    magic = header[0:4]
    frame_count = struct.unpack('<I', header[6:10])[0]
    fps = struct.unpack('<H', header[10:12])[0]
    print(f"Magic: {magic}, Frames: {frame_count}, FPS: {fps}")

    # 读第一帧
    data = f.read(192)
    print("\n第一帧原始数据 (前30字节, LED 0-9 的 RGB):")
    for i in range(10):
        r, b_val, g = data[i*3], data[i*3+1], data[i*3+2]
        print(f"  LED#{i}: R={r}, B=B_{b_val}, G={g}")
