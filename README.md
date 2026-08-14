# WS2812B Player — 8x8 LED 矩阵 WiFi 视频播放器

一个开源的 ESP32-S3 LED 矩阵播放方案：把视频、GIF、像素画变成 8x8 灯板上的流动光影。支持 WiFi 实时推流和 Flash 存储循环播放双模式，配有桌面端控制软件与完整 Python 工具链。

> **立创开源硬件平台**：[oshwhub.com/rolling_39/project_uotswyln](https://oshwhub.com/rolling_39/project_uotswyln) — 电路设计 / 硬件清单 / 打板文件

---

## ⚠️ 重要：硬件差异说明

本项目所有参数均基于**实测的一块 WS2812B 8x8 灯板**调试得出，不同批次、不同厂商、不同型号的灯珠可能存在差异。**如果显示效果与预期不符，先检查以下差异项：**

### 1. 颜色顺序（最常见的坑）

- 本项目测试用的 WS2812B 芯片实际颜色顺序是 **BGR**，固件配置 `COLOR_ORDER=GBR` 后显示正常
- **你的灯珠颜色顺序可能不同**（常见的有 GRB / RGB / BRG 等）
- 判断方法：发纯色测试帧，看实际显示什么颜色

```bash
# 发送红色测试帧，观察灯板显示
py pc_app/tools/send_test.py single RED <ESP32_IP>
```

| 发送 RED 后实际显示 | 你的芯片顺序 | 固件应改 |
|---------------------|-------------|----------|
| 红色（正确） | BGR | 保持 `COLOR_ORDER GBR` |
| 绿色 | BRG | 改 `COLOR_ORDER RBG` |
| 蓝色 | GRB | 改 `COLOR_ORDER RGB` |
| 其他 | 其他 | 测试剩余 3 种组合（共 6 种） |

**修改方法**：编辑 `firmware/include/config.h` 第 12 行：

```c
#define COLOR_ORDER GBR    // 改为上表对应的值
```

改完重新编译烧录即可。其他配置（如 LED 型号 `CHIPSET`）同理，不同芯片要换成对应的型号宏。

### 2. 其他可能有差异的硬件参数

| 参数 | 本项目测试值 | 如果不对改哪里 |
|------|-------------|---------------|
| 芯片型号 | WS2812B（`CHIPSET WS2812B`） | `config.h` 第 15 行，换成你的芯片宏（如 WS2811/APA102） |
| 颜色顺序 | BGR（`COLOR_ORDER GBR`） | `config.h` 第 12 行，见上表 |
| 数据引脚 | GPIO47（`DATA_PIN 47`） | `config.h` 第 5 行，换成实际引脚 |
| LED 数量 | 64（`NUM_LEDS 64`） | `config.h` 第 6 行 |
| 走线方向 | 垂直 S 形蛇形 | 灯板走线不同需改 `w28_parser.h` / 生成器的 serpentine 映射 |

> 快速验证 S 形映射：运行 `py pc_app/tools/gen_scan.py` 生成逐点扫描图，上传后观察 LED 编号是否从 0 到 63 依次点亮。方向不对就反转 serpentine 的奇偶列翻转逻辑。

---

## 目录

- [功能特性](#功能特性)
- [快速开始](#快速开始)
- [桌面端控制软件](#桌面端控制软件)
- [Python 工具链](#python-工具链)
- [W28 文件格式](#w28-文件格式)
- [UDP 推流协议](#udp-推流协议)
- [开发注意事项](#开发注意事项)
- [项目结构](#项目结构)
- [常见问题](#常见问题)

---

## 功能特性

### ESP32 固件

| 特性 | 说明 |
|------|------|
| 双模式播放 | 实时 UDP 推流 + Flash 存储循环播放，自动仲裁切换 |
| 存储模式 | .w28 文件存入 Flash，上电自动播放（无需 WiFi 也能工作） |
| 实时模式 | WiFi UDP 推流，30FPS，5 秒无数据自动切回存储 |
| NVS 持久化 | 亮度、自动播放开关断电记忆 |
| HTTP 控制 | REST API：播放/停止/删除/调亮度/改配置 |
| WiFi 自动重连 | 断线自动 reconnect，状态灯指示 |
| 状态灯 | 连接中蓝闪 / 就绪绿 / 错误红闪 |
| 帧率统计 | 串口实时输出 FPS、丢帧数、内存占用 |
| PSRAM 大容量 | 8MB PSRAM 载入帧数据，30FPS 可存 17 分钟视频 |

### 桌面端控制软件（Tauri 2）

| 功能 | 说明 |
|------|------|
| 8x8 像素预览 | 视频实时降采样为 8x8 像素画面 |
| UDP 实时推流 | 选择视频一键推流到灯板 |
| .w28 导出 | 视频转 .w28（彩色/二值双模式，带进度条） |
| 上传管理 | .w28 上传 ESP32，控制播放/停止/删除/亮度 |
| 像素编辑器 | 8x8 像素画板：预设色板 + RGB 手动输入 |
| 方案管理 | 像素画保存为 .json 方案，可分享导入 |
| 全局配置 | 设置面板统一管理 IP/端口，所有面板自动生效 |
| 调试日志 | 全操作日志 + 浮动 LOG 指示器 |

### Python 工具链

| 工具 | 功能 |
|------|------|
| gif2w28.py | GIF 动画转 .w28（表情/火焰/心跳） |
| gen_w28.py | 视频转 .w28 |
| meteor_gen.py | 流星雨动画程序生成 |
| send_test.py | UDP 帧发送调试 |
| verify_w28.py | .w28 文件校验 |
| gen_scan.py / gen_diag.py / gen_trace.py | 硬件调试诊断图生成 |

---

## 快速开始

### 1. 硬件准备

| 组件 | 规格 | 说明 |
|------|------|------|
| 核心板 | ESP32-S3 DevKitC-1 (N16R8) | 16MB Flash + 8MB PSRAM |
| LED 面板 | 8x8 WS2812B（64 颗，20mm 间距） | 垂直 S 形蛇形走线 |
| 电平转换 | 74HCT125D (SOIC-14) | HCT 系列 VIH=2.0V，TTL 兼容 |
| 串联电阻 | 33Ω 0603 | DATA 输入端 |
| 去耦电容 | 每灯 0.1μF/50V 0603 × 64 | 电源滤波 |
| 电源滤波 | 1000μF/16V 电解 | 板入口 |
| 电源 | 5V/5A 以上 DC 适配器 | DC-005 5.5×2.1mm 母座 |

**接线**：`ESP32 GPIO47 → 33Ω → 74HCT125D → WS2812B DATA`，电源共地，5V 与 GND 走底层铺铜。

> 数据引脚用 **GPIO47**，避开 GPIO48（开发板自带 WS2812B 状态灯）。

### 2. 烧录固件

**前置**：安装 [PlatformIO](https://platformio.org/)（VSCode 扩展或 CLI）。

```bash
# ① 配置 WiFi（必做！）
#    编辑 firmware/include/config.h，填入你的 WiFi 名称和密码
nano firmware/include/config.h

# ② 编译并烧录固件
cd firmware
pio run --target upload --upload-port COM8

# ③ 上传默认播放视频到 Flash（可选，上电自动播放用）
pio run --target uploadfs --upload-port COM8
```

烧录完成 → ESP32 自动连 WiFi → 串口监视器显示分配的 IP：

```bash
pio device monitor
# 输出示例:
# === WS2812B Player V7 ===
# Flash:16MB PSRAM:YES,8MB
# WiFi Rolling OK
# IP 192.168.4.100
```

### 3. 运行桌面端控制软件

**开发模式**（需 Node.js 16+ / Rust）：

```bash
cd ws2812b_desktop
npm install
npx tauri dev
```

**生产模式**：直接用 `npx tauri build` 生成的 `ws2812b-player.exe`（约 6MB，免环境）。

---

## 桌面端控制软件

启动后左侧导航栏 5 个面板。**首次使用先到"设置"填 ESP32 的 IP，全局生效。**

### 实时播放

| 操作 | 说明 |
|------|------|
| 选择视频 | 支持 mp4/avi/mov/mkv |
| 预览 | 视频实时降采样 8x8 像素画面 |
| 播放 | UDP 推流到灯板（FPS 可选 30/15） |
| 停止 | 停止推流，灯板切回存储模式 |

### 导出 .w28

| 选项 | 说明 |
|------|------|
| 模式 | 彩色（保留原色）/ 二值（灰度+黑白阈值，适合剪影动画） |
| FPS | 30 或 15 |
| 进度条 | 读取帧 0-50% + 写入文件 50-100% |

### 上传管理

| 功能 | 说明 |
|------|------|
| 选择 .w28 | 选择本地 w28 文件 |
| 开始上传 | HTTP 上传到 ESP32 Flash |
| 播放 / 停止 / 删除 | ESP32 存储模式控制 |
| 亮度滑块 | 实时调亮度（300ms 节流防抖） |
| 刷新状态 | 查看 ESP32 模式/内存/亮度 |

### 像素编辑

| 功能 | 说明 |
|------|------|
| 8x8 画板 | 点击格子填色，所见即所得 |
| 预设色板 | 红/橙/黄/绿/青/蓝/紫/白/灰/黑 |
| RGB 输入 | 手动指定任意颜色 |
| 临时显示 | UDP 推单帧到灯板 |
| 保存为默认 | 生成 .w28 → 上传 → 设自动播放 |
| 保存/导入方案 | .json 像素方案文件管理 |

### 设置

| 配置 | 说明 |
|------|------|
| ESP32 IP | 全局唯一 IP 源，其他面板自动生效 |
| UDP Port | 实时推流端口（默认 8888） |
| 调试日志 | 全操作记录，自动滚动 + 右下角浮动 LOG 按钮 |

---

## Python 工具链

```bash
pip install -r pc_app/requirements.txt
```

| 命令 | 功能 |
|------|------|
| `py tools/gif2w28.py a.gif b.w28 --fps 30` | GIF → .w28 |
| `py tools/gen_w28.py a.mp4 b.w28 --fps 30` | 视频 → .w28 |
| `py tools/meteor_gen.py 900 out.w28` | 生成 900 帧流星雨 |
| `py tools/send_test.py single RED <IP>` | 发送单色测试帧 |
| `py tools/verify_w28.py a.w28` | 校验 w28 文件 |
| `py tools/gen_scan.py` | 生成逐点扫描诊断图 |

---

## W28 文件格式

```
16 字节文件头:
  Magic    4B  "W28P"
  Version  2B  uint16 (0x0001)
  Frames   4B  uint32 帧数
  FPS      2B  uint16
  W        1B  8
  H        1B  8
  Reserved 2B  uint16 (0=二值, 1=彩色) ⚠️ 必须 uint16，不是 uint32!
帧数据: 帧数 × 192B (64 像素 × 3 通道 RGB)
```

**关键规则**：

- `Reserved` 字段用 `struct.pack('<H', 0)`（2 字节），用 uint32 会整体偏移 2 字节导致颜色错乱
- 帧数必须用**实际读取的帧数**写文件头，不要用 `CAP_PROP_FRAME_COUNT`（视频末尾可能少 1 帧）
- 帧数据按**垂直 S 形蛇形映射**存储（见下），与 PCB 走线一致

### S 形映射

```python
def serpentine(f8):  # f8 是 8x8 numpy 数组
    raw = bytearray(192)
    for col in range(8):
        for row in range(8):
            sr = (7 - row) if (col % 2 == 1) else row  # 奇数列翻转
            r, g, b = f8[sr, col]
            dst = (col * 8 + row) * 3
            raw[dst] = r; raw[dst+1] = g; raw[dst+2] = b
    return bytes(raw)
```

---

## UDP 推流协议

```
┌────────┬────────┬────────────┬──────────────────────┐
│ Magic  │  Seq   │ Timestamp  │    Pixel Data         │
│  2B    │  2B    │    4B      │      192B             │
└────────┴────────┴────────────┴──────────────────────┘
                       总计 = 200 Bytes
```

- Magic: `0xA55A`（小端：`[0x5A, 0xA5]`）
- Pixel Data: 64 像素 × 3 通道 RGB
- 端口: 8888，默认 30 FPS
- 接收端 5 秒无数据自动切回存储模式

---

## 开发注意事项

### 颜色顺序（血泪教训）

- WS2812B 芯片实际颜色顺序是 **BGR**（不是常见的 GRB）
- FastLED 配置 `COLOR_ORDER=GBR`，内部用标准 RGB 数据
- 链路：内部 RGB → FastLED GBR 输出 → LED 芯片 BGR 解码 → 显示正确
- **所有 .w28 生成器输出标准 RGB**，不要预做 GRB/BGR 转换，双次转换会毁掉一切

### 存储播放器

- 用 `vTaskDelete` / `xTaskCreate` 启停任务，**不要用标志位 pause/resume**（有竞态窗口）
- 存储任务栈至少 8192 字节（4096 不够）

### NVS

- `nvs.begin()` 只能在 `setup()` 调一次
- 亮度、自动播放开关都走 NVS 持久化

### 调试方法论

| 步骤 | 测试 | 验证目标 |
|------|------|----------|
| 1 | 全屏纯色 (R/G/B/W) | 颜色顺序 |
| 2 | 逐点扫描 (LED#0→#63) | 物理映射 |
| 3 | 单列下落 | S 形方向 |
| 4 | 纯灰 (R=G=B=128) | 数据管线无偏移 |
| 5 | 二进制画面 | 最终显示效果 |

**原则**：怀疑硬件前先怀疑软件，byte-level 数据 bug 远比信号问题常见。

---

## 项目结构

```
WS2812B_Player/
├── firmware/               # ESP32 固件 (PlatformIO + Arduino)
│   ├── src/main.cpp        # V7: 双模式 + HTTP + NVS + WiFi 重连
│   ├── include/
│   │   ├── config.h        # 引脚/颜色/WiFi 配置（占位符，自行填写）
│   │   ├── w28_parser.h    # .w28 解析器
│   │   ├── storage_player.h # Flash 存储播放器
│   │   └── http_server.h   # HTTP 控制 API
│   ├── partitions.csv      # 分区表 (app 3MB + LittleFS 10MB + NVS)
│   └── platformio.ini      # PlatformIO 配置
├── pc_app/                 # Python 工具链
│   ├── requirements.txt
│   └── tools/              # GIF/视频转 w28、诊断、UDP 测试等 9 个脚本
├── ws2812b_desktop/        # 桌面端 GUI (Tauri 2 + Vite)
│   ├── src/                # 前端 (main.js / polyfill.js / styles.css)
│   └── src-tauri/          # Rust 后端 + 系统集成
├── Exp/knowledge.md        # 开发经验教训
└── README.md
```

---

## 常见问题

**Q: 灯板颜色不对？**
先发纯色测试帧（`send_test.py single RED`）确认颜色顺序；确认 S 形映射方向（`gen_scan.py`）。

**Q: 上传 .w28 后不自动播放？**
检查 config 是否设置了 `autoplay=1`（`curl http://<IP>/config?autoplay=1`）；或改用 `pio run --target uploadfs`。

**Q: 实时推流卡顿？**
确认 WiFi 信号；降低 FPS 到 15；检查 UDP 端口是否被防火墙拦截。

**Q: COM 口被占用？**
关掉 VSCode 串口监视器（底部插头图标）再试。

**Q: PlatformIO safe-delete 错误？**
手动删除 `.pio/build` 目录后重新编译。

**Q: 电源选多大？**
64 颗灯全白峰值 3.84A，推荐 5V/5A；要扩展第二块板用 5V/10A。

---

## License

本项目采用 [MIT License](LICENSE) 开源协议，允许自由使用、修改、商用，仅需保留版权声明。
