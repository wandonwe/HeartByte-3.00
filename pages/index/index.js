// pages/index/index.js
// -----------------------------------------------------------------------------
// HeartByte · 心跳节律预测计算器
// 仅做“排版美化与结构化”，不改变任何计算/绘图逻辑。
// 模块顺序：常量 → 主题/颜色 → 文本样式助手 → 术语表 → 计算/工具函数
//        → Page data/handlers → 绘图（时间轴）
// -----------------------------------------------------------------------------

// 常量：性别选项
const SEX_OPTIONS = [
  { value: 'female', label: '女性' },
  { value: 'male', label: '男性' },
];

// 常量：右上角心形图标（嵌入式 SVG）
const HEART_ICON_SVG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
    <defs>
      <linearGradient id="heartGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ff6b6b"/>
        <stop offset="50%" stop-color="#ff2d67"/>
        <stop offset="100%" stop-color="#c3134d"/>
      </linearGradient>
      <radialGradient id="heartHighlight" cx="30%" cy="25%" r="65%">
        <stop offset="0%" stop-color="rgba(255, 255, 255, 0.5)"/>
        <stop offset="100%" stop-color="rgba(255, 107, 107, 0)" />
      </radialGradient>
      <filter id="lift" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="rgba(255, 45, 103, 0.4)"/></filter>
    </defs>
    <path filter="url(#lift)" d="M60 105C49.6 95.6 32 82.4 32 66c0-10.3 7.6-18.6 17.8-18.6 6.2 0 11.6 3.2 14.9 8.6 3.3-5.3 8.7-8.6 14.9-8.6 10.2 0 17.8 8.3 17.8 18.6 0 16.4-17.6 29.6-28 39z" fill="url(#heartGrad)"/>
    <path d="M60 105C49.6 95.6 32 82.4 32 66c0-10.3 7.6-18.6 17.8-18.6 6.2 0 11.6 3.2 14.9 8.6 3.3-5.3 8.7-8.6 14.9-8.6 10.2 0 17.8 8.3 17.8 18.6 0 16.4-17.6 29.6-28 39z" fill="url(#heartHighlight)"/>
    <g transform="translate(6, 7)">
      <path d="M42 68 h10 l4-6 l6 14 l4-8 h10" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
  </svg>
