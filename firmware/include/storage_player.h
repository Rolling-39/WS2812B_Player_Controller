#ifndef STORAGE_PLAYER_H
#define STORAGE_PLAYER_H

#include <Arduino.h>
#include <LittleFS.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include "config.h"
#include "w28_parser.h"

extern uint8_t backBuffer[192];
extern volatile bool newDataFlag;

// 状态 — 定义在 main.cpp，此处声明
extern uint8_t *psramFrames;
extern uint32_t totalFrames;
extern uint16_t playFps;
extern TaskHandle_t playerTaskHandle;
extern volatile bool storageLoaded;

// 从 LittleFS 加载 .w28 到 PSRAM
bool storageLoad(const char *path) {
    if (!LittleFS.exists(path)) {
        Serial.printf("[存储] 文件不存在: %s\n", path);
        return false;
    }
    File f = LittleFS.open(path, "r");
    W28Info info = {};
    if (!w28Parse(f, info)) { f.close(); return false; }
    w28PrintInfo(info);
    totalFrames = info.frameCount;
    playFps = info.fps;
    size_t dataBytes = totalFrames * W28_FRAME_SIZE;
    if (psramFrames) { free(psramFrames); psramFrames = nullptr; }
    psramFrames = (uint8_t *)ps_malloc(dataBytes);
    if (!psramFrames) { f.close(); return false; }
    f.seek(info.dataOffset);
    size_t read = f.read(psramFrames, dataBytes);
    f.close();
    if (read != dataBytes) { free(psramFrames); psramFrames = nullptr; return false; }
    storageLoaded = true;
    Serial.printf("[存储] 已加载 %u 帧 (%.1f KB)\n", totalFrames, dataBytes/1024.0);
    return true;
}

// 存储播放任务
void storagePlayerTask(void *arg) {
    uint32_t frameDelay = 1000 / playFps;
    uint32_t idx = 0;
    Serial.printf("[存储] 开始播放 FPS=%u\n", playFps);

    while (1) {
        memcpy(backBuffer, psramFrames + idx * W28_FRAME_SIZE, W28_FRAME_SIZE);
        newDataFlag = true;
        idx = (idx + 1) % totalFrames;
        vTaskDelay(pdMS_TO_TICKS(frameDelay));
    }
}

// 播放控制
bool storageStart() {
    if (!storageLoaded) return false;
    if (playerTaskHandle) return true; // 已在运行
    xTaskCreatePinnedToCore(storagePlayerTask, "STO", 8192, NULL, 1, &playerTaskHandle, 0);
    Serial.println(F("[存储] 任务已创建"));
    return true;
}

void storageStop() {
    if (!playerTaskHandle) return;
    vTaskDelete(playerTaskHandle);
    playerTaskHandle = nullptr;
}

void storageUnload() {
    storageStop();
    if (psramFrames) { free(psramFrames); psramFrames = nullptr; }
    storageLoaded = false;
    totalFrames = 0;
}

bool isStoragePlaying() { return playerTaskHandle != nullptr; }
bool isStorageLoaded()  { return storageLoaded; }

#endif // STORAGE_PLAYER_H
