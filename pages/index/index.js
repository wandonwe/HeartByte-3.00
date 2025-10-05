const SEX_OPTIONS = [
  { value: 'female', label: '女性' },
  { value: 'male', label: '男性' },
];

const COLOR_TOKENS = {
  ivct: { primary: '#2563eb', soft: 'rgba(37, 99, 235, 0.16)' },
  lvet: { primary: '#0f766e', soft: 'rgba(15, 118, 110, 0.16)' },
  ivrt: { primary: '#7c3aed', soft: 'rgba(124, 58, 237, 0.16)' },
  overlap: { primary: '#f97316', soft: 'rgba(249, 115, 22, 0.18)' },
  minCard: { primary: '#2563eb', soft: 'rgba(37, 99, 235, 0.12)' },
  maxCard: { primary: '#6366f1', soft: 'rgba(99, 102, 241, 0.12)' },
  avgCard: { primary: '#14b8a6', soft: 'rgba(20, 184, 166, 0.12)' },
};

const GLOSSARY = [
  {
    term: 'IVCT',
    description: '等容收缩期：心室开始收缩到主动脉瓣开启的时间。',
  },
  {
    term: 'LVET',
    description: '左心室射血期：主动脉瓣开启到关闭的时间。',
  },
  {
    term: 'IVRT',
    description: '等容舒张期：主动脉瓣关闭到二尖瓣开启的时间。',
  },
];

function createPhasePills() {
  return [
    { label: 'IVCT', color: COLOR_TOKENS.ivct.primary, bgColor: COLOR_TOKENS.ivct.soft },
    { label: 'LVET', color: COLOR_TOKENS.lvet.primary, bgColor: COLOR_TOKENS.lvet.soft },
    { label: 'IVRT', color: COLOR_TOKENS.ivrt.primary, bgColor: COLOR_TOKENS.ivrt.soft },
  ];
}

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

function overlapInterval(aStart, aEnd, bStart, bEnd) {
  const start = Math.max(aStart, bStart);
  const end = Math.min(aEnd, bEnd);
  if (end <= start) return null;
  return { start, end, length: end - start };
}

function fmt(value) {
  return Number.isFinite(value) ? value.toFixed(1) : '—';
}

function formatMs(value) {
  return `${fmt(value)} ms`;
}

function formatIntervalDetails(interval) {
  if (!interval) return '无重叠';
  return `${fmt(interval.start)} -> ${fmt(interval.end)}（持续 ${fmt(interval.length)}）`;
}

function formatAge(age) {
  return Number.isFinite(age) ? Math.round(age) : '—';
}

