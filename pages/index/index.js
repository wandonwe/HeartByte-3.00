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
  <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
    <defs>
      <linearGradient id="iceGrad" x1="10%" y1="0%" x2="90%" y2="100%">
        <stop offset="0%" stop-color="#c9edff"/>
        <stop offset="100%" stop-color="#63aaff"/>
      </linearGradient>
      <radialGradient id="iceHighlight" cx="25%" cy="20%" r="80%">
        <stop offset="0%" stop-color="rgba(255,255,255,0.95)"/>
        <stop offset="100%" stop-color="rgba(255,255,255,0.12)"/>
      </radialGradient>
      <linearGradient id="heartGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ff6b6b"/>
        <stop offset="50%" stop-color="#ff2d67"/>
        <stop offset="100%" stop-color="#c3134d"/>
      </linearGradient>
      <filter id="lift" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="12" stdDeviation="12" flood-color="rgba(17, 43, 79, 0.35)"/>
      </filter>
    </defs>
    <g filter="url(#lift)">
      <rect x="14" y="14" width="132" height="132" rx="34" fill="url(#iceGrad)" stroke="rgba(255,255,255,0.6)" stroke-width="4"/>
      <rect x="28" y="28" width="104" height="104" rx="28" fill="url(#iceHighlight)" stroke="rgba(255,255,255,0.35)" stroke-width="2"/>
      <path d="M80 116c-12.8-11.6-34-28-34-48 0-12.4 9.1-22.3 21.3-22.3 7.5 0 13.9 3.9 17.9 10.3 4-6.4 10.4-10.3 17.9-10.3 12.2 0 21.3 9.9 21.3 22.3 0 20-21.2 36.4-34 48z" fill="url(#heartGrad)"/>
      <path d="M67 79h13l7-10.8 5.8 20.4 4.8-9.6h12.6" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
  </svg>
