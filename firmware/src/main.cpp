/**
 * WS2812B Player V7 — NVS持久化 + WiFi重连 + 状态灯 + HTTP
 */

#include <Arduino.h>
#include <WiFi.h>
#include <FastLED.h>
#include <LittleFS.h>
#include <Preferences.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include "config.h"
#include "w28_parser.h"
#include "storage_player.h"
#include "http_server.h"

CRGB leds[NUM_LEDS];
WiFiUDP udp;
uint8_t backBuffer[192], frontBuffer[192];
volatile bool newDataFlag = false;
volatile uint32_t receivedFrames = 0, droppedFrames = 0;
volatile bool realtimeActive = false;
volatile unsigned long lastUdpTime = 0;

uint8_t *psramFrames = nullptr;
uint32_t totalFrames = 0;
uint16_t playFps = 30;
TaskHandle_t playerTaskHandle = nullptr;
volatile bool storageLoaded = false;

// 亮度——http_server.h 引用
int currentBrightness = BRIGHTNESS_DEFAULT;

// 状态 LED 颜色
enum StatusLED { LED_IDLE, LED_WIFI_CONNECTING, LED_READY, LED_REALTIME, LED_ERROR };
static StatusLED statusLed = LED_WIFI_CONNECTING;

// ================================================================
// 状态指示
// ================================================================
void setStatus(StatusLED s) {
    statusLed = s;
    switch (s) {
        case LED_WIFI_CONNECTING:
            // 蓝色闪烁
            fill_solid(leds, NUM_LEDS, ((millis()/500)%2) ? CRGB(0,0,64) : CRGB::Black);
            break;
        case LED_READY:
            fill_solid(leds, NUM_LEDS, CRGB(0, 64, 0)); // 绿常亮
            break;
        case LED_REALTIME:
            // 实时模式: 不干扰显示，靠 stats 报告模式
            break;
        case LED_ERROR:
            fill_solid(leds, NUM_LEDS, ((millis()/500)%2) ? CRGB(64,0,0) : CRGB::Black); // 红闪
            break;
        default: break;
    }
}

// ================================================================
// WiFi
// ================================================================
void connectWiFi() {
    setStatus(LED_WIFI_CONNECTING); FastLED.show();
    Serial.print(F("WiFi ")); Serial.print(WIFI_SSID);
    WiFi.mode(WIFI_STA); WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    unsigned long s = millis();
    while (WiFi.status() != WL_CONNECTED && millis()-s < 20000) { delay(500); Serial.print(F(".")); }
    bool ok = WiFi.status() == WL_CONNECTED;
    Serial.println(ok ? F(" OK") : F(" FAIL"));
    if (ok) { Serial.print(F("IP ")); Serial.println(WiFi.localIP()); }
    setStatus(ok ? LED_READY : LED_ERROR);
}

// ================================================================
// 任务
// ================================================================
void udpReceiverTask(void *arg) {
    uint8_t rxBuf[200]; uint16_t lastSeq = 0xFFFF;
    vTaskDelay(pdMS_TO_TICKS(1000));
    while (1) {
        int pktSize = udp.parsePacket();
        if (pktSize >= 200) {
            udp.read(rxBuf, 200);
            if ((rxBuf[0]|(rxBuf[1]<<8)) != 0xA55A) continue;
            uint16_t seq = rxBuf[2]|(rxBuf[3]<<8);
            if (receivedFrames>0 && (uint16_t)(seq-lastSeq)>1)
                droppedFrames += (uint16_t)(seq-lastSeq)-1;
            lastSeq = seq;
            memcpy(backBuffer, rxBuf+8, 192);
            receivedFrames++; newDataFlag = true;
            lastUdpTime = millis();
            if (!realtimeActive) { realtimeActive = true; storageStop(); }
        } else if (pktSize > 0) { while (udp.available()) udp.read(); }
        else { vTaskDelay(pdMS_TO_TICKS(1)); }
    }
}