function buildHrItems(data) {
  return [
    { label: 'IVCT 持续时间', value: formatMs(data.ivct_raw) },
    { label: 'IVRT 持续时间', value: formatMs(data.ivrt_raw) },
    { label: 'R -> IVCT 终点', value: formatMs(data.r_to_ivct_end) },
    { label: 'R -> LVET 终点', value: formatMs(data.r_to_lvet_end) },
    { label: 'R -> IVRT 起点', value: formatMs(data.r_to_ivrt_start) },
    { label: 'R -> IVRT 终点', value: formatMs(data.r_to_ivrt_end) },
  ];
}

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
    glossary: GLOSSARY,
  },

  handleSexChange(e) {
    const index = Number(e.detail.value) || 0;
    this.setData({ sexIndex: index });
  },

  handleInput(e) {
    const { field } = e.currentTarget.dataset;
    if (!field) return;
    this.setData({ [field]: e.detail.value });
  },

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

    const ivctOverlapEnd = Math.min(lo.r_to_ivct_end, hi.r_to_ivct_end);
    const ivctOverlap = ivctOverlapEnd > 0 ? { start: 0, end: ivctOverlapEnd, length: ivctOverlapEnd } : null;
    const ivrtOverlap = overlapInterval(
      lo.r_to_ivrt_start,
      lo.r_to_ivrt_end,
      hi.r_to_ivrt_start,
      hi.r_to_ivrt_end,
    );

    const hrSections = [];
    hrSections.push({
      key: 'min',
      title: '最小心率',
      bpmLabel: `${fmt(lo.HR)} bpm`,
      color: COLOR_TOKENS.minCard.primary,
      bgColor: COLOR_TOKENS.minCard.soft,
      items: buildHrItems(lo),
    });
    hrSections.push({
      key: 'max',
      title: '最大心率',
      bpmLabel: `${fmt(hi.HR)} bpm`,
      color: COLOR_TOKENS.maxCard.primary,
      bgColor: COLOR_TOKENS.maxCard.soft,
      items: buildHrItems(hi),
    });
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

    const summaryChips = [
      { label: '最小心率', pills: createPhasePills() },
      { label: '最大心率', pills: createPhasePills() },
      { label: '重叠', pills: [{ label: 'IVCT 与 IVRT', color: COLOR_TOKENS.overlap.primary, bgColor: COLOR_TOKENS.overlap.soft }] },
    ];
    if (avg) {
      summaryChips.push({ label: '平均心率', pills: createPhasePills() });
    }

    const overlapSection = {
      title: '重叠窗口',
      pill: { label: 'IVCT 与 IVRT', color: COLOR_TOKENS.overlap.primary, bgColor: COLOR_TOKENS.overlap.soft },
      items: [
        { label: 'IVCT 重叠', value: formatIntervalDetails(ivctOverlap) },
        { label: 'IVRT 重叠', value: formatIntervalDetails(ivrtOverlap) },
      ],
      description: '比较 HRmin 与 HRmax 下收缩期与舒张期的重叠情况。',
    };

    const metaChips = [
      { label: '年龄', value: `${formatAge(age)} 岁` },
      { label: '性别', value: option.label },
    ];

    const results = {
      hrSections,
      overlapSection,
      summaryChips,
      metaChips,
    };

    const timelineData = { lo, hi, avg, ivctOverlap, ivrtOverlap };

    const overlapRow = ivctOverlap || ivrtOverlap ? 1 : 0;
    const hrRowCount = avg ? 3 : 2;
    const totalRows = overlapRow + hrRowCount;
    const canvasHeight = Math.max(300, 140 + totalRows * 70);

    this.setData({
      results,
      timelineData,
      showViz: true,
      canvasHeight,
    }, () => {
      this.drawTimeline();
    });
  },

  drawTimeline() {
    const timelineData = this.data.timelineData;
    if (!timelineData) return;
    const { lo, hi, avg, ivctOverlap, ivrtOverlap } = timelineData;

    const width = 700;
    const height = this.data.canvasHeight;
    const ctx = wx.createCanvasContext('timelineCanvas', this);
    ctx.clearRect(0, 0, width, height);

    const maxCandidates = [
      lo.r_to_ivrt_end,
      hi.r_to_ivrt_end,
      avg ? avg.r_to_ivrt_end : 0,
      ivrtOverlap ? ivrtOverlap.end : 0,
      ivctOverlap ? ivctOverlap.end : 0,
    ];
    const maxEnd = Math.max(100, ...maxCandidates);
    const minTick = 0;
    const maxTick = Math.ceil((maxEnd + 50) / 50) * 50;
    const range = Math.max(maxTick - minTick, 1);

    const leftPad = 110;
    const rightPad = 40;
    const topPad = 80;
    const axisY = topPad;
    const rowSpacing = 70;
    const barHeight = 20;

    const scale = (t) => leftPad + ((width - leftPad - rightPad) * (t - minTick)) / range;

    ctx.setFontSize(14);
    ctx.setFillStyle('#0f172a');
    ctx.fillText('时间轴 (相对于 R 波, 毫秒)', leftPad, topPad - 32);

    ctx.setStrokeStyle('rgba(148, 163, 184, 0.35)');
    ctx.setLineWidth(1);
    ctx.beginPath();
    ctx.moveTo(scale(minTick), axisY);
    ctx.lineTo(scale(maxTick), axisY);
    ctx.stroke();

    ctx.setFontSize(12);
    ctx.setFillStyle('#475569');
    ctx.setTextAlign('center');
    for (let t = minTick; t <= maxTick; t += 100) {
      const x = scale(t);
      ctx.setStrokeStyle('rgba(148, 163, 184, 0.2)');
      ctx.beginPath();
      ctx.moveTo(x, axisY);
      ctx.lineTo(x, height - 50);
      ctx.stroke();
      ctx.fillText(String(t), x, axisY - 10);
    }
    ctx.setTextAlign('left');

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

    function drawRoundedBar(x1, x2, y, color) {
      const widthPx = Math.max(0, x2 - x1);
      if (widthPx <= 0) return;
      const radius = Math.min(10, widthPx / 2);
      ctx.setFillStyle(color);
      ctx.beginPath();
      ctx.moveTo(x1 + radius, y);
      ctx.lineTo(x2 - radius, y);
      ctx.quadraticCurveTo(x2, y, x2, y + radius);
      ctx.lineTo(x2, y + barHeight - radius);
      ctx.quadraticCurveTo(x2, y + barHeight, x2 - radius, y + barHeight);
      ctx.lineTo(x1 + radius, y + barHeight);
      ctx.quadraticCurveTo(x1, y + barHeight, x1, y + barHeight - radius);
      ctx.lineTo(x1, y + radius);
      ctx.quadraticCurveTo(x1, y, x1 + radius, y);
      ctx.closePath();
      ctx.fill();
    }

    function drawPhaseRow(label, data, rowIndex) {
      const baseY = axisY + 30 + rowIndex * rowSpacing;
      const backgroundY = baseY - 16;
      ctx.setFillStyle('rgba(226, 232, 240, 0.55)');
      fillRoundedRect(ctx, leftPad, backgroundY, width - leftPad - rightPad, barHeight + 32, 16);

      ctx.setFillStyle('#0f172a');
      ctx.setFontSize(13);
      ctx.fillText(label, 24, baseY + barHeight - 4);

      const startX = scale(0);
      ctx.setFillStyle(COLOR_TOKENS.ivct.primary);
      ctx.beginPath();
      ctx.arc(startX, baseY + barHeight / 2, barHeight / 2, 0, Math.PI * 2);
      ctx.fill();

      drawRoundedBar(scale(0), scale(data.r_to_ivct_end), baseY, COLOR_TOKENS.ivct.primary);
      drawRoundedBar(scale(data.r_to_ivct_end), scale(data.r_to_lvet_end), baseY, COLOR_TOKENS.lvet.primary);
      drawRoundedBar(scale(data.r_to_ivrt_start), scale(data.r_to_ivrt_end), baseY, COLOR_TOKENS.ivrt.primary);
    }

    function drawOverlapRow(rowIndex) {
      const baseY = axisY + 30 + rowIndex * rowSpacing;
      const backgroundY = baseY - 16;
      ctx.setFillStyle('rgba(254, 215, 170, 0.4)');
      fillRoundedRect(ctx, leftPad, backgroundY, width - leftPad - rightPad, barHeight + 32, 16);

      ctx.setFillStyle('#b45309');
      ctx.setFontSize(13);
      ctx.fillText('重叠窗口', 24, baseY + barHeight - 4);

      if (ivctOverlap) {
        drawRoundedBar(scale(ivctOverlap.start), scale(ivctOverlap.end), baseY, COLOR_TOKENS.overlap.primary);
      }
      if (ivrtOverlap) {
        drawRoundedBar(scale(ivrtOverlap.start), scale(ivrtOverlap.end), baseY, 'rgba(249, 115, 22, 0.65)');
      }
    }

    const rows = [];
    if (ivctOverlap || ivrtOverlap) {
      rows.push({ type: 'overlap' });
    }
    rows.push({ type: 'hr', label: `HRmin (${fmt(lo.HR)} bpm)`, payload: lo });
    rows.push({ type: 'hr', label: `HRmax (${fmt(hi.HR)} bpm)`, payload: hi });
    if (avg) {
      rows.push({ type: 'hr', label: `HRavg (${fmt(avg.HR)} bpm)`, payload: avg });
    }

    rows.forEach((row, index) => {
      if (row.type === 'overlap') {
        drawOverlapRow(index);
      } else {
        drawPhaseRow(row.label, row.payload, index);
      }
    });

    const rX = scale(0);
    ctx.setStrokeStyle('#ef4444');
    if (ctx.setLineDash) {
      ctx.setLineDash([6, 4], 0);
    }
    ctx.beginPath();
    ctx.moveTo(rX, axisY - 14);
    ctx.lineTo(rX, height - 40);
    ctx.stroke();
    if (ctx.setLineDash) {
      ctx.setLineDash([], 0);
    }

    ctx.setFillStyle('#ef4444');
    ctx.setFontSize(12);
    ctx.fillText('R', rX + 6, axisY - 16);

    ctx.draw();
  },
});
