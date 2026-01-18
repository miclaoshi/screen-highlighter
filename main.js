const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, screen, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let tray = null;
let isEnabled = true;
let isDrawingMode = false;

// 配置
let config = {
    shortcut: 'CommandOrControl+`',
    fadeOutDuration: 1.5
};

// 加载配置
function loadConfig() {
    const configPath = path.join(__dirname, 'config.json');
    try {
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, 'utf8');
            const loaded = JSON.parse(data);
            config = { ...config, ...loaded };
        }
    } catch (e) {
        console.log('配置加载失败，使用默认配置');
    }
}

// 保存配置
function saveConfig() {
    const configPath = path.join(__dirname, 'config.json');
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
    } catch (e) {
        console.log('配置保存失败');
    }
}

function createWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;

    mainWindow = new BrowserWindow({
        width: width,
        height: height,
        x: 0,
        y: 0,
        transparent: true,
        frame: false,
        hasShadow: false,
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,
        closable: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        type: 'panel',
        visibleOnAllWorkspaces: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    mainWindow.loadFile('index.html');
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);

    // 默认点击穿透 - 非常重要！
    safeSetIgnoreMouseEvents(true);

    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.send('enabled-changed', isEnabled);
        mainWindow.webContents.send('config-changed', config);
        console.log('✅ 窗口加载完成');
    });
}

// 安全设置鼠标穿透
function safeSetIgnoreMouseEvents(ignore) {
    try {
        if (mainWindow && !mainWindow.isDestroyed()) {
            if (ignore) {
                mainWindow.setIgnoreMouseEvents(true, { forward: true });
            } else {
                mainWindow.setIgnoreMouseEvents(false);
            }
        }
    } catch (e) {
        console.log('设置鼠标事件失败:', e.message);
    }
}

function createTray() {
    let icon = nativeImage.createFromDataURL(createDataURLIcon());
    icon.setTemplateImage(true);

    tray = new Tray(icon);
    tray.setToolTip('屏幕选框高亮');
    updateTrayMenu();

    tray.on('click', () => {
        tray.popUpContextMenu();
    });

    console.log('✅ 菜单栏图标已创建');
}

function createDataURLIcon() {
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAbwAAAG8B8aLcQwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAADFSURBVDiN7ZMxCsIwGIW/RHBxUXR1EfQg3sAzeBZP4J08j4tDl0IHB8HNLk4u4uAgKP+QJqSmrYq+5U/e+0hIAj8nhVgATeA6UJ/zFWgDb+BujPk4L0JU7H8AOsAt4hJwASpAy8NZG4BXZ00TODs7Cc6TE6gBI+DsYQl4xJx3AEYWA68kvhjzYIyZG2MeQDfm/C3gW+E/AW/fABEZi8jE57pPQFbYfw28u00P4Op2nrjCb/D3Au9fSQogDqS/s/kJpL5T/gZ99y9LxQbYqwAAAABJRU5ErkJggg==';
}

function updateTrayMenu() {
    // 状态显示
    let statusLabel, actionLabel;

    if (isDrawingMode) {
        statusLabel = '🎨 绘制中';
        actionLabel = '⏸️ 暂停绘制';
    } else if (isEnabled) {
        statusLabel = '✅ 已启动';
        actionLabel = '🎨 开始绘制';
    } else {
        statusLabel = '⏹️ 已关闭';
        actionLabel = '▶️ 启动功能';
    }

    const contextMenu = Menu.buildFromTemplate([
        { label: '屏幕选框高亮', enabled: false },
        { type: 'separator' },
        { label: statusLabel, enabled: false },
        { type: 'separator' },
        { label: actionLabel, click: isDrawingMode ? exitDrawingMode : (isEnabled ? enterDrawingMode : toggleEnabled) },
        { label: isEnabled ? '关闭功能' : '启动功能', click: toggleEnabled, visible: !isDrawingMode },
        { type: 'separator' },
        {
            label: '⚙️ 设置', submenu: [
                { label: `淡出时间: ${config.fadeOutDuration}秒`, enabled: false },
                { label: '0.5秒', type: 'radio', checked: config.fadeOutDuration === 0.5, click: () => setFadeOutDuration(0.5) },
                { label: '0.8秒', type: 'radio', checked: config.fadeOutDuration === 0.8, click: () => setFadeOutDuration(0.8) },
                { label: '1.0秒', type: 'radio', checked: config.fadeOutDuration === 1.0, click: () => setFadeOutDuration(1.0) },
                { label: '1.5秒', type: 'radio', checked: config.fadeOutDuration === 1.5, click: () => setFadeOutDuration(1.5) },
                { label: '2.0秒', type: 'radio', checked: config.fadeOutDuration === 2.0, click: () => setFadeOutDuration(2.0) },
                { type: 'separator' },
                { label: `快捷键: ${config.shortcut.replace('CommandOrControl', '⌘')}`, enabled: false },
                { label: '⌘+`', type: 'radio', checked: config.shortcut === 'CommandOrControl+`', click: () => setShortcut('CommandOrControl+`') },
                { label: '⌘+D', type: 'radio', checked: config.shortcut === 'CommandOrControl+D', click: () => setShortcut('CommandOrControl+D') },
                { label: '⌘+E', type: 'radio', checked: config.shortcut === 'CommandOrControl+E', click: () => setShortcut('CommandOrControl+E') },
                { label: '⌘+⇧+H', type: 'radio', checked: config.shortcut === 'CommandOrControl+Shift+H', click: () => setShortcut('CommandOrControl+Shift+H') }
            ]
        },
        { type: 'separator' },
        { label: `📌 快捷键: ${config.shortcut.replace('CommandOrControl', '⌘')}`, enabled: false },
        { label: '📌 紧急退出: ⌘+⇧+Q', enabled: false },
        { type: 'separator' },
        { label: '🚪 退出程序', click: forceQuit }
    ]);

    tray.setContextMenu(contextMenu);
}

