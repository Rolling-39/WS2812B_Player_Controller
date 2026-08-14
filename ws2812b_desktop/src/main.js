import { invoke, open, save, listen, minimize, toggleMaximize, closeWindow } from './polyfill.js';

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('tbMin').addEventListener('click', function() { minimize(); });
    document.getElementById('tbMax').addEventListener('click', function() { toggleMaximize(); });
    document.getElementById('tbClose').addEventListener('click', function() { closeWindow(); });
});

// ── Sidebar ──
document.getElementById('sidebarNav').addEventListener('click', function(e) {
    var btn = e.target.closest('.nav-item');
    if (!btn) return;
    document.querySelectorAll('.nav-item').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    showPanel(btn.dataset.panel);
});

function showPanel(name) {
    document.querySelectorAll('.panel').forEach(function(p) { p.style.display = 'none'; });
    var panel = document.getElementById('panel-' + name);
    if (panel) panel.style.display = 'flex';
}

function snack(msg, dur) { dur = dur || 2500; var el = document.querySelector('.snackbar'); if (el) el.remove(); el = document.createElement('div'); el.className = 'snackbar'; el.textContent = msg; document.body.appendChild(el); setTimeout(function() { el.remove(); }, dur); }
function $(id) { return document.getElementById(id); }

// ── Logger ──
var _logLines = [], _logFloater = null;
function log(msg) {
    var ts = new Date().toLocaleTimeString();
    var line = '[' + ts + '] ' + msg;
    _logLines.push(line);
    if (_logLines.length > 500) _logLines.shift();
    var el = $('logArea');
    if (el) { el.textContent = _logLines.join('\n'); el.scrollTop = el.scrollHeight; }
    if (!_logFloater) _logFloater = $('logFloater');
    if (_logFloater) { _logFloater.textContent = _logLines.length; _logFloater.classList.add('has-new'); setTimeout(function() { _logFloater.classList.remove('has-new'); }, 500); }
    console.log(line);
}

// ═══════════════════════════════════════
//  BUILD UI
// ═══════════════════════════════════════

var content = document.getElementById('content');
content.innerHTML = '';

// Panel: realtime
var p = document.createElement('div'); p.className = 'panel'; p.id = 'panel-realtime'; p.style.display = 'flex';
var card1 = document.createElement('div'); card1.className = 'card';
card1.innerHTML = '<div class="card-header">实时播放</div><div class="card-row"><button class="btn btn-outline" id="pickVideo">选择视频</button><span class="label" id="videoLabel" style="display:none"></span></div><div class="card-row" style="margin-top:8px"><label>FPS</label><select class="input" id="fpsSel" style="width:60px"><option value="30">30</option><option value="15">15</option></select><span class="label" style="margin-left:auto;color:var(--on-surface-variant);font-size:11px">IP/端口请在设置中配置</span></div>';
var card2 = document.createElement('div'); card2.className = 'card';
card2.innerHTML = '<div class="card-header">8x8 像素预览</div><canvas id="previewCanvas" width="256" height="256" style="width:256px;height:256px;border-radius:8px;background:#111"></canvas><div class="label" id="frameInfo" style="margin-top:4px">未选择视频</div>';
var btnRow = document.createElement('div'); btnRow.className = 'btn-row';
btnRow.innerHTML = '<button class="btn btn-outline" id="previewBtn" disabled>预览</button><button class="btn btn-primary" id="playBtn" disabled>播放</button><button class="btn btn-outline" id="stopBtn" disabled>停止</button>';
p.appendChild(card1); p.appendChild(card2); p.appendChild(btnRow); content.appendChild(p);

// Hidden canvas for 8x8 sampling
var sampleCanvas = document.createElement('canvas'); sampleCanvas.width = 8; sampleCanvas.height = 8; sampleCanvas.style.display = 'none';
document.body.appendChild(sampleCanvas);

