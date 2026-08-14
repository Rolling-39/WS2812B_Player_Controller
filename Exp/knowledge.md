WS2812B Player 开发经验教训
================================

1. LED 颜色顺序 (COLOR_ORDER)
--------------------------------
问题：WS2812B 芯片颜色顺序不是常规的 GRB，实际是 BGR。
证据：发送 [R=255, G=0, B=0] → 显示蓝色 → 第一字节控制 B。
测试了全部 6 种顺序才确定。

正确配置：
  config.h: #define COLOR_ORDER GBR
  FastLED 内部用标准 RGB 数据 (leds 数组 .r/.g/.b)。
  FastLED GBR 输出: [G, B, R] 到数据线。
  LED 芯片 (BGR) 将字节解释为: byte0=B, byte1=G, byte2=R。
  最终映射: 内部 RGB → 显示正确。

所有 .w28 文件必须用标准 RGB 格式存储 (R,G,B)，不可做任何预转换。
FastLED 负责硬件层的颜色重映射。

关键：不要自作聪明在生成器里做 GRB/BGR 预转换，双次转换会毁掉一切。


2. S 形蛇形走线映射
--------------------------------
物理 LED 链: 列1(从上到下, LED 0-7) → 列2(从下到上, LED 8-15) → 列3(从上到下, LED 16-23) → ...
0-indexed: col%2==0 不翻, col%2==1 翻 (src_row = 7-row)。

已验证: LED#0=(1,1), LED#7=(1,8), LED#31=(4,1), LED#63=(8,1)。

垂直 S 形的"拐弯"视效是自然的——奇数列物理编号递减(15→8)但物理位置从上到下。


3. 板载 LED 冲突 (GPIO 48)
--------------------------------
ESP32-S3-DevKitC-1 自带的 WS2812B 也接在 GPIO 48 上，是链上第一个 LED。
NUM_LEDS=64 时面板最后一颗灯未控到，整体偏移一位。

解决：改用 GPIO 47 (无板载 LED)。


4. 存储播放器任务管理
--------------------------------
问题：存储任务和 UDP 接收任务同时写 backBuffer，闪烁。
尝试过标志位 pause/resume，仍有极小的竞态窗口。

最终方案：vTaskDelete() 彻底杀死存储任务，xTaskCreate() 重建。
实时模式激活 → storageStop(), 超时恢复 → storageStart()。零竞态。


5. W28 文件格式 —— 头大小 bug ★★★★★
--------------------------------
协议定义: 16 字节头。
  Magic(4) + Version(2) + FrameCount(4) + FPS(2) + W(1) + H(1) + DataOffset(2) = 16 字节。

BUG: Python 生成器用 struct.pack('<I', 0) 写 DataOffset，是 4 字节 uint32 而非 2 字节 uint16。
结果: 头 18 字节，parser 只读 16 字节，多余 2 字节被当成帧数据。

症状: 每帧数据偏移 2 字节 → 二进制黑/白视频的连续白色区域开头变青、结尾变红。
      串口显示"文件大小不匹配: 实际=xxx, 期望=xxx"，差值为 2 字节。

修复: 所有生成器的 struct.pack('<I', 0) 改为 struct.pack('<H', 0)。
影响文件: gen_w28.py, gen_border.py, gen_diag.py, gen_trace.py, gen_scan.py, gen_raw.py, meteor_gen.py。

验证方法: 生成全屏纯灰(R=G=B=128)，所有灯应显示一致的灰色。


6. Bad Apple 视频处理
--------------------------------
问题1: 8x8 极低分辨率下 H.264 色度残差被放大，产生彩色噪点。
解决: 先 cv2.COLOR_BGR2GRAY 再 cv2.resize，单通道处理杜绝色差。

问题2: 即使灰度转换后仍有微量色偏。
解决: cv2.threshold() 二值化 (>128=255, <=128=0)，彻底消灭灰阶。

问题3: 文件头帧数用 cap.get(CAP_PROP_FRAME_COUNT) 不可靠，实际 ret=False 时少读 1 帧。
解决: 先全部读取到内存，用 len(frames) 写文件头。


7. storageLoad 校验
--------------------------------
storageLoad() 读 .w28 文件后校验实际大小: 期望 = 16 + 帧数×192。
如果文件大小 ≠ 期望，返回 false 拒绝播放。
确保文件生成后文件头和内容帧数完全一致。


8. PlatformIO 编译/上传问题
--------------------------------
safe-delete 沙箱错误：pio run 前手动删除 .pio/build 目录。
COM8 被占用：上传前必须关闭 VSCode 串口监视器（点底部插头图标）。
HTTP 上传不稳定 → uploadfs 更可靠。


9. NVS 持久化配置
--------------------------------
亮度: nvs.getUChar("brightness", 128) → HTTP /config?brightness=N
自动播放: nvs.getBool("autoplay", false) → HTTP /config?autoplay=1
nvs.begin() 不能重复调用，setup() 中调一次后 httpServerBegin() 不要再调。


10. 调试方法论
--------------------------------
数据链验证流程:
  1. 全屏纯色测试 (R/G/B/W) → 确认颜色顺序
  2. 逐点扫描测试 (LED#0→LED#63) → 确认物理映射
  3. 单列下落测试 → 确认 S 形方向
  4. 纯灰测试 (R=G=B=128) → 确认数据管线无偏移
  5. 二进制测试 → 确认最终显示效果

当怀疑硬件时先怀疑软件：二进制数据管线的 byte-level bug 远比硬件信号问题常见。
