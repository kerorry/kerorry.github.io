/* ============================================================
   博客背景 · 满屏横线 + 原子
   依赖：css/wallpaper.css 中的 --ink / --line-opacity 变量
   要求：页面中存在 <canvas id="bg">
   ============================================================ */

(() => {
  // 幂等保护：SPA 切页 / 重复引入时不会再叠一层动画循环
  if (window.__bgCanvasInit) return;

  const canvas = document.getElementById('bg');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  window.__bgCanvasInit = true;

  /* ---------------- 可调参数 ---------------- */
  const CONFIG = {
    rowGap:        52,           // 横线间距（px）
    atomsPerLine:  [2, 5],       // 每条线上原子数量范围
    radius:        [1.2, 3.2],   // 原子半径范围（px）
    speed:         [4, 18],      // 移动速度范围（px / 秒）
    atomAlpha:     [0.15, 0.45], // 原子透明度范围
    ringChance:    0.28,         // 空心环（轨道感）比例
    lineAlphaVar:  [0.6, 1],     // 每条横线的透明度浮动系数
    edgePadding:   6             // 原子移出屏幕外多少像素后折返
  };
  /* ------------------------------------------ */

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W = 0, H = 0, dpr = 1;
  let lines = [];
  let ink = '0,0,0';
  let lineAlpha = 0.07;
  let last = 0;

  const rand = (a, b) => a + Math.random() * (b - a);

  /* 读取 CSS 变量里的配色 */
  function readTheme() {
    const s = getComputedStyle(document.documentElement);
    ink = s.getPropertyValue('--ink').trim() || '0,0,0';
    lineAlpha = parseFloat(s.getPropertyValue('--line-opacity')) || 0.07;
  }

  /* 生成所有横线与其上的原子 */
  function buildLines() {
    lines = [];
    const gap = CONFIG.rowGap;
    const rows = Math.floor(H / gap) + 1;
    const padTop = (H - (rows - 1) * gap) / 2;   // 让线组垂直居中

    for (let i = 0; i < rows; i++) {
      const y = padTop + i * gap;

      const n = Math.round(rand(CONFIG.atomsPerLine[0], CONFIG.atomsPerLine[1]));
      const atoms = [];
      for (let j = 0; j < n; j++) {
        const dir = Math.random() < 0.5 ? -1 : 1;
        atoms.push({
          x: Math.random() * W,
          r: rand(CONFIG.radius[0], CONFIG.radius[1]),
          v: rand(CONFIG.speed[0], CONFIG.speed[1]) * dir,
          alpha: rand(CONFIG.atomAlpha[0], CONFIG.atomAlpha[1]),
          ring: Math.random() < CONFIG.ringChance
        });
      }

      lines.push({
        y,
        a: rand(CONFIG.lineAlphaVar[0], CONFIG.lineAlphaVar[1]), // 每条线深浅略不同
        atoms
      });
    }
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;

    canvas.width  = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildLines();
  }

  function render(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (!isFinite(dt) || dt < 0) dt = 0;
    dt = Math.min(dt, 0.05);            // 切标签页回来时防止跳变
    if (reduceMotion) dt = 0;           // 尊重系统「减弱动态效果」

    ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = 1;

    for (const line of lines) {
      /* 1. 横线 */
      ctx.strokeStyle = `rgba(${ink}, ${(lineAlpha * line.a).toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(0, line.y);
      ctx.lineTo(W, line.y);
      ctx.stroke();

      /* 2. 线上的原子 */
      const pad = CONFIG.edgePadding;
      for (const at of line.atoms) {
        at.x += at.v * dt;

        // 出界折返
        if (at.x < -pad) { at.x = -pad; at.v = Math.abs(at.v); }
        else if (at.x > W + pad) { at.x = W + pad; at.v = -Math.abs(at.v); }

        if (at.ring) {
          // 空心环：横线从中间穿过，像串在轨道上
          ctx.strokeStyle = `rgba(${ink}, ${(at.alpha * 0.6).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(at.x, line.y, at.r + 1.8, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          // 实心小点
          ctx.fillStyle = `rgba(${ink}, ${at.alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(at.x, line.y, at.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    requestAnimationFrame(render);
  }

  /* ---------------- 启动 ---------------- */
  readTheme();
  resize();
  requestAnimationFrame(t => { last = t; render(t); });

  // 窗口尺寸变化（防抖重建）
  let rt;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(resize, 150);
  });

  // 系统深浅色切换时更新配色
  const mq = matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', readTheme);

  // 顶栏的白天 / 黑夜开关切换时更新配色（js/theme.js 派发）
  document.addEventListener('themechange', readTheme);
})();