// Panel: export
p = document.createElement('div'); p.className = 'panel'; p.id = 'panel-export'; p.style.display = 'none';
p.innerHTML = '<div class="card"><div class="card-header">导出 .w28 文件</div><div class="card-row"><button class="btn btn-outline" id="exportPickVideo">选择视频</button><span class="label" id="exportVideoLabel" style="display:none"></span></div><div class="card-row" style="gap:12px;margin-top:8px"><label>FPS</label><select class="input" id="exportFps" style="width:60px"><option value="30" selected>30</option><option value="15">15</option></select><label>模式</label><select class="input" id="exportMode" style="width:70px"><option value="color" selected>彩色</option><option value="binary">二值</option></select><label>输出</label><button class="btn btn-outline" id="exportPickOut">选择输出路径</button><span class="label" id="exportOutLabel" style="display:none"></span></div></div><div class="btn-row"><button class="btn btn-primary" id="exportBtn">开始导出</button></div><div id="exportProgress" style="display:none"><div class="progress-bar"><div class="progress-fill" id="exportFill" style="width:0%"></div></div><div class="label" id="exportMsg"></div></div>';
content.appendChild(p);

// Panel: upload
p = document.createElement('div'); p.className = 'panel'; p.id = 'panel-upload'; p.style.display = 'none';
p.innerHTML = '<div class="card"><div class="card-header">上传 .w28 到 ESP32</div><div class="card-row"><button class="btn btn-outline" id="uploadPickFile">选择 .w28</button><span class="label" id="uploadFileLabel" style="display:none"></span></div></div><div class="btn-row"><button class="btn btn-primary" id="uploadBtn">开始上传</button></div><div id="uploadProgress" style="display:none"><div class="progress-bar"><div class="progress-fill" id="uploadFill" style="width:0%"></div></div><div class="label" id="uploadMsg"></div></div><div class="card" style="margin-top:12px"><div class="card-header">ESP32 控制</div><div class="btn-row"><button class="btn btn-outline" id="ctlPlay">播放</button><button class="btn btn-outline" id="ctlStop">停止</button><button class="btn btn-outline" id="ctlDelete">删除</button></div><div class="btn-row" style="margin-top:8px"><label style="margin-right:8px">亮度</label><input type="range" min="10" max="255" value="64" id="brightSlider" style="flex:1"><span class="label" id="brightVal" style="width:36px;text-align:right">64</span></div></div><div class="card" style="margin-top:12px"><div class="card-header">状态</div><pre class="textarea" id="espStatus" style="height:120px;overflow:auto" readonly></pre><button class="btn btn-outline" id="refreshStatus" style="margin-top:4px">刷新状态</button></div>';
content.appendChild(p);

// Panel: settings
p = document.createElement('div'); p.className = 'panel'; p.id = 'panel-settings'; p.style.display = 'none';
p.innerHTML = '<div class="card"><div class="card-header">连接设置</div><div class="card-row" style="gap:12px"><label>ESP32 IP</label><input class="input" id="setIp" value="192.168.137.202" style="width:150px"><label>UDP Port</label><input class="input" id="setPort" value="8888" style="width:70px"></div></div><div class="card"><div class="card-header">调试日志</div><pre class="textarea" id="logArea" style="height:200px;overflow-y:auto;word-break:break-word;white-space:pre-wrap" readonly></pre></div>';
content.appendChild(p);

// Panel: editor (8x8 pixel painter)
p = document.createElement('div'); p.className = 'panel'; p.id = 'panel-editor'; p.style.display = 'none';
p.innerHTML = '<div class="card"><div class="card-header">像素编辑</div><div class="pixel-grid" id="pixelGrid"></div><div class="label" id="pixelInfo" style="margin-top:4px">点击格子开始画</div></div><div class="card"><div class="card-header">颜色</div><div class="color-palette" id="colorPalette"></div><div class="rgb-inputs"><label>R</label><input class="input" id="rgbR" value="255" maxlength="3"><label>G</label><input class="input" id="rgbG" value="0" maxlength="3"><label>B</label><input class="input" id="rgbB" value="0" maxlength="3"><div class="color-preview" id="colorPreview" style="width:60px;flex-shrink:0;background:rgb(255,0,0)"></div></div></div><div class="btn-row"><button class="btn btn-primary" id="showPixelBtn">▶ 临时显示</button><button class="btn btn-outline" id="savePixelBtn">💾 保存为默认</button><button class="btn btn-outline" id="saveSchemeBtn">📋 保存方案</button><button class="btn btn-outline" id="loadSchemeBtn">📂 导入方案</button><button class="btn btn-outline" id="clearPixelBtn">✕ 清空</button></div>';
content.appendChild(p);

