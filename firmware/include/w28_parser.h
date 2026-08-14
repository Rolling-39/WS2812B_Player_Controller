#ifndef W28_PARSER_H
#define W28_PARSER_H

#include <Arduino.h>
#include <FS.h>
#include <LittleFS.h>

// .w28 文件头 (16 字节)
// Magic(4B) + Version(2B) + FrameCount(4B) + FPS(2B) + Resolution(2B) + Reserved(4B)
#pragma pack(push, 1)
struct W28Header {
    char magic[4];         // "W28P"
    uint16_t version;      // 0x0001
    uint32_t frameCount;   // 总帧数
    uint16_t fps;          // 帧率
    uint8_t  width;        // 分辨率宽 (8)
    uint8_t  height;       // 分辨率高 (8)
    uint32_t reserved;     // 预留
};
#pragma pack(pop)

// 帧数据大小 (每帧 192 字节 = 64 像素 x 3 通道 GRB)
#define W28_FRAME_SIZE  192

// 解析结果
struct W28Info {
    bool valid;
    uint32_t frameCount;
    uint16_t fps;
    uint8_t width;
    uint8_t height;
    size_t dataOffset;     // 帧数据起始偏移 (16)
    size_t totalSize;      // 文件总大小
    size_t dataSize;       // 帧数据区大小
};

// 验证 Magic 并解析文件头
bool w28Parse(File &file, W28Info &info) {
    if (!file || file.size() < 16) {
        return false;
    }

    W28Header header;
    file.seek(0);
    file.read((uint8_t *)&header, 16);

    // Magic 校验
    if (memcmp(header.magic, "W28P", 4) != 0) {
        info.valid = false;
        Serial.println("[W28] Magic 校验失败");
        Serial.printf("      期望: W28P, 实际: %.4s\n", header.magic);
        return false;
    }

    info.valid       = true;
    info.frameCount  = header.frameCount;
    info.fps         = header.fps;
    info.width       = header.width;
    info.height      = header.height;
    info.dataOffset  = 16;
    info.totalSize   = file.size();
    info.dataSize    = header.frameCount * W28_FRAME_SIZE;

    // 校验文件大小
    if (info.totalSize != 16 + info.dataSize) {
        Serial.printf("[W28] 文件大小不匹配: 实际=%u, 期望=%u\n",
            info.totalSize, 16 + info.dataSize);
        // 不视为致命错误，可能是尾部有额外数据
    }

    // 校验分辨率
    if (header.width != 8 || header.height != 8) {
        Serial.printf("[W28] 分辨率不匹配: %ux%u (期望 8x8)\n",
            header.width, header.height);
    }

    return true;
}

// 打印文件信息
void w28PrintInfo(const W28Info &info) {
    if (!info.valid) {
        Serial.println("[W28] 文件无效");
        return;
    }
    uint32_t durationSec = info.frameCount / info.fps;
    Serial.printf("[W28] 帧数: %u, FPS: %u, 时长: %us, 宽: %u, 高: %u\n",
        info.frameCount, info.fps, durationSec, info.width, info.height);
    Serial.printf("      数据区: %u bytes (%.1f KB)\n",
        info.dataSize, info.dataSize / 1024.0);
}

#endif // W28_PARSER_H