`);

// 统一色板
const COLOR_TOKENS = {
  ivct: { primary: '#2563eb', soft: 'rgba(37, 99, 235, 0.16)' },
  lvet: { primary: '#0f766e', soft: 'rgba(15, 118, 110, 0.16)' },
  ivrt: { primary: '#7c3aed', soft: 'rgba(124, 58, 237, 0.16)' },
  overlap: { primary: '#f97316', soft: 'rgba(249, 115, 22, 0.18)' },
  minCard: { primary: '#2563eb', soft: 'rgba(37, 99, 235, 0.12)' },
  maxCard: { primary: '#6366f1', soft: 'rgba(99, 102, 241, 0.12)' },
  avgCard: { primary: '#14b8a6', soft: 'rgba(20, 184, 166, 0.12)' },
};

// 主题（字号/间距/网格/调色）
const THEME = {
  font: { title: 14, label: 12, lvet: 12, segment: 12 },
  spacing: { leftPad: 110, rightPad: 36, topPad: 58, row: 74, barHeight: 18, base: 150 },
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
    rowDefault: 'rgba(226,232,240,0.55)',
  },
};

// 文本样式助手
function setBodyText(ctx, ratio = 1) {
  ctx.setFillStyle(THEME.palette.text);
  ctx.setFontSize(THEME.font.label * ratio);
}
function setAxisText(ctx, ratio = 1) {
  ctx.setFillStyle(THEME.palette.axisText);
  ctx.setFontSize(THEME.font.label * ratio);
}

// 术语表
const GLOSSARY = [
  { term: 'IVCT', description: '等容收缩期：心室开始收缩到主动脉瓣开启的时间。' },
  { term: 'LVET', description: '左心室射血期：主动脉瓣开启到关闭的时间。' },
  { term: 'IVRT', description: '等容舒张期：主动脉瓣关闭到二尖瓣开启的时间。' },
];

// 计算：单一心率下的时间点
function computeOne(sex, age, HR) {
  const IVRT_corr_base = sex === 'female' ? 113 : 111;
  const IVRT_beta = sex === 'female' ? 0.30 : 0.19;
  const IVRT_age_coeff = 0.35;

  const IVCT_corr_base = sex === 'female' ? 52 : 48;
  const IVCT_beta = 0.15;
  const IVCT_age_coeff = sex === 'female' ? 0.10 : 0.00;

  const LVET_corr_base = sex === 'female' ? 393 : 388;
  const LVET_beta = 1.4;

  const ivrt_corr = IVRT_corr_base + IVRT_age_coeff * (age - 40);
  const ivct_corr = IVCT_corr_base + IVCT_age_coeff * (age - 40);

  const ivrt_raw = ivrt_corr - IVRT_beta * HR;
  const ivct_raw = ivct_corr - IVCT_beta * HR;
  const lvet_raw = LVET_corr_base - LVET_beta * HR;

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

function formatOverlapChip(interval) {
  if (!interval) return '无重叠';
  return `${fmt(interval.start)} → ${fmt(interval.end)} ms（${fmt(interval.length)} ms）`;
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
    age: '40',
    hrMax: '100',
    hrMin: '80',
    hrAvg: '90',
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
    try {
      const info = wx.getSystemInfoSync();
      const horizontalPadding = 56;
      const availableWidth = Math.max(260, info.windowWidth - horizontalPadding);
      const displayWidth = Math.min(700, availableWidth);
      this.setData({
        canvasDisplayWidth: displayWidth,
        canvasPixelWidth: Math.round(displayWidth),
        pixelRatio: 1,
        canvasPixelHeight: Math.round(this.data.canvasHeight),
      });
      this._startPulse();
    } catch (err) {
      console.warn('system info failed', err);
    }
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
        color: COLOR_TOKENS.minCard.primary,
        bgColor: COLOR_TOKENS.minCard.soft,
        items: buildHrItems(lo),
      },
      {
        key: 'max',
        title: '最大心率',
        bpmLabel: `${fmt(hi.HR)} bpm`,
        color: COLOR_TOKENS.maxCard.primary,
        bgColor: COLOR_TOKENS.maxCard.soft,
        items: buildHrItems(hi),
      },
    ];
    if (avg) {
      hrSections.push({
        key: 'avg',
        title: '平均心率',
        bpmLabel: `${fmt(avg.HR)} bpm`,
        color: COLOR_TOKENS.avgCard.primary,
        bgColor: COLOR_TOKENS.avgCard.soft,
        items: buildHrItems(avg),
      });
    }

    const overlapItems = [
      { label: 'IVCT 重叠', value: formatIntervalDetails(ivctOverlap) },
      { label: 'IVRT 重叠', value: formatIntervalDetails(ivrtOverlap) },
    ];

    const overlapSummary = [
      { label: 'IVCT 重叠', value: formatOverlapChip(ivctOverlap), tone: 'ivct' },
      { label: 'IVRT 重叠', value: formatOverlapChip(ivrtOverlap), tone: 'ivrt' },
    ];

    const overlapSection = {
      title: '重叠窗口',
      pill: { label: 'IVCT 与 IVRT', color: COLOR_TOKENS.overlap.primary, bgColor: COLOR_TOKENS.overlap.soft },
      items: overlapItems,
      description: '比较 HRmin 与 HRmax 下收缩期与舒张期的重叠情况。',
    };

    const results = {
      hrSections,
      overlapSection,
      overlapSummary,
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
    const overlapRow = ivctOverlap || ivrtOverlap ? 1 : 0;
    const hrRowCount = avg ? 3 : 2;
    const totalRows = overlapRow + hrRowCount;
    const computedHeight = THEME.spacing.base + totalRows * THEME.spacing.row;
    const hasOverlap = Boolean(overlapRow);
    const minHeight = hasOverlap ? 280 : 260;
    const maxHeight = hasOverlap ? 360 : 320;
    const clampedHeight = Math.min(Math.max(computedHeight, minHeight), maxHeight);
    const canvasHeight = Math.round(clampedHeight);
    const pixelRatio = this.data.pixelRatio || 1;
    const canvasPixelHeight = Math.round(canvasHeight * pixelRatio);

    this.setData(
      {
        results,
        timelineData,
        showViz: true,
        canvasHeight,
        canvasPixelHeight,
      },
      () => {
        this.drawTimeline();
        this._startPulse();
      }
    );
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
    wx.canvasToTempFilePath({
      canvasId: 'timelineCanvas',
      fileType: 'png',
      quality: 1,
      success: (res) => {
        const path = res.tempFilePath;
        if (wx.saveImageToPhotosAlbum) {
          wx.saveImageToPhotosAlbum({
            filePath: path,
            success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
            fail: () => wx.previewImage({ urls: [path] })
          });
        } else {
          wx.previewImage({ urls: [path] });
        }
      },
      fail: (err) => {
        console.warn('export failed', err);
        wx.showToast({ title: '导出失败', icon: 'none' });
      }
    }, this);
  },

  // 绘图：时间轴
  drawTimeline() {
    const timelineData = this.data.timelineData;
    if (!timelineData) return;

    const { lo, hi, avg, ivctOverlap, ivrtOverlap } = timelineData;

    // 画布上下文与归一化
    const width = this.data.canvasPixelWidth || 700;
    const theight = this.data.canvasPixelHeight || Math.round(this.data.canvasHeight * this.data.pixelRatio);
    const height = theight; // 避免多处计算
    const ctx = wx.createCanvasContext('timelineCanvas', this);
    ctx.clearRect(0, 0, width, height);

    const viewW = this.data.canvasDisplayWidth || width;
    const viewH = this.data.canvasHeight || height;
    if (width !== viewW || height !== viewH) {
      const sx = viewW / width;
      const sy = viewH / height;
      ctx.scale(sx, sy);
    }
    const WIDTH = this.data.canvasDisplayWidth || width;
    const HEIGHT = this.data.canvasHeight || height;

    // 背景渐变
    const bgGradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    bgGradient.addColorStop(0, THEME.palette.bgTop);
    bgGradient.addColorStop(1, THEME.palette.bgBottom);
    ctx.setFillStyle(bgGradient);
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
    const pixelRatio = this.data.pixelRatio || 1;

    // 动态左留白：根据标签宽度测量
    const labelStrings = [];
    if (ivctOverlap || ivrtOverlap) labelStrings.push('重叠窗口');
    labelStrings.push(`HRmin (${fmt(lo.HR)} bpm)`, `HRmax (${fmt(hi.HR)} bpm)`);
    if (avg) labelStrings.push(`HRavg (${fmt(avg.HR)} bpm)`);

    ctx.setFontSize(THEME.font.label * pixelRatio);
    let maxLabelW = 0;
    labelStrings.forEach((s) => {
      const m = ctx.measureText(s);
      if (m && m.width) maxLabelW = Math.max(maxLabelW, m.width);
    });

    const labelGap = 28 * pixelRatio; // label 与轴之间留白
    const safety = 18 * pixelRatio;   // R 点/虚线预留
    const leftPad = Math.round(
      Math.max(80 * pixelRatio, THEME.spacing.leftPad * scaleFactor * pixelRatio, maxLabelW + labelGap + safety)
    );
    const rightPad = Math.round(Math.max(24 * pixelRatio, THEME.spacing.rightPad * scaleFactor * pixelRatio));
    const topPad = Math.round(Math.max(46 * pixelRatio, THEME.spacing.topPad * scaleFactor * pixelRatio));
    const axisY = topPad;
    const rowSpacing = Math.round(THEME.spacing.row * scaleFactor * pixelRatio);
    const barHeight = Math.max(14, Math.round(THEME.spacing.barHeight * pixelRatio));

    const scale = (t) => leftPad + ((WIDTH - leftPad - rightPad) * (t - minTick)) / range;

    // 标题
    ctx.setFontSize(THEME.font.title * pixelRatio);
    ctx.setFillStyle(THEME.palette.text);
    ctx.fillText('时间轴 (ms · 相对 R 波)', Math.max(16 * pixelRatio, leftPad), topPad - 26 * pixelRatio);

    // 横轴与网格
    ctx.setStrokeStyle(THEME.palette.axisLine);
    ctx.setLineWidth(1);
    ctx.beginPath();
    ctx.moveTo(scale(minTick), axisY);
    ctx.lineTo(scale(maxTick), axisY);
    ctx.stroke();

    ctx.setFontSize(THEME.font.label * pixelRatio);
    ctx.setTextAlign('center');
    for (let t = minTick; t <= maxTick; t += THEME.grid.minor) {
      const x = scale(t);
      const isMajor = t % THEME.grid.major === 0;
      ctx.setStrokeStyle(isMajor ? THEME.palette.gridMajor : THEME.palette.gridMinor);
      ctx.beginPath();
      ctx.moveTo(x, axisY);
      ctx.lineTo(x, HEIGHT - 48);
      ctx.stroke();
      if (isMajor) {
        ctx.setFillStyle(THEME.palette.axisText);
        ctx.fillText(String(t), x, axisY - 10 * pixelRatio);
      }
    }
    ctx.setTextAlign('left');

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
    function drawRoundedBar(x1, x2, y, color, heightPx = barHeight) {
      const widthPx = Math.max(0, x2 - x1);
      if (widthPx <= 0 || heightPx <= 0) return null;

      const radius = Math.min(10 * pixelRatio, widthPx / 2, heightPx / 2);
      ctx.setFillStyle(color);
      ctx.beginPath();
      ctx.moveTo(x1 + radius, y);
      ctx.lineTo(x2 - radius, y);
      ctx.quadraticCurveTo(x2, y, x2, y + radius);
      ctx.lineTo(x2, y + heightPx - radius);
      ctx.quadraticCurveTo(x2, y + heightPx, x2 - radius, y + heightPx);
      ctx.lineTo(x1 + radius, y + heightPx);
      ctx.quadraticCurveTo(x1, y + heightPx, x1, y + heightPx - radius);
      ctx.lineTo(x1, y + radius);
      ctx.quadraticCurveTo(x1, y, x1 + radius, y);
      ctx.closePath();
      ctx.fill();

      return { x1, x2, y1: y, y2: y + heightPx };
    }

    // 行：相段（IVCT / LVET / IVRT）
    function drawPhaseRow(label, data, rowIndex, bgColor) {
      const headerOffset = 28 * pixelRatio;
      const gutter = 16 * pixelRatio;
      const blockHeight = barHeight + 32 * pixelRatio;
      const corner = 14 * pixelRatio;

      const baseY = axisY + headerOffset + rowIndex * rowSpacing;
      const backgroundY = baseY - gutter;

      ctx.setFillStyle(bgColor || THEME.palette.rowDefault);
      fillRoundedRect(
        ctx,
        Math.max(0, leftPad - gutter),
        backgroundY,
        Math.max(0, WIDTH - leftPad - rightPad + gutter * 2),
        blockHeight,
        corner
      );

      setBodyText(ctx, pixelRatio);
      ctx.fillText(label, 24 * pixelRatio, baseY + barHeight - 4 * pixelRatio);

      // R 点
      const startX = scale(0);
      ctx.setFillStyle(COLOR_TOKENS.ivct.primary);
      ctx.beginPath();
      ctx.arc(startX, baseY + barHeight / 2, barHeight / 2, 0, Math.PI * 2);
      ctx.fill();

      // 三相条段
      const ivctSpan = drawRoundedBar(scale(0), scale(data.r_to_ivct_end), baseY, COLOR_TOKENS.ivct.primary);
      const lvetSpan = drawRoundedBar(
        scale(data.r_to_ivct_end),
        scale(data.r_to_lvet_end),
        baseY,
        COLOR_TOKENS.lvet.primary
      );
      const ivrtSpan = drawRoundedBar(
        scale(data.r_to_ivrt_start),
        scale(data.r_to_ivrt_end),
        baseY,
        COLOR_TOKENS.ivrt.primary
      );

      // 段标签
      ctx.setTextAlign('center');
      ctx.setFillStyle('#f8fafc');
      ctx.setFontSize(THEME.font.segment * pixelRatio);
      if (ivctSpan) ctx.fillText('IVCT', (ivctSpan.x1 + ivctSpan.x2) / 2, baseY + barHeight - 4 * pixelRatio);
      if (lvetSpan) ctx.fillText('LVET', (lvetSpan.x1 + lvetSpan.x2) / 2, baseY + barHeight - 4 * pixelRatio);
      if (ivrtSpan) ctx.fillText('IVRT', (ivrtSpan.x1 + ivrtSpan.x2) / 2, baseY + barHeight - 4 * pixelRatio);
      ctx.setTextAlign('left');
      setBodyText(ctx, pixelRatio);
    }

    // 行：重叠
    function drawOverlapRow(rowIndex) {
      const headerOffset = 28 * pixelRatio;
      const gutter = 16 * pixelRatio;
      const corner = 14 * pixelRatio;

      // Single compact block height; we will draw two thin bars inside the same row
      const baseY = axisY + headerOffset + rowIndex * rowSpacing;
      const backgroundY = baseY - gutter;

      ctx.setFillStyle(COLOR_TOKENS.overlap.soft);
      fillRoundedRect(
        ctx,
        Math.max(0, leftPad - gutter),
        backgroundY,
        Math.max(0, WIDTH - leftPad - rightPad + gutter * 2),
        barHeight + 32 * pixelRatio,
        corner
      );

      // Title on the left
      setBodyText(ctx, pixelRatio);
      ctx.fillText('重叠窗口', 24 * pixelRatio, baseY + barHeight - 4 * pixelRatio);

      // Two thin bars drawn within the same row
      const thin = Math.max(10 * pixelRatio, Math.round(barHeight * 0.55));
      const gap = 6 * pixelRatio;
      // Center the two thin bars vertically within available bar slot
      const totalThin = thin * 2 + gap;
      const yStart = baseY + Math.max(0, (barHeight - totalThin) / 2);

      ctx.setTextAlign('center');
      ctx.setFontSize(THEME.font.segment * pixelRatio);

      // IVCT overlap — use IVCT theme color
      if (ivctOverlap) {
        const s1 = drawRoundedBar(scale(ivctOverlap.start), scale(ivctOverlap.end), yStart, COLOR_TOKENS.ivct.primary, thin);
        if (s1) {
          ctx.setFillStyle('#ffffff');
          ctx.fillText('IVCT overlap', (s1.x1 + s1.x2) / 2, yStart + thin - 4 * pixelRatio);
        }
      }

      // IVRT overlap — use IVRT theme color
      if (ivrtOverlap) {
        const y2 = yStart + thin + gap;
        const s2 = drawRoundedBar(scale(ivrtOverlap.start), scale(ivrtOverlap.end), y2, COLOR_TOKENS.ivrt.primary, thin);
        if (s2) {
          ctx.setFillStyle('#ffffff');
          ctx.fillText('IVRT overlap', (s2.x1 + s2.x2) / 2, y2 + thin - 4 * pixelRatio);
        }
      }

      ctx.setTextAlign('left');
      setBodyText(ctx, pixelRatio);
    }

    // 构造行并绘制
    const rows = [];
    if (ivctOverlap || ivrtOverlap) rows.push({ type: 'overlap' });
    rows.push({ type: 'hr', label: `HRmin (${fmt(lo.HR)} bpm)`, payload: lo, bg: COLOR_TOKENS.minCard.soft });
    rows.push({ type: 'hr', label: `HRmax (${fmt(hi.HR)} bpm)`, payload: hi, bg: COLOR_TOKENS.maxCard.soft });
    if (avg) rows.push({ type: 'hr', label: `HRavg (${fmt(avg.HR)} bpm)`, payload: avg, bg: COLOR_TOKENS.avgCard.soft });

    rows.forEach((row, index) => {
      if (row.type === 'overlap') drawOverlapRow(index);
      else drawPhaseRow(row.label, row.payload, index, row.bg);
    });

    // R 垂直虚线 + 标记
    const rX = scale(0);
    ctx.setStrokeStyle(THEME.palette.r);
    if (ctx.setLineDash) ctx.setLineDash([6, 4], 0);
    ctx.beginPath();
    ctx.moveTo(rX, axisY - 14 * pixelRatio);
    ctx.lineTo(rX, HEIGHT - 40 * pixelRatio);
    ctx.stroke();
    if (ctx.setLineDash) ctx.setLineDash([], 0);

    ctx.setFillStyle(THEME.palette.r);
    ctx.setFontSize(THEME.font.label * pixelRatio);
    ctx.fillText('R', rX + 6 * pixelRatio, axisY - 16 * pixelRatio);

    ctx.draw();
  },
});