// ═══════════════════════════════════════
//  STATE
// ═══════════════════════════════════════
var videoPath = null, exportVideoPath = null, exportOutPath = null, uploadFilePath = null;
var previewRunning = false, previewTimer = null, playInterval = null, brightThrottle = null, videoElement = null;

// ── 全局 IP/Port (设置面板唯一数据源) ──
function getIP() { return $('setIp').value || '192.168.137.202'; }
function getPort() { return parseInt($('setPort').value) || 8888; }

// ═══════════════════════════════════════
//  EVENTS
// ═══════════════════════════════════════

listen('export-progress', function(e) {
    $('exportProgress').style.display = ''; $('exportFill').style.width = e.percent + '%';
    $('exportMsg').textContent = e.msg || (e.percent + '%');
    if (e.percent >= 100) { snack('导出完成!'); log('导出完成: ' + exportOutPath); }
});
listen('upload-progress', function(e) {
    $('uploadProgress').style.display = ''; $('uploadFill').style.width = e.percent + '%';
    $('uploadMsg').textContent = e.msg || (e.percent + '%');
    if (e.percent >= 100) { snack('上传完成!'); log('上传完成'); }
});

// ── Helper: 8x8 pixel sampling + serpentine encoding ──
function encodeFrame() {
    if (!videoElement || videoElement.readyState < 2) return null;
    var sctx = sampleCanvas.getContext('2d');
    sctx.drawImage(videoElement, 0, 0, 8, 8);
    var pixels = sctx.getImageData(0, 0, 8, 8).data;
    var data = new Uint8Array(192);
    for (var col = 0; col < 8; col++) {
        for (var row = 0; row < 8; row++) {
            var sr = (col % 2 === 1) ? (7 - row) : row;
            var pidx = (sr * 8 + col) * 4;
            var dst = (col * 8 + row) * 3;
            data[dst] = pixels[pidx]; data[dst + 1] = pixels[pidx + 1]; data[dst + 2] = pixels[pidx + 2];
        }
    }
    return data;
}

// ── Render: 8x8 pixel blocks ──
function renderLoop() {
    if (!previewRunning) return;
    var canvas = $('previewCanvas'), ctx = canvas.getContext('2d');
    ctx.fillStyle = '#111'; ctx.fillRect(0, 0, 256, 256);
    if (videoElement && videoElement.readyState >= 2) {
        var sctx = sampleCanvas.getContext('2d');
        sctx.drawImage(videoElement, 0, 0, 8, 8);
        var pixels = sctx.getImageData(0, 0, 8, 8).data;
        for (var row = 0; row < 8; row++) {
            for (var col = 0; col < 8; col++) {
                var idx = (row * 8 + col) * 4;
                ctx.fillStyle = 'rgb(' + pixels[idx] + ',' + pixels[idx + 1] + ',' + pixels[idx + 2] + ')';
                ctx.fillRect(col * 32, row * 32, 32, 32);
            }
        }
        $('frameInfo').textContent = (videoElement.currentTime || 0).toFixed(2) + 's';
    }
    previewTimer = requestAnimationFrame(renderLoop);
}

function stopAll() {
    previewRunning = false; $('stopBtn').disabled = true; $('playBtn').disabled = false;
    $('previewBtn').textContent = '预览';
    if (previewTimer) cancelAnimationFrame(previewTimer);
    if (playInterval) { clearInterval(playInterval); playInterval = null; }
    if (videoElement) videoElement.pause();
    log('停止');
}

