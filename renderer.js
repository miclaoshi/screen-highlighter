// 屏幕选框渲染逻辑

const canvasEl = document.getElementById('canvas');

let isDrawing = false;
let startX = 0;
let startY = 0;
let currentBox = null;
let currentCanvas = null;
let currentCtx = null;
let currentAnimationId = null;
let animationOffset = 0; // 保持动画连续性
let isEnabled = true;
let isDrawingMode = false;

// 配置
let config = {
    fadeOutDuration: 1.0
};

// 监听配置变更
window.electronAPI.onConfigChanged((newConfig) => {
    config = { ...config, ...newConfig };
});

// 监听功能开关
window.electronAPI.onEnabledChanged((enabled) => {
    isEnabled = enabled;
});

// 监听绘制模式切换
window.electronAPI.onDrawingMode((drawing) => {
    isDrawingMode = drawing;

    if (drawing) {
        document.body.classList.add('drawing-mode');
    } else {
        document.body.classList.remove('drawing-mode');
        if (isDrawing && currentBox) {
            stopCurrentAnimation();
            currentBox.remove();
            currentBox = null;
            isDrawing = false;
        }
    }
});

// 停止当前动画
function stopCurrentAnimation() {
    if (currentAnimationId) {
        cancelAnimationFrame(currentAnimationId);
        currentAnimationId = null;
    }
}

// 绘制彩虹边框帧
function drawRainbowFrame(ctx, width, height, borderRadius, canvasWidth, canvasHeight) {
    const borderWidth = 5;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // 绘制彩虹渐变边框
    const gradient = ctx.createConicGradient(
        (animationOffset * Math.PI) / 180,
        canvasWidth / 2,
        canvasHeight / 2
    );

    gradient.addColorStop(0, '#FF3B30');
    gradient.addColorStop(0.14, '#FF9500');
    gradient.addColorStop(0.28, '#FFCC00');
    gradient.addColorStop(0.42, '#34C759');
    gradient.addColorStop(0.57, '#00C7BE');
    gradient.addColorStop(0.71, '#007AFF');
    gradient.addColorStop(0.85, '#AF52DE');
    gradient.addColorStop(1, '#FF3B30');

    ctx.strokeStyle = gradient;
    ctx.lineWidth = borderWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const x = borderWidth / 2;
    const y = borderWidth / 2;
    const w = width + borderWidth;
    const h = height + borderWidth;
    const r = Math.min(borderRadius, Math.min(w, h) / 2);

    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
    ctx.stroke();

    animationOffset += 2;
    if (animationOffset >= 360) animationOffset = 0;
}

// 启动动画循环
function startAnimationLoop(width, height, borderRadius) {
    const borderWidth = 5;
    const canvasWidth = width + borderWidth * 2;
    const canvasHeight = height + borderWidth * 2;

    function animate() {
        if (!currentCtx || !currentCanvas) return;

        // 更新 canvas 尺寸（如果变化）
        if (currentCanvas.width !== canvasWidth || currentCanvas.height !== canvasHeight) {
            currentCanvas.width = canvasWidth;
            currentCanvas.height = canvasHeight;
        }

        drawRainbowFrame(currentCtx, width, height, borderRadius, canvasWidth, canvasHeight);
        currentAnimationId = requestAnimationFrame(animate);
    }

    animate();
}

// 鼠标按下：开始绘制
canvasEl.addEventListener('mousedown', (e) => {
    if (!isEnabled || !isDrawingMode) return;

    isDrawing = true;
    startX = e.clientX;
    startY = e.clientY;

    // 重置动画偏移（随机起始位置）
    animationOffset = Math.random() * 360;

    currentBox = document.createElement('div');
    currentBox.className = 'highlight-box';
    currentBox.style.left = startX + 'px';
    currentBox.style.top = startY + 'px';
    currentBox.style.width = '0px';
    currentBox.style.height = '0px';

    // 创建 canvas
    currentCanvas = document.createElement('canvas');
    currentCanvas.width = 10;
    currentCanvas.height = 10;
    currentBox.appendChild(currentCanvas);
    currentCtx = currentCanvas.getContext('2d');

    canvasEl.appendChild(currentBox);
});

// 鼠标移动：更新选框大小，保持动画连续
canvasEl.addEventListener('mousemove', (e) => {
    if (!isDrawing || !currentBox) return;

    const currentX = e.clientX;
    const currentY = e.clientY;

    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    currentBox.style.left = left + 'px';
    currentBox.style.top = top + 'px';
    currentBox.style.width = width + 'px';
    currentBox.style.height = height + 'px';

    const minDim = Math.min(width, height);
    const radius = Math.min(20, Math.max(8, minDim * 0.1));
    currentBox.style.borderRadius = radius + 'px';

    if (width > 10 && height > 10) {
        // 停止旧动画
        stopCurrentAnimation();
        // 启动新动画（保持 animationOffset 连续）
        startAnimationLoop(width, height, radius);
    }
});

// 鼠标释放：完成绘制，立即开始淡出
canvasEl.addEventListener('mouseup', (e) => {
    if (!isDrawing || !currentBox) return;

    isDrawing = false;

    const width = parseInt(currentBox.style.width);
    const height = parseInt(currentBox.style.height);

    if (width < 10 || height < 10) {
        stopCurrentAnimation();
        currentBox.remove();
        currentBox = null;
        currentCanvas = null;
        currentCtx = null;
        return;
    }

    const box = currentBox;
    const animId = currentAnimationId;

    currentBox = null;
    currentCanvas = null;
    currentCtx = null;
    currentAnimationId = null;

    // 设置淡出时间
    box.style.transition = `opacity ${config.fadeOutDuration}s ease-out`;

    // 立即开始淡出
    requestAnimationFrame(() => {
        box.classList.add('fade-out');
    });

    // 淡出完成后移除
    setTimeout(() => {
        if (animId) cancelAnimationFrame(animId);
        box.remove();
    }, config.fadeOutDuration * 1000 + 100);
});

console.log('🎨 渲染进程已加载');
