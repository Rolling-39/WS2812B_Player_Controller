#ifndef CONFIG_H
#define CONFIG_H

// ESP32-S3 GPIO 引脚定义
#define DATA_PIN        47       // WS2812B 数据线 (不用48，避开板载LED)
#define NUM_LEDS        64       // 8x8 灯板

// 亮度 (0-255)
#define BRIGHTNESS_DEFAULT 128   // 默认 50% 亮度

// LED 颜色顺序
#define COLOR_ORDER GBR    // 试试 GBR

// FastLED 芯片型号
#define CHIPSET         WS2812B

// WiFi 配置 (请填入你自己的 WiFi 信息)
#define WIFI_SSID       "YOUR_WIFI_SSID"
#define WIFI_PASSWORD   "YOUR_WIFI_PASSWORD"

// UDP 配置
#define UDP_PORT        8888
#define HTTP_PORT       80

// 存储配置
#define STORAGE_FILE    "/video.w28"
#define REALTIME_TIMEOUT 5000     // 无 UDP 数据 5 秒后切回存储模式

#endif // CONFIG_H