// ── Realtime ──
$('pickVideo').addEventListener('click', async function() {
    var file = await open({ title: '选择视频', filters: [{ name: '视频', extensions: ['mp4','avi','mov','mkv'] }] });
    if (!file) return;
    videoPath = file;
    $('videoLabel').textContent = file.split(/[\\/]/).pop(); $('videoLabel').style.display = '';
    $('frameInfo').textContent = '加载中...';
    if (!videoElement) { videoElement = document.createElement('video'); videoElement.crossOrigin = 'anonymous'; videoElement.preload = 'auto'; }
    var fs = window.__TAURI_PLUGIN_FS__;
    if (fs && fs.readFile) {
        try {
            var bytes = await fs.readFile(file);
            var ext = file.split('.').pop().toLowerCase();
            var mime = ext === 'avi' ? 'video/avi' : ext === 'mov' ? 'video/quicktime' : ext === 'mkv' ? 'video/x-matroska' : 'video/mp4';
            var blob = new Blob([bytes], { type: mime });
            if (videoElement._blobUrl) URL.revokeObjectURL(videoElement._blobUrl);
            videoElement._blobUrl = URL.createObjectURL(blob);
            videoElement.src = videoElement._blobUrl; videoElement.load();
            $('previewBtn').disabled = false; $('playBtn').disabled = false;
            $('frameInfo').textContent = '已加载: ' + $('videoLabel').textContent;
            log('已加载: ' + file);
        } catch(e) {
            $('frameInfo').textContent = '加载失败';
            log('视频加载失败: ' + e);
        }
    } else {
        $('frameInfo').textContent = 'FS 插件未加载';
    }
});

$('previewBtn').addEventListener('click', function() {
    if (!videoElement) return;
    if (previewRunning) { stopAll(); return; }
    previewRunning = true; $('previewBtn').textContent = '停止预览';
    videoElement.currentTime = 0;
    videoElement.play().catch(function() {});
    renderLoop();
    log('预览开始');
});

$('playBtn').addEventListener('click', function() {
    if (!videoElement) return snack('请先选择视频');
    if (!previewRunning) { $('previewBtn').click(); videoElement.play().catch(function(){}); }
    $('stopBtn').disabled = false; $('playBtn').disabled = true;
    var fps = parseInt($('fpsSel').value), ip = getIP(), port = getPort();
    playInterval = setInterval(function() {
        if (!videoElement || videoElement.paused) return;
        var data = encodeFrame();
        if (!data) return;
        var base64 = btoa(String.fromCharCode.apply(null, data));
        invoke('udp_send_single', { ip: ip, port: port, dataBase64: base64 }).catch(function() {});
    }, 1000 / fps);
    snack('UDP 推流已启动 ' + fps + 'FPS');
    log('UDP推流: ' + ip + ':' + port + ' @' + fps + 'FPS');
});

$('stopBtn').addEventListener('click', function() {
    if (playInterval) { clearInterval(playInterval); playInterval = null; }
    stopAll();
});

// ── Export ──
$('exportPickVideo').addEventListener('click', async function() {
    var file = await open({ title: '选择视频', filters: [{ name: '视频', extensions: ['mp4','avi','mov','mkv'] }] });
    if (file) { exportVideoPath = file; $('exportVideoLabel').textContent = file; $('exportVideoLabel').style.display = ''; }
});
$('exportPickOut').addEventListener('click', async function() {
    var path = await save({ defaultPath: 'output.w28', filters: [{ name: 'W28', extensions: ['w28'] }] });
    if (path) { exportOutPath = path; $('exportOutLabel').textContent = path; $('exportOutLabel').style.display = ''; }
});
$('exportBtn').addEventListener('click', async function() {
    if (!exportVideoPath || !exportOutPath) return snack('请选择视频和输出路径');
    $('exportProgress').style.display = ''; $('exportFill').style.width = '0%';
    log('开始导出: ' + exportVideoPath + ' → ' + exportOutPath);
    try {
        var mode = $('exportMode').value;
        var r = await invoke('video_to_w28', { videoPath: exportVideoPath, outputPath: exportOutPath, fps: parseInt($('exportFps').value), mode: mode });
        $('exportMsg').textContent = r;
        log('导出完成: ' + r);
    } catch(e) {
        $('exportMsg').textContent = '错误: ' + e;
        log('导出错误: ' + e);
    }
});

// ── Upload ──
$('uploadPickFile').addEventListener('click', async function() {
    var file = await open({ title: '选择 .w28', filters: [{ name: 'W28', extensions: ['w28'] }] });
    if (file) { uploadFilePath = file; $('uploadFileLabel').textContent = file; $('uploadFileLabel').style.display = ''; }
});
$('uploadBtn').addEventListener('click', async function() {
    if (!uploadFilePath) return snack('请选择 .w28');
    $('uploadProgress').style.display = ''; $('uploadFill').style.width = '0%';
    log('开始上传: ' + uploadFilePath);
    try {
        await invoke('esp32_upload', { ip: getIP(), filePath: uploadFilePath });
    } catch(e) {
        snack('上传失败: ' + e);
        log('上传失败: ' + e);
    }
});
$('ctlPlay').addEventListener('click', async function() {
    snack(await invoke('esp32_play', { ip: getIP() }));
    log('ESP32 播放');
});
$('ctlStop').addEventListener('click', async function() {
    snack(await invoke('esp32_stop', { ip: getIP() }));
    log('ESP32 停止');
});
$('ctlDelete').addEventListener('click', async function() {
    snack(await invoke('esp32_delete', { ip: getIP() }));
    log('ESP32 删除文件');
});

$('brightSlider').addEventListener('input', function() {
    var v = $('brightSlider').value; $('brightVal').textContent = v;
    if (brightThrottle) clearTimeout(brightThrottle);
    brightThrottle = setTimeout(function() {
        invoke('esp32_config', { ip: getIP(), key: 'brightness', value: v });
        log('亮度 → ' + v);
    }, 300);
});
$('refreshStatus').addEventListener('click', async function() {
    log('刷新 ESP32 状态');
    try {
        var s = await invoke('esp32_status', { ip: getIP() });
        $('espStatus').textContent = JSON.stringify(JSON.parse(s), null, 2);
    } catch(e) {
        $('espStatus').textContent = '获取失败: ' + e;
        log('状态获取失败: ' + e);
    }
});

// ═══════════════════════════════════════
//  PIXEL EDITOR
// ═══════════════════════════════════════

var pixelData = new Uint8Array(192);    // 64 cells * 3 RGB
var currentColor = [255, 0, 0];          // default red

// Preset colors
var presets = [
    [255,0,0], [255,128,0], [255,255,0], [0,255,0], [0,255,255],
    [0,0,255], [128,0,255], [255,255,255], [128,128,128], [0,0,0]
];

// Build 8x8 grid
var grid = $('pixelGrid');
for (var row = 0; row < 8; row++) {
    for (var col = 0; col < 8; col++) {
        var cell = document.createElement('div');
        cell.className = 'pixel-cell';
        cell.dataset.row = row; cell.dataset.col = col;
        cell.addEventListener('click', function() { paintCell(this); });
        grid.appendChild(cell);
    }
}

// Build color palette
var pal = $('colorPalette');
presets.forEach(function(c, i) {
    var sw = document.createElement('div');
    sw.className = 'color-swatch' + (i === 0 ? ' current' : '');
    sw.style.background = 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
    sw.addEventListener('click', function() { setColor(c, sw); });
    pal.appendChild(sw);
});

function paintCell(cell) {
    var row = parseInt(cell.dataset.row), col = parseInt(cell.dataset.col);
    // Serpentine index: col-major, odd cols reversed
    var sr = (col % 2 === 1) ? (7 - row) : row;
    var idx = (col * 8 + sr) * 3;
    pixelData[idx] = currentColor[2]; pixelData[idx + 1] = currentColor[1]; pixelData[idx + 2] = currentColor[0];
    cell.style.background = 'rgb(' + currentColor.join(',') + ')';
    $('pixelInfo').textContent = 'LED #' + (col * 8 + row) + ' (' + row + ',' + col + ') → ' + currentColor.join(',');
    log('像素: (' + row + ',' + col + ') → ' + currentColor.join(','));
}

function setColor(c, sw) {
    currentColor = c;
    $('rgbR').value = c[0]; $('rgbG').value = c[1]; $('rgbB').value = c[2];
    $('colorPreview').style.background = 'rgb(' + c.join(',') + ')';
    document.querySelectorAll('.color-swatch').forEach(function(s) { s.classList.remove('current'); });
    sw.classList.add('current');
}

// RGB input
['rgbR','rgbG','rgbB'].forEach(function(id) {
    $(id).addEventListener('input', function() {
        var r = parseInt($('rgbR').value) || 0, g = parseInt($('rgbG').value) || 0, b = parseInt($('rgbB').value) || 0;
        r = Math.min(255, Math.max(0, r)); g = Math.min(255, Math.max(0, g)); b = Math.min(255, Math.max(0, b));
        currentColor = [r, g, b];
        $('colorPreview').style.background = 'rgb(' + r + ',' + g + ',' + b + ')';
        document.querySelectorAll('.color-swatch').forEach(function(s) { s.classList.remove('current'); });
    });
});

// Encode pixel data → base64 (pixelData is already serpentine order)
function getPixelBase64() {
    return btoa(String.fromCharCode.apply(null, pixelData));
}

// Show on screen (UDP)
$('showPixelBtn').addEventListener('click', async function() {
    try {
        var b64 = getPixelBase64();
        await invoke('udp_send_single', { ip: getIP(), port: getPort(), dataBase64: b64 });
        snack('已发送到屏幕');
        log('临时显示: 像素推流');
    } catch(e) { snack('发送失败: ' + e); }
});

// Save as default
$('savePixelBtn').addEventListener('click', async function() {
    try {
        var b64 = getPixelBase64();
        var path = await invoke('save_pixel_w28', { pixelsBase64: b64, outputPath: 'pixel_output.w28' });
        if (!path) return snack('保存失败');
        // Upload to ESP32
        snack('正在上传到 ESP32...');
        log('保存像素画并上传: ' + path);
        await invoke('esp32_upload', { ip: getIP(), filePath: path });
        await invoke('esp32_config', { ip: getIP(), key: 'autoplay', value: '1' });
        snack('已保存为默认显示!');
    } catch(e) { snack('保存失败: ' + e); }
});

// Clear all
$('clearPixelBtn').addEventListener('click', function() {
    pixelData = new Uint8Array(192);
    document.querySelectorAll('.pixel-cell').forEach(function(c) { c.style.background = '#1a1a22'; });
    $('pixelInfo').textContent = '已清空';
    log('像素清空');
});

// Save pixel scheme to JSON file
$('saveSchemeBtn').addEventListener('click', async function() {
    var path = await save({ defaultPath: 'pixel_art.json', filters: [{ name: '像素方案', extensions: ['json'] }] });
    if (!path) return;
    try {
        var scheme = { version: 1, cols: 8, rows: 8, data: getPixelBase64() };
        var fs = window.__TAURI_PLUGIN_FS__;
        if (fs && fs.writeTextFile) {
            await fs.writeTextFile(path, JSON.stringify(scheme));
            snack('方案已保存'); log('保存方案: ' + path);
        }
    } catch(e) { snack('保存失败: ' + e); }
});

// Load pixel scheme from JSON file
$('loadSchemeBtn').addEventListener('click', async function() {
    var file = await open({ title: '导入像素方案', filters: [{ name: '像素方案', extensions: ['json'] }] });
    if (!file) return;
    try {
        var fs = window.__TAURI_PLUGIN_FS__;
        if (!fs || !fs.readTextFile) return snack('FS 不可用');
        var text = await fs.readTextFile(file);
        var scheme = JSON.parse(text);
        if (!scheme.data || scheme.data.length === 0) return snack('格式无效');
        // Decode base64 → Uint8Array
        var binary = atob(scheme.data);
        var bytes = new Uint8Array(binary.length);
        for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        if (bytes.length !== 192) return snack('数据大小错误: ' + bytes.length);
        pixelData = bytes;
        // Update all grid cells
        document.querySelectorAll('.pixel-cell').forEach(function(cell) {
            var row = parseInt(cell.dataset.row), col = parseInt(cell.dataset.col);
            var sr = (col % 2 === 1) ? (7 - row) : row;
            var idx = (col * 8 + sr) * 3;
            var r = pixelData[idx + 2], g = pixelData[idx + 1], b = pixelData[idx];
            cell.style.background = 'rgb(' + r + ',' + g + ',' + b + ')';
        });
        snack('方案已导入'); log('导入方案: ' + file);
    } catch(e) { snack('导入失败: ' + e); }
});
