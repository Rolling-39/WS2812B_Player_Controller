"""
gif2w28.py — 把 GIF 转换为 WS2812B Player 的 .w28 视频文件

功能:
  - 逐帧读取 GIF
  - 每帧 resize 到 8x8, 提取 RGB
  - 应用垂直 S 形蛇形映射 (列 0 上→下、列 1 下→上、交替)
  - 写入标准 .w28 格式 (16 字节头 + N 帧 × 192 字节 RGB)

.w28 格式 (16 字节文件头):
  Magic     4B  b'W28P'
  Version   2B  uint16 (1)
  Frames    4B  uint32
  FPS       2B  uint16
  W         1B  uint8 (8)
  H         1B  uint8 (8)
  Reserved  2B  uint16 (0)   ⚠️ 必须是 uint16, 不能用 uint32!
  帧数据:    frames × 192B (64 像素 × 3 字节 RGB)

用法:
  py -3.8 gif2w28.py <input.gif> [output.w28] [--fps N]

依赖:
  Pillow (PIL)
"""

import argparse
import os
import struct
import sys

try:
    from PIL import Image
except ImportError:
    print("错误: 需要 Pillow 库。安装: py -3.8 -m pip install Pillow", file=sys.stderr)
    sys.exit(1)


def pack_header(frame_count: int, fps: int) -> bytes:
    """打包 16 字节 W28 文件头"""
    return (
        b'W28P'
        + struct.pack('<H', 1)              # version
        + struct.pack('<I', frame_count)    # frames
        + struct.pack('<H', fps)            # fps
        + struct.pack('BB', 8, 8)           # W, H
        + struct.pack('<H', 0)              # reserved (uint16!)
    )


def apply_serpentine(pixels_8x8: list) -> bytes:
    """
    应用垂直 S 形蛇形映射, 输出 192 字节 RGB 数据。

    物理走线:
      列 0 (↓): 像素 (0,0)→(1,0)→...→(7,0)   上→下
      列 1 (↑): 像素 (7,1)→(6,1)→...→(0,1)   下→上
      列 2 (↓): 像素 (0,2)→(1,2)→...→(7,2)   上→下
      ...交替

    输入 pixels_8x8: 长度为 64 的 list, 索引为 row*8+col, 元素为 (R, G, B) 元组
    输出: 192 字节, 每 3 字节一组 (R, G, B)
    """
    raw = bytearray(192)
    for col in range(8):
        for row in range(8):
            # 奇数列翻转 (列 1, 3, 5, 7: 从下往上)
            src_row = (7 - row) if (col % 2 == 1) else row
            src_idx = src_row * 8 + col
            r, g, b = pixels_8x8[src_idx]
            dst_idx = (col * 8 + row) * 3
            raw[dst_idx] = r
            raw[dst_idx + 1] = g
            raw[dst_idx + 2] = b
    return bytes(raw)


def gif_to_w28(gif_path: str, out_path: str, fps: int = 30) -> None:
    """
    把 GIF 文件转换为 .w28 视频格式。

    参数:
        gif_path: 输入 GIF 路径
        out_path: 输出 .w28 路径
        fps:      输出帧率 (默认 30)
    """
    if not os.path.exists(gif_path):
        raise FileNotFoundError(f"GIF 文件不存在: {gif_path}")

    img = Image.open(gif_path)

    # 提取所有帧
    frames_rgb = []
    n_frames = 0
    try:
        while True:
            # 转 RGB (RGBA → RGB, P → RGB)
            frame = img.convert('RGB')
            # resize 到 8x8
            frame_8 = frame.resize((8, 8), Image.NEAREST)
            pixels = list(frame_8.getdata())  # 64 × (R, G, B)
            assert len(pixels) == 64, f"帧 {n_frames} 像素数不对: {len(pixels)}"
            frames_rgb.append(pixels)
            n_frames += 1
            img.seek(img.tell() + 1)
    except EOFError:
        pass  # 正常结束

    if n_frames == 0:
        raise RuntimeError(f"GIF 没有帧: {gif_path}")

    # 写入文件 (先读完全部帧, 再用实际帧数写头)
    with open(out_path, 'wb') as f:
        f.write(pack_header(n_frames, fps))
        for pixels in frames_rgb:
            f.write(apply_serpentine(pixels))

    size_kb = (16 + n_frames * 192) / 1024
    print(f"OK {out_path}: {n_frames} 帧, {fps} FPS, {size_kb:.1f} KB")


def main():
    parser = argparse.ArgumentParser(
        description="把 GIF 转换为 WS2812B Player 的 .w28 视频文件"
    )
    parser.add_argument('input', help='输入 GIF 文件路径')
    parser.add_argument(
        'output', nargs='?',
        help='输出 .w28 文件路径 (默认: <input>.w28)'
    )
    parser.add_argument(
        '--fps', type=int, default=30,
        help='输出帧率 (默认 30)'
    )

    args = parser.parse_args()

    gif_path = args.input
    out_path = args.output
    if out_path is None:
        base, _ = os.path.splitext(gif_path)
        out_path = base + '.w28'

    gif_to_w28(gif_path, out_path, fps=args.fps)


if __name__ == '__main__':
    main()