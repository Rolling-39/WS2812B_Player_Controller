# WS2812B Player -- PC 端 UDP 测试发送工具
#
# 用法:
#   python send_test.py single RED 192.168.1.100
#   python send_test.py stream video.mp4 192.168.1.100 30
#
# 模式:
#   single <color> <ip>      -- 发送单帧纯色
#   stream <video> <ip> [fps] -- 发送视频流
#
# 输出: 协议格式 [Magic 2B][Seq 2B][Timestamp 4B][Pixel 192B GRB]

import socket
import struct
import sys
import time
import numpy as np

UDP_PORT = 8888
MAGIC = 0xA55A

# ================================================================
# 垂直 S 形映射
# ================================================================
def apply_vertical_serpentine(frame_8x8):
    """8x8 BGR numpy → 192 字节 GRB，垂直 S 形"""
    result = np.zeros((64, 3), dtype=np.uint8)
    idx = 0
    for col in range(8):
        col_data = frame_8x8[:, col].copy()  # shape (8, 3)
        if col % 2 == 1:
            col_data = col_data[::-1]         # 奇数列翻转
        result[idx:idx+8] = col_data
        idx += 8

    # BGR → GRB
    data = np.zeros(192, dtype=np.uint8)
    for i in range(64):
        b_col = int(result[i, 0])
        g_col = int(result[i, 1])
        r_col = int(result[i, 2])
        data[i*3] = r_col
        data[i*3+1] = g_col
        data[i*3+2] = b_col
    return bytes(data)

# ================================================================
# 打包 UDP 帧
# ================================================================
def pack_frame(pixel_data, seq):
    ts = int(time.time() * 1000) & 0xFFFFFFFF
    header = struct.pack('<HHI', MAGIC, seq & 0xFFFF, ts)
    return header + pixel_data

# ================================================================
# 单帧发送
# ================================================================
def send_single(target_ip, color_name):
    color_map = {
        'RED':   (0, 0, 255),
        'GREEN': (0, 255, 0),
        'BLUE':  (255, 0, 0),
        'WHITE': (255, 255, 255),
        'BLACK': (0, 0, 0),
    }
    color = color_map.get(color_name.upper(), (255, 255, 255))

    # 构造 8x8 纯色帧
    frame = np.zeros((8, 8, 3), dtype=np.uint8)
    frame[:, :] = color

    pixel_data = apply_vertical_serpentine(frame)
    packet = pack_frame(pixel_data, 0)

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.sendto(packet, (target_ip, UDP_PORT))
    sock.close()

    print(f"已发送 {color_name} 帧 → {target_ip}:{UDP_PORT}")

# ================================================================
# 视频流发送
# ================================================================
def send_stream(target_ip, video_path, fps=30):
    try:
        import cv2
    except ImportError:
        print("[错误] 需要 opencv-python: pip install opencv-python")
        return

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"[错误] 无法打开视频: {video_path}")
        return

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    video_fps = cap.get(cv2.CAP_PROP_FPS)
    print(f"视频: {video_path}")
    print(f"帧数: {total_frames}, 原始 FPS: {video_fps:.1f}, 目标 FPS: {fps}")
    print(f"目标: {target_ip}:{UDP_PORT}\n")

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    seq = 0
    frame_interval = 1.0 / fps
    next_send_time = time.time()
    sent_count = 0
    last_report = time.time()
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    while True:
        # 等到预定发送时间
        wait = next_send_time - time.time()
        if wait > 0.002:
            time.sleep(wait)

        # 读一帧
        ret, frame_bgr = cap.read()
        if not ret:
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            time.sleep(0.1)
            continue

        next_send_time += frame_interval
        if next_send_time < time.time():
            next_send_time = time.time() + frame_interval

        # 缩放 + 灰度
        frame_8x8 = cv2.resize(frame_bgr, (8, 8), interpolation=cv2.INTER_AREA)
        gray = cv2.cvtColor(frame_8x8, cv2.COLOR_BGR2GRAY)
        gray3 = np.stack([gray, gray, gray], axis=-1)

        pixel_data = apply_vertical_serpentine(gray3)
        packet = pack_frame(pixel_data, seq)
        sock.sendto(packet, (target_ip, UDP_PORT))

        seq = (seq + 1) & 0xFFFF
        sent_count += 1

        # 每秒报告
        if time.time() - last_report >= 1.0:
            print(f"已发送 {sent_count} 帧 | Seq: {seq}")
            last_report = time.time()

    cap.release()
    sock.close()

# ================================================================
# 主入口
# ================================================================
if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("用法:")
        print("  python send_test.py single <RED|GREEN|BLUE|WHITE> <IP>")
        print("  python send_test.py stream <video_path> <IP> [fps]")
        sys.exit(1)

    mode = sys.argv[1]

    if mode == 'single':
        color = sys.argv[2]
        ip = sys.argv[3]
        send_single(ip, color)
    elif mode == 'stream':
        video = sys.argv[2]
        ip = sys.argv[3]
        fps = int(sys.argv[4]) if len(sys.argv) > 4 else 30
        send_stream(ip, video, fps)
    else:
        print(f"未知模式: {mode}")
        sys.exit(1)