void ledRefreshTask(void *arg) {
    while (1) {
        if (newDataFlag) { memcpy(frontBuffer,backBuffer,192); newDataFlag=false;
            memcpy(leds,frontBuffer,NUM_LEDS*3); FastLED.show(); }
        else if (statusLed == LED_WIFI_CONNECTING || statusLed == LED_ERROR) {
            setStatus(statusLed); FastLED.show(); // 刷新状态灯
        }
        vTaskDelay(pdMS_TO_TICKS(2));
    }
}

void statsTask(void *arg) {
    uint32_t lr=0,ld=0;
    while (1) { vTaskDelay(pdMS_TO_TICKS(1000));
        uint32_t fps=receivedFrames-lr, drops=droppedFrames-ld;
        lr=receivedFrames; ld=droppedFrames;
        const char *m = realtimeActive?"RT":(playerTaskHandle?"STOR":"IDLE");
        bool wifi = WiFi.status()==WL_CONNECTED;
        Serial.printf("FPS:%u丢:%u %s %s H:%u P:%u B:%u\n",
            fps,drops,m,wifi?"WIFI":"OFF",ESP.getFreeHeap(),ESP.getFreePsram(),currentBrightness);
    }
}

// ================================================================
// 初始化
// ================================================================
void setup() {
    Serial.begin(115200); delay(500);
    Serial.println(F("\n=== WS2812B Player V7 ==="));
    Serial.printf("Flash:%uMB PSRAM:%s,%uMB\n",ESP.getFlashChipSize()/(1024*1024),
        psramFound()?"YES":"NO",psramFound()?ESP.getPsramSize()/(1024*1024):0);

    FastLED.addLeds<CHIPSET,DATA_PIN,COLOR_ORDER>(leds,NUM_LEDS);

    // 读取 NVS 配置
    nvs.begin("ws2812b", false);
    currentBrightness = nvs.getUChar("brightness", BRIGHTNESS_DEFAULT);
    bool autoplay = nvs.getBool("autoplay", false);
    FastLED.setBrightness(currentBrightness);
    FastLED.clear(); FastLED.show();

    // 文件系统
    Serial.print(F("FS: "));
    if (LittleFS.begin(true)) { // true: mount fails 时格式化
        Serial.printf("OK,%uKB\n",LittleFS.totalBytes()/1024);
        if (LittleFS.exists(STORAGE_FILE)) {
            Serial.println(F("[存储] 发现文件，加载..."));
            if (storageLoad(STORAGE_FILE)) {
                Serial.printf("[存储] autoplay=%d, calling storageStart\n", autoplay);
                if (autoplay) { storageStart(); }
                Serial.println(F("[存储] storageStart returned"));
            }
        }
    } else Serial.println(F("FAIL"));

    connectWiFi();
    if (WiFi.status()==WL_CONNECTED) {
        udp.begin(UDP_PORT);
        httpServerBegin();
    }

    xTaskCreatePinnedToCore(udpReceiverTask,"UDP",4096,NULL,2,NULL,0);
    xTaskCreatePinnedToCore(ledRefreshTask,"LED",2048,NULL,1,NULL,1);
    xTaskCreatePinnedToCore(statsTask,"STAT",2048,NULL,0,NULL,1);

    Serial.printf("亮度:%d autoplay:%d\n", currentBrightness, autoplay);
}

void loop() {
    httpServerLoop();
    static unsigned long lastCheck = 0;
    if (millis() - lastCheck > 5000) { lastCheck = millis();
        if (WiFi.status() != WL_CONNECTED) { WiFi.reconnect(); setStatus(LED_ERROR); }
        else if (statusLed == LED_ERROR) setStatus(LED_READY);
        if (realtimeActive && millis()-lastUdpTime > REALTIME_TIMEOUT) {
            realtimeActive = false;
            if (storageLoaded) { storageStart(); Serial.println(F("[仲裁] restor")); }
        }
    }
}
