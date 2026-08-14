#ifndef HTTP_SERVER_H
#define HTTP_SERVER_H

#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <LittleFS.h>
#include <Preferences.h>
#include "config.h"
#include "storage_player.h"

WebServer server(HTTP_PORT);
Preferences nvs;
static File uploadFile;
static bool uploading = false;

// 亮度——来自 main.cpp
extern int currentBrightness;

// ================================================================
// 上传
// ================================================================
void handleUpload() {
    HTTPUpload &upload = server.upload();
    static size_t totalWritten = 0;
    static File tempFile;

    if (upload.status == UPLOAD_FILE_START) {
        tempFile = LittleFS.open("/upload.tmp", "w");
        totalWritten = 0; uploading = true;
        Serial.println("[HTTP] 上传开始...");
    } else if (upload.status == UPLOAD_FILE_WRITE) {
        if (tempFile) tempFile.write(upload.buf, upload.currentSize);
        totalWritten += upload.currentSize;
    } else if (upload.status == UPLOAD_FILE_END) {
        if (tempFile) { tempFile.close(); uploading = false;
            if (LittleFS.exists(STORAGE_FILE)) LittleFS.remove(STORAGE_FILE);
            LittleFS.rename("/upload.tmp", STORAGE_FILE);
            Serial.printf("[HTTP] 上传完成: %u bytes\n", totalWritten);
            if (storageLoad(STORAGE_FILE)) storageStart();
            server.send(200, "text/plain", "OK");
        }
    } else if (upload.status == UPLOAD_FILE_ABORTED) {
        if (tempFile) tempFile.close();
        LittleFS.remove("/upload.tmp"); uploading = false;
    }
}

// ================================================================
// 控制
// ================================================================
void handlePlay()   { storageStart(); server.send(200, "text/plain", "playing"); }
void handleStop()   { storageStop();  server.send(200, "text/plain", "stopped"); }
void handleDelete() { storageStop(); storageUnload();
    if (LittleFS.exists(STORAGE_FILE)) LittleFS.remove(STORAGE_FILE);
    server.send(200, "text/plain", "deleted"); }

// ================================================================
// 配置 (NVS 持久化)
// ================================================================
void handleConfig() {
    if (server.hasArg("autoplay")) {
        int v = server.arg("autoplay").toInt();
        nvs.putBool("autoplay", v);
        server.send(200, "text/plain", v ? "autoplay=on" : "autoplay=off");
    } else if (server.hasArg("brightness")) {
        currentBrightness = server.arg("brightness").toInt();
        currentBrightness = constrain(currentBrightness, 10, 255);
        FastLED.setBrightness(currentBrightness);
        nvs.putUChar("brightness", currentBrightness);
        server.send(200, "text/plain", "brightness=" + String(currentBrightness));
    } else {
        server.send(400, "text/plain", "use ?autoplay=1 or ?brightness=128");
    }
}

// ================================================================
// 状态
// ================================================================
void handleStatus() {
    String json = "{";
    json += "\"mode\":\"" + String(isStoragePlaying() ? "storage" : "idle") + "\",";
    json += "\"file\":\"" + String(LittleFS.exists(STORAGE_FILE) ? "yes" : "no") + "\",";
    json += "\"autoplay\":" + String(nvs.getBool("autoplay", false) ? "true" : "false") + ",";
    json += "\"brightness\":" + String(currentBrightness) + ",";
    json += "\"fs_total\":" + String(LittleFS.totalBytes()) + ",";
    json += "\"fs_used\":" + String(LittleFS.usedBytes()) + ",";
    json += "\"heap\":" + String(ESP.getFreeHeap()) + ",";
    json += "\"psram\":" + String(ESP.getFreePsram()) + ",";
    json += "\"wifi\":\"" + String(WiFi.status() == WL_CONNECTED ? "connected" : "disconnected") + "\",";
    json += "\"ip\":\"" + WiFi.localIP().toString() + "\"";
    json += "}";
    server.send(200, "application/json", json);
}

void httpServerBegin() {
    server.on("/upload", HTTP_POST, []() {}, handleUpload);
    server.on("/play",   HTTP_GET,  handlePlay);
    server.on("/stop",   HTTP_GET,  handleStop);
    server.on("/delete", HTTP_GET,  handleDelete);
    server.on("/config", HTTP_GET,  handleConfig);
    server.on("/status", HTTP_GET,  handleStatus);
    server.begin();
    Serial.printf("[HTTP] 端口 %d 就绪\n", HTTP_PORT);
}

void httpServerLoop() { server.handleClient(); }

#endif