`);

// 统一色板
const COLOR_TOKENS = {
  ivct: {
    min: { primary: '#60a5fa', dark: '#2563eb', shadow: '#1d4ed8' }, // 最亮
    avg: { primary: '#3b82f6', dark: '#1d4ed8', shadow: '#1e40af' }, // 中等
    max: { primary: '#2563eb', dark: '#1e40af', shadow: '#1e3a8a' }, // 最深
    soft: 'rgba(37, 99, 235, 0.12)',
  },
  lvet: {
    min: { primary: '#2dd4bf', dark: '#0f766e', shadow: '#047857' },
    avg: { primary: '#14b8a6', dark: '#047857', shadow: '#065f46' },
    max: { primary: '#0f766e', dark: '#065f46', shadow: '#064e3b' },
    soft: 'rgba(15, 118, 110, 0.12)',
  },
  ivrt: {
    min: { primary: '#a78bfa', dark: '#7c3aed', shadow: '#6d28d9' },
    avg: { primary: '#8b5cf6', dark: '#6d28d9', shadow: '#5b21b6' },
    max: { primary: '#7c3aed', dark: '#5b21b6', shadow: '#4c1d95' },
    soft: 'rgba(124, 58, 237, 0.12)',
  },
  overlap: { primary: '#f97316', soft: 'rgba(249, 115, 22, 0.1)' },
};

// 主题（字号/间距/网格/调色）
const THEME = {
  font: { title: 15, label: 13, axisLabel: 12, segment: 12, annotation: 11 },
  spacing: { leftPad: 110, rightPad: 36, topPad: 72, row: 68, barHeight: 22, base: 140 },
  grid: { major: 100, minor: 50 },
  palette: {
    text: '#0f172a',
    axisText: '#475569',
    axisLine: 'rgba(148,163,184,0.35)',
    gridMajor: 'rgba(148,163,184,0.25)',
    gridMinor: 'rgba(148,163,184,0.12)',
    bgTop: '#f8fbff',
    bgBottom: '#e8f0ff',
    r: '#ef4444',
  },
};

// 文本样式助手
function setBodyText(ctx, ratio = 1) {
  ctx.fillStyle = THEME.palette.text;
  ctx.font = `${THEME.font.label * ratio}px sans-serif`;
}
function setAxisText(ctx, ratio = 1) {
  ctx.fillStyle = THEME.palette.axisText;
  ctx.font = `${THEME.font.axisLabel * ratio}px sans-serif`;
}

// 术语表
const GLOSSARY = [
  { term: 'IVCT', description: '等容收缩期：心室开始收缩到主动脉瓣开启的时间。' },
  { term: 'LVET', description: '左心室射血期：主动脉瓣开启到关闭的时间。' },
  { term: 'IVRT', description: '等容舒张期：主动脉瓣关闭到二尖瓣开启的时间。' },
];

// 算法模型：回归系数配置
// 基于 Schmidt et al. (Clin Res Cardiol, 2023)
const REGRESSION_MODEL = {
  female: {
    IVRT_corr_base: 113,
    IVRT_beta: 0.30,
    IVRT_age_coeff: 0.35,
    IVCT_corr_base: 52,
    IVCT_beta: 0.15,
    IVCT_age_coeff: 0.10,
    LVET_corr_base: 393,
    LVET_beta: 1.4,
  },
  male: {
    IVRT_corr_base: 111,
    IVRT_beta: 0.19,
    IVRT_age_coeff: 0.35,
    IVCT_corr_base: 48,
    IVCT_beta: 0.15,
    IVCT_age_coeff: 0.00,
    LVET_corr_base: 388,
    LVET_beta: 1.4,
  },
};

// 计算：单一心率下的时间点
function computeOne(sex, age, HR) {
  // 从配置中获取对应性别的系数
  const coeffs = REGRESSION_MODEL[sex];

  // 使用系数进行计算
  const ivrt_corr = coeffs.IVRT_corr_base + coeffs.IVRT_age_coeff * (age - 40);
  const ivct_corr = coeffs.IVCT_corr_base + coeffs.IVCT_age_coeff * (age - 40);

  const ivrt_raw = ivrt_corr - coeffs.IVRT_beta * HR;
  const ivct_raw = ivct_corr - coeffs.IVCT_beta * HR;
  const lvet_raw = coeffs.LVET_corr_base - coeffs.LVET_beta * HR;

  const r_to_ivct_end = ivct_raw;
  const r_to_lvet_end = ivct_raw + lvet_raw;
  const r_to_ivrt_start = r_to_lvet_end;
  const r_to_ivrt_end = r_to_ivrt_start + ivrt_raw;

  return {
    HR,
    ivrt_raw,
    ivct_raw,
    lvet_raw,
    r_to_ivct_end,
    r_to_lvet_end,
    r_to_ivrt_start,
    r_to_ivrt_end,
  };
}

// 区间重叠
function overlapInterval(aStart, aEnd, bStart, bEnd) {
  const start = Math.max(aStart, bStart);
  const end = Math.min(aEnd, bEnd);
  if (end <= start) return null;
  return { start, end, length: end - start };
}

// 工具：格式化
function fmt(value) {
  return Number.isFinite(value) ? value.toFixed(1) : '—';
}
function formatMs(value) {
  return `${fmt(value)} ms`;
}
function formatIntervalDetails(interval) {
  if (!interval) return '无重叠';
  return `${fmt(interval.start)} → ${fmt(interval.end)}（持续 ${fmt(interval.length)}）`;
}

function buildHrItems(data) {
  return [
    { label: 'IVCT 持续时间', value: formatMs(data.ivct_raw) },
    { label: 'IVRT 持续时间', value: formatMs(data.ivrt_raw) },
    { label: 'R → IVCT 终点', value: formatMs(data.r_to_ivct_end) },
    { label: 'R → LVET 终点', value: formatMs(data.r_to_lvet_end) },
    { label: 'R → IVRT 起点', value: formatMs(data.r_to_ivrt_start) },
    { label: 'R → IVRT 终点', value: formatMs(data.r_to_ivrt_end) },
  ];
}

// 页面
Page({
  data: {
    sexOptions: SEX_OPTIONS,
    sexIndex: 1,
    age: '',
    hrMax: '',
    hrMin: '',
    hrAvg: '',
    results: null,
    showViz: false,
    timelineData: null,
    canvasHeight: 320,
    canvasDisplayWidth: 660,
    canvasPixelWidth: 660,
    canvasPixelHeight: 320,
    pixelRatio: 1,
    glossary: GLOSSARY,
    heroIcon: HEART_ICON_SVG,
    heroSubtitle: 'Regression equations from Schmidt et al. (Clin Res Cardiol, 2023).',
    glossaryOpen: false,
    pulseScale: 1,
    _pulseTimer: null,
  },

  // 初始化：根据窗口宽度设定画布尺寸（1:1 buffer，避免裁切）
  onReady() {
    this._startPulse();
  },

  onHide() { this._stopPulse(); },
  onUnload() { this._stopPulse(); },

  // 事件：性别选择
  handleSexChange(e) {
    const index = Number(e.detail.value) || 0;
    this.setData({ sexIndex: index });
  },

  // 事件：文本输入
  handleInput(e) {
    const { field } = e.currentTarget.dataset;
    if (!field) return;
    this.setData({ [field]: e.detail.value });
  },

  // 事件：计算预测
  handlePredict() {
    const option = this.data.sexOptions[this.data.sexIndex] || this.data.sexOptions[0];
    const sex = option.value;

    const ageValue = parseFloat(this.data.age);
    const age = Number.isFinite(ageValue) ? ageValue : 40;

    const hrMinVal = parseFloat(this.data.hrMin);
    const hrMaxVal = parseFloat(this.data.hrMax);

    const hrAvgInput = this.data.hrAvg;
    const hrAvgVal = hrAvgInput === '' ? NaN : parseFloat(hrAvgInput);

    if (!Number.isFinite(hrMinVal) || !Number.isFinite(hrMaxVal) || hrMinVal <= 0 || hrMaxVal <= 0) {
      wx.showToast({ title: '请输入有效的心率范围', icon: 'none' });
      return;
    }

    const HRlo = Math.min(hrMinVal, hrMaxVal);
    const HRhi = Math.max(hrMinVal, hrMaxVal);

    const lo = computeOne(sex, age, HRlo);
    const hi = computeOne(sex, age, HRhi);
    const avg = Number.isFinite(hrAvgVal) ? computeOne(sex, age, hrAvgVal) : null;

    // 重叠区间（IVCT/IVRT）
    const ivctOverlapEnd = Math.min(lo.r_to_ivct_end, hi.r_to_ivct_end);
    const ivctOverlap = ivctOverlapEnd > 0 ? { start: 0, end: ivctOverlapEnd, length: ivctOverlapEnd } : null;
    const ivrtOverlap = overlapInterval(
      lo.r_to_ivrt_start,
      lo.r_to_ivrt_end,
      hi.r_to_ivrt_start,
      hi.r_to_ivrt_end
    );

    // 面板数据
    const hrSections = [
      {
        key: 'min',
        title: '最小心率',
        bpmLabel: `${fmt(lo.HR)} bpm`,
        items: buildHrItems(lo),
      },
      {
        key: 'max',
        title: '最大心率',
        bpmLabel: `${fmt(hi.HR)} bpm`,
        items: buildHrItems(hi),
      },
    ];
    if (avg) {
      // 插入到中间，保持 min -> avg -> max 的顺序
      hrSections.splice(1, 0, {
        key: 'avg',
        title: '平均心率',
        bpmLabel: `${fmt(avg.HR)} bpm`,
        items: buildHrItems(avg),
      });
    }

    const ivctOverlapSection = {
      title: '等容收缩期重叠窗口',
      pill: { label: 'IVCT · 等容收缩期', color: COLOR_TOKENS.ivct.max.primary, bgColor: COLOR_TOKENS.ivct.soft },
      items: [
        { label: '重叠区间', value: formatIntervalDetails(ivctOverlap) },
      ],
    };

    const ivrtOverlapSection = {
      title: '等容舒张期重叠窗口',
      pill: { label: 'IVRT · 等容舒张期', color: COLOR_TOKENS.ivrt.max.primary, bgColor: COLOR_TOKENS.ivrt.soft },
      items: [
        { label: '重叠区间', value: formatIntervalDetails(ivrtOverlap) },
      ],
      description: '比较 HRmin 与 HRmax 下的等容舒张期重叠情况。',
    };

    const results = {
      hrSections,
      ivctOverlapSection,
      ivrtOverlapSection,
      timelineMeta: [
        { key: 'min', label: 'HRmin', value: `${fmt(lo.HR)} bpm`, tone: 'min' },
        { key: 'max', label: 'HRmax', value: `${fmt(hi.HR)} bpm`, tone: 'max' },
        ...(avg
          ? [{ key: 'avg', label: 'HRavg', value: `${fmt(avg.HR)} bpm`, tone: 'avg' }]
          : []),
      ],
      hasAvg: Boolean(avg),
    };

    const timelineData = { lo, hi, avg, ivctOverlap, ivrtOverlap };

    // 画布高度：随行数动态增加
    const hrRowCount = avg ? 3 : 2;
    const totalRows = hrRowCount;
    const computedHeight = THEME.spacing.base + totalRows * THEME.spacing.row;
    const hasOverlap = ivctOverlap || ivrtOverlap; // Keep for height logic
    const minHeight = hasOverlap ? 280 : 260;
    const maxHeight = hasOverlap ? 360 : 320;
    const clampedHeight = Math.min(Math.max(computedHeight, minHeight), maxHeight);
    const canvasHeight = Math.round(clampedHeight);
    const pixelRatio = this.data.pixelRatio || 1;

    // For new 2D canvas, we update the node's height directly
    if (this.canvasNode) {
      this.canvasNode.width = this.data.canvasDisplayWidth * pixelRatio;
      this.canvasNode.height = canvasHeight * pixelRatio;
    }

    this.setData(
      {
        results,
        timelineData,
        showViz: true,
        canvasHeight,
      },
      async () => {
        // If canvas is not initialized, do it now.
        if (!this.canvasNode) {
          await this._initCanvas();
        }
        this.drawTimeline(); // Now draw
        this._startPulse(); // Restart pulse with new HR values
      }
    );
  },

  // Helper to initialize the canvas node and context
  _initCanvas() {
    return new Promise((resolve) => {
      const query = wx.createSelectorQuery();
      query.select('#timelineCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res[0] || !res[0].node) {
            console.error("Could not retrieve canvas node.");
            resolve(false);
            return;
          }
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          const pixelRatio = wx.getDeviceInfo().pixelRatio || 1;

          canvas.width = this.data.canvasDisplayWidth * pixelRatio;
          canvas.height = this.data.canvasHeight * pixelRatio;

          this.canvasNode = canvas;
          this.canvasCtx = ctx;
          resolve(true);
        });
    });
  },

  toggleGlossary() {
    this.setData({ glossaryOpen: !this.data.glossaryOpen });
  },

  _startPulse() {
    this._stopPulse();
    const hrMin = parseFloat(this.data.hrMin);
    const hrMax = parseFloat(this.data.hrMax);
    const hrAvg = parseFloat(this.data.hrAvg);
    const fallback = (Number.isFinite(hrMin) && Number.isFinite(hrMax)) ? (hrMin + hrMax) / 2 : 72;
    const bpm = Number.isFinite(hrAvg) ? hrAvg : fallback;
    const interval = 50; // ms per tick
    const omega = (2 * Math.PI) / (60000 / bpm) * interval; // phase increment per tick
    let phase = 0;
    const timer = setInterval(() => {
      phase += omega;
      const scale = 0.95 + 0.10 * Math.sin(phase);
      this.setData({ pulseScale: Number(scale.toFixed(3)) });
    }, interval);
    this.data._pulseTimer = timer;
  },

  _stopPulse() {
    if (this.data._pulseTimer) {
      clearInterval(this.data._pulseTimer);
      this.data._pulseTimer = null;
    }
  },

  handleExport() {
    if (!this.canvasNode) {
      wx.showToast({ title: '图表尚未准备好', icon: 'none' });
      return;
    }
    wx.canvasToTempFilePath({
      canvas: this.canvasNode,
      fileType: 'png',
      quality: 1,
      success: (res) => {
        const path = res.tempFilePath;
        wx.saveImageToPhotosAlbum({
          filePath: path,
          success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
          fail: (err) => {
            // 如果用户拒绝授权，则使用预览图片作为备选方案
            if (err.errMsg.includes('auth deny')) {
              wx.previewImage({ urls: [path] });
            }
          },
        });
      },
      fail: (err) => {
        console.warn('export failed', err);
        wx.showToast({ title: '导出失败', icon: 'none' });
      },
    });
  },

  // 绘图：时间轴
  drawTimeline() {
    const timelineData = this.data.timelineData;
    if (!timelineData || !this.canvasCtx || !this.canvasNode) return;

    const { lo, hi, avg, ivctOverlap, ivrtOverlap } = timelineData;

    const ctx = this.canvasCtx;
    const { width, height } = this.canvasNode;
    const pixelRatio = this.data.pixelRatio || 1;

    ctx.clearRect(0, 0, width, height);
    ctx.save(); // Save the clean state
    ctx.scale(pixelRatio, pixelRatio); // Apply DPI scaling
    const WIDTH = this.data.canvasDisplayWidth;
    const HEIGHT = this.data.canvasHeight;

    // 背景渐变
    const bgGradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    bgGradient.addColorStop(0, THEME.palette.bgTop);
    bgGradient.addColorStop(1, THEME.palette.bgBottom);
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // 横轴刻度范围
    const maxCandidates = [
      lo.r_to_ivrt_end,
      hi.r_to_ivrt_end,
      avg ? avg.r_to_ivrt_end : 0,
      ivrtOverlap ? ivrtOverlap.end : 0,
      ivctOverlap ? ivctOverlap.end : 0,
    ];
    const maxEnd = Math.max(100, ...maxCandidates);
    const minTick = 0;
    const maxTick = Math.max(500, Math.ceil((maxEnd + 50) / 50) * 50);
    const range = Math.max(maxTick - minTick, 1);

    // 尺度与像素比
    const displayWidth = this.data.canvasDisplayWidth || width;
    const scaleFactor = displayWidth / 700;

    // 动态左留白：根据标签宽度测量
    const labelStrings = [];
    if (ivctOverlap || ivrtOverlap) labelStrings.push('重叠窗口');
    labelStrings.push(`HRmin (${fmt(lo.HR)} bpm)`, `HRmax (${fmt(hi.HR)} bpm)`);
    if (avg) labelStrings.push(`HRavg (${fmt(avg.HR)} bpm)`);
    
    ctx.font = `${THEME.font.label}px sans-serif`; // Use logical pixels for measureText
    let maxLabelW = 0;
    labelStrings.forEach((s) => {
      const m = ctx.measureText(s);
      if (m && m.width) maxLabelW = Math.max(maxLabelW, m.width);
    });

    const labelGap = 28 * pixelRatio; // label 与轴之间留白
    const safety = 18 * pixelRatio;   // R 点/虚线预留
    const leftPad = Math.round(
      Math.max(80, THEME.spacing.leftPad * scaleFactor, maxLabelW / pixelRatio + labelGap / pixelRatio + safety / pixelRatio)
    );
    const rightPad = Math.round(Math.max(24, THEME.spacing.rightPad * scaleFactor));
    const topPad = Math.round(Math.max(46, THEME.spacing.topPad * scaleFactor));
    const axisY = topPad;
    const rowSpacing = Math.round(THEME.spacing.row * scaleFactor);
    const barHeight = Math.max(14, Math.round(THEME.spacing.barHeight));
    const headerOffset = 28;

    const scale = (t) => leftPad + ((WIDTH - leftPad - rightPad) * (t - minTick)) / range;

    // 标题
    ctx.font = `${THEME.font.title}px sans-serif`;
    ctx.fillStyle = THEME.palette.text;
    ctx.fillText('时间轴 (ms · 相对 R 波)', Math.max(16, leftPad), topPad - 26);

    // 横轴与网格
    ctx.strokeStyle = THEME.palette.axisLine;
    ctx.lineWidth = 1 / pixelRatio; // Ensure 1 physical pixel
    ctx.beginPath();
    ctx.moveTo(scale(minTick), axisY);
    ctx.lineTo(scale(maxTick), axisY);
    ctx.stroke();

    ctx.font = `${THEME.font.axisLabel}px sans-serif`;
    ctx.textAlign = 'center';
    for (let t = minTick; t <= maxTick; t += THEME.grid.minor) {
      const x = scale(t);
      const isMajor = t % THEME.grid.major === 0;
      ctx.strokeStyle = isMajor ? THEME.palette.gridMajor : THEME.palette.gridMinor;
      ctx.beginPath();
      ctx.moveTo(x, axisY);
      ctx.lineTo(x, HEIGHT - 48);
      ctx.stroke();
      if (isMajor) {
        ctx.fillStyle = THEME.palette.axisText;
        ctx.fillText(String(t), x, axisY - 12);
      }
    }
    ctx.textAlign = 'left';

    // 绘制圆角矩形
    function fillRoundedRect(ctxInstance, x, y, w, h, r) {
      const radius = Math.min(r, w / 2, h / 2);
      ctxInstance.beginPath();
      ctxInstance.moveTo(x + radius, y);
      ctxInstance.lineTo(x + w - radius, y);
      ctxInstance.quadraticCurveTo(x + w, y, x + w, y + radius);
      ctxInstance.lineTo(x + w, y + h - radius);
      ctxInstance.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
      ctxInstance.lineTo(x + radius, y + h);
      ctxInstance.quadraticCurveTo(x, y + h, x, y + h - radius);
      ctxInstance.lineTo(x, y + radius);
      ctxInstance.quadraticCurveTo(x, y, x + radius, y);
      ctxInstance.closePath();
      ctxInstance.fill();
    }

    // 绘制一个圆角条段（支持自定义高度）
    function drawRoundedBar(x1, x2, y, colors, heightPx = barHeight, isGhost = false) {
      const widthPx = Math.max(0, x2 - x1);
      if (widthPx <= 0 || heightPx <= 0) return null;

      const radius = Math.min(10, widthPx / 2, heightPx / 2);
      if (!isGhost && colors.dark) {
        // 绘制底部阴影层以增强3D感
        const shadowOffset = 2 / pixelRatio;
        ctx.fillStyle = colors.shadow;
        fillRoundedRect(ctx, x1, y + shadowOffset, widthPx, heightPx, radius);

        // 绘制顶部渐变层
        const gradient = ctx.createLinearGradient(x1, y, x1, y + heightPx);
        gradient.addColorStop(0, colors.primary);
        gradient.addColorStop(1, colors.dark);
        ctx.fillStyle = gradient;
        fillRoundedRect(ctx, x1, y, widthPx, heightPx, radius);
      } else {
        ctx.fillStyle = colors.primary; // For ghost bars
        fillRoundedRect(ctx, x1, y, widthPx, heightPx, radius);
      }

      return { x1, x2, y1: y, y2: y + heightPx };
    }

    // 行：相段（IVCT / LVET / IVRT）
    function drawPhaseRow(label, data, compareData, rowIndex, rowKey) {
      const baseY = axisY + headerOffset + rowIndex * rowSpacing;

      setBodyText(ctx, pixelRatio);
      ctx.textBaseline = 'middle'; // 垂直居中对齐
      ctx.fillText(label, 24, baseY);

      // --- 核心改动：绘制“幽灵”对比条 ---
      if (compareData) {
        const ghostHeight = barHeight;
        const ghostY = baseY - ghostHeight / 2;
        drawRoundedBar(
          scale(0), scale(compareData.r_to_ivct_end),
          ghostY, { primary: COLOR_TOKENS.ivct.soft }, ghostHeight, true
        );
        drawRoundedBar(
          scale(compareData.r_to_ivct_end), scale(compareData.r_to_lvet_end),
          ghostY, { primary: COLOR_TOKENS.lvet.soft }, ghostHeight, true
        );
        drawRoundedBar(
          scale(compareData.r_to_ivrt_start), scale(compareData.r_to_ivrt_end),
          ghostY, { primary: COLOR_TOKENS.ivrt.soft }, ghostHeight, true
        );
      }

      // 绘制主要的三相条段 (覆盖在幽灵条之上)
      const barY = baseY - barHeight / 2;
      const colorSet = COLOR_TOKENS.ivct[rowKey] || COLOR_TOKENS.ivct.avg;
      const ivctSpan = drawRoundedBar(scale(0), scale(data.r_to_ivct_end), barY, colorSet);
      const lvetSpan = drawRoundedBar(scale(data.r_to_ivct_end), scale(data.r_to_lvet_end), barY, COLOR_TOKENS.lvet[rowKey] || COLOR_TOKENS.lvet.avg);
      const ivrtSpan = drawRoundedBar(scale(data.r_to_ivrt_start), scale(data.r_to_ivrt_end), barY, COLOR_TOKENS.ivrt[rowKey] || COLOR_TOKENS.ivrt.avg);

      // 段标签
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff'; // 使用纯白色以获得最大对比度
      ctx.font = `${THEME.font.segment}px sans-serif`;
      ctx.textBaseline = 'middle'; // 垂直居中对齐
      const textY = baseY;
      if (ivctSpan) ctx.fillText('IVCT', (ivctSpan.x1 + ivctSpan.x2) / 2, textY);
      if (lvetSpan) ctx.fillText('LVET', (lvetSpan.x1 + lvetSpan.x2) / 2, textY);
      if (ivrtSpan) ctx.fillText('IVRT', (ivrtSpan.x1 + ivrtSpan.x2) / 2, textY);
      ctx.textAlign = 'left';
      setBodyText(ctx, pixelRatio);
    }

    // 标注：重叠区间
    function drawOverlapAnnotations() {
      const annotationY = HEIGHT - 32; // 调整垂直位置
      const drawAnnotation = (overlap, color, label) => {
        if (!overlap) return;
        const x1 = scale(overlap.start);
        const x2 = scale(overlap.end);
        const midX = (x1 + x2) / 2;

        // 使用更深的颜色以获得更好的对比度
        const darkColor = (label.includes('IVCT') ? COLOR_TOKENS.ivct.max.primary : COLOR_TOKENS.ivrt.max.primary);

        ctx.strokeStyle = darkColor;
        ctx.lineWidth = 1 / pixelRatio;
        // Bracket lines
        ctx.beginPath();
        ctx.moveTo(x1, annotationY + 8);
        ctx.lineTo(x1, annotationY);
        ctx.moveTo(x2, annotationY + 8);
        ctx.lineTo(x2, annotationY);
        ctx.stroke();
        // Connecting line
        ctx.beginPath();
        ctx.moveTo(x1, annotationY + 4);
        ctx.lineTo(x2, annotationY + 4);
        ctx.stroke();

        // Text
        ctx.fillStyle = darkColor;
        ctx.font = `${THEME.font.annotation}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(
          `${label}: ${fmt(overlap.start)} ms → ${fmt(overlap.end)} ms (${fmt(overlap.length)} ms)`,
          midX,
          annotationY + 14
        );
      };

      drawAnnotation(ivctOverlap, COLOR_TOKENS.ivct.max.primary, 'IVCT 重叠');
      drawAnnotation(ivrtOverlap, COLOR_TOKENS.ivrt.max.primary, 'IVRT 重叠');
      ctx.textAlign = 'left'; // Reset
    }

    // R 垂直虚线 + 标记 (先绘制，作为背景)
    const rX = scale(0);
    ctx.strokeStyle = THEME.palette.r;
    ctx.lineDash = [6 / pixelRatio, 4 / pixelRatio];
    ctx.beginPath();
    ctx.moveTo(rX, axisY);
    ctx.lineTo(rX, HEIGHT - 48); // Align with grid lines
    ctx.stroke();
    ctx.lineDash = [];

    ctx.fillStyle = THEME.palette.r;
    ctx.font = `${THEME.font.axisLabel}px sans-serif`;
    ctx.fillText('R', rX - 15, axisY - 12);

    // 构造行并绘制
    const rows = [];
    rows.push({ type: 'hr', key: 'min', label: `HRmin (${fmt(lo.HR)} bpm)`, payload: lo, compare: hi });
    if (avg) rows.push({ type: 'hr', key: 'avg', label: `HRavg (${fmt(avg.HR)} bpm)`, payload: avg, compare: hi });
    rows.push({ type: 'hr', key: 'max', label: `HRmax (${fmt(hi.HR)} bpm)`, payload: hi, compare: lo });

    rows.forEach((row, index) => {
      drawPhaseRow(row.label, row.payload, row.compare, index, row.key);
    });

    // 在每个泳道上标记 R 点
    rows.forEach((_, index) => {
      const baseY = axisY + headerOffset + index * rowSpacing;
      ctx.fillStyle = THEME.palette.r;
      ctx.beginPath();
      ctx.arc(rX, baseY, 4, 0, Math.PI * 2);
      ctx.fill();
    });
    drawOverlapAnnotations();

    ctx.restore(); // Restore the context to its original state
  },
});