function setFadeOutDuration(duration) {
    config.fadeOutDuration = duration;
    saveConfig();
    updateTrayMenu();
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('config-changed', config);
    }
    console.log(`淡出时间设置为: ${duration}秒`);
}

function setShortcut(shortcut) {
    try {
        globalShortcut.unregister(config.shortcut);
    } catch (e) { }

    config.shortcut = shortcut;
    saveConfig();

    try {
        globalShortcut.register(config.shortcut, toggleDrawingMode);
    } catch (e) {
        console.log('快捷键注册失败:', e.message);
    }

    updateTrayMenu();
    console.log(`快捷键设置为: ${shortcut}`);
}

function toggleEnabled() {
    isEnabled = !isEnabled;
    if (!isEnabled && isDrawingMode) {
        exitDrawingMode();
    }
    updateTrayMenu();
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('enabled-changed', isEnabled);
    }
    console.log(`功能状态: ${isEnabled ? '开启' : '关闭'}`);
}

function toggleDrawingMode() {
    if (isDrawingMode) {
        exitDrawingMode();
    } else {
        enterDrawingMode();
    }
}

function enterDrawingMode() {
    if (!isEnabled || isDrawingMode) return;

    isDrawingMode = true;
    updateTrayMenu();

    safeSetIgnoreMouseEvents(false);

    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
        mainWindow.webContents.send('drawing-mode', true);
    }
    console.log('🎨 进入绘制模式');
}

function exitDrawingMode() {
    isDrawingMode = false;
    updateTrayMenu();

    // 非常重要：恢复鼠标穿透！
    safeSetIgnoreMouseEvents(true);

    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('drawing-mode', false);
    }
    console.log('💤 退出绘制模式');
}

// 强制退出 - 确保一定能退出！
function forceQuit() {
    console.log('👋 强制退出...');

    // 先恢复鼠标
    safeSetIgnoreMouseEvents(true);

    // 注销所有快捷键
    try {
        globalShortcut.unregisterAll();
    } catch (e) { }

    // 销毁托盘
    try {
        if (tray) {
            tray.destroy();
            tray = null;
        }
    } catch (e) { }

    // 销毁窗口
    try {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.destroy();
            mainWindow = null;
        }
    } catch (e) { }

    // 强制退出
    process.exit(0);
}

// 超时保护：如果绘制模式超过60秒自动退出
let drawingTimeout = null;
function startDrawingTimeout() {
    clearDrawingTimeout();
    drawingTimeout = setTimeout(() => {
        if (isDrawingMode) {
            console.log('⚠️ 绘制模式超时，自动退出');
            exitDrawingMode();
        }
    }, 60000); // 60秒
}

function clearDrawingTimeout() {
    if (drawingTimeout) {
        clearTimeout(drawingTimeout);
        drawingTimeout = null;
    }
}

app.whenReady().then(() => {
    if (app.dock) {
        app.dock.hide();
    }

    loadConfig();
    createWindow();
    createTray();

    // 注册主快捷键
    try {
        globalShortcut.register(config.shortcut, toggleDrawingMode);
    } catch (e) {
        console.log('主快捷键注册失败:', e.message);
    }

    // 🚨 紧急退出快捷键 - 永远可用！
    try {
        globalShortcut.register('CommandOrControl+Shift+Q', forceQuit);
    } catch (e) {
        console.log('紧急退出快捷键注册失败');
    }

    // Esc 键退出绘制模式
    try {
        globalShortcut.register('Escape', () => {
            if (isDrawingMode) {
                exitDrawingMode();
            }
        });
    } catch (e) { }

    console.log('');
    console.log('🎨 屏幕选框高亮工具已启动！');
    console.log('');
    console.log('📌 当前配置：');
    console.log(`   快捷键: ${config.shortcut}`);
    console.log(`   淡出时间: ${config.fadeOutDuration}秒`);
    console.log('');
    console.log('🚨 紧急退出: Cmd+Shift+Q');
    console.log('');
});

// 定时器：每5秒检查状态，防止卡住
setInterval(() => {
    if (!isDrawingMode) {
        safeSetIgnoreMouseEvents(true);
    }
}, 5000);

app.on('window-all-closed', () => {
    forceQuit();
});

app.on('will-quit', () => {
    try {
        globalShortcut.unregisterAll();
    } catch (e) { }
});

app.on('before-quit', () => {
    try {
        globalShortcut.unregisterAll();
    } catch (e) { }
});
