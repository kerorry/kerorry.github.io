(function() {
    const container = document.getElementById('sunlight-widget');
    if (!container) return;

    const canvas = document.getElementById('sw-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = 800, H = 400;
    canvas.width = W;
    canvas.height = H;

    const timeEl = document.getElementById('sw-time');
    const subEl = document.getElementById('sw-subsolar');

    // ---------- 等距圆柱投影（纯数学） ----------
    function project(lon, lat) {
        return [(lon + 180) / 360 * W, (90 - lat) / 180 * H];
    }
    function invert(x, y) {
        return { lon: x / W * 360 - 180, lat: 90 - y / H * 180 };
    }

    // ---------- 太阳位置（基于UTC，含经度修正） ----------
    function getSolarDeclination(dayOfYear) {
        return 23.44 * Math.sin((284 + dayOfYear) * 360 / 365 * Math.PI / 180);
    }

    function getSolarElevation(lon, lat, date) {
        const start = new Date(Date.UTC(date.getFullYear(), 0, 0));
        const diff = date - start;
        const dayOfYear = Math.floor(diff / 86400000) + 1;
        const declination = getSolarDeclination(dayOfYear);
        const hoursUTC = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
        const hourAngle = (hoursUTC + lon / 15 - 12) * 15 * Math.PI / 180;
        const latRad = lat * Math.PI / 180;
        const decRad = declination * Math.PI / 180;
        const sinAlt = Math.sin(latRad) * Math.sin(decRad) +
                       Math.cos(latRad) * Math.cos(decRad) * Math.cos(hourAngle);
        return Math.asin(Math.max(-1, Math.min(1, sinAlt)));
    }

    function getSubsolarPoint(date) {
        const start = new Date(Date.UTC(date.getFullYear(), 0, 0));
        const diff = date - start;
        const dayOfYear = Math.floor(diff / 86400000) + 1;
        const declination = getSolarDeclination(dayOfYear);
        const hoursUTC = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
        const lon = (hoursUTC - 12) * 15;
        return { lat: declination, lon: lon };
    }

    // ---------- 渲染光照（逐像素） ----------
    function renderSunlight(date) {
        const imageData = ctx.createImageData(W, H);
        const data = imageData.data;

        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const { lon, lat } = invert(x, y);
                const elev = getSolarElevation(lon, lat, date);
                const elevDeg = elev * 180 / Math.PI;

                let r, g, b;
                if (elevDeg > 0) {
                    // 白天：高度角从 0° → 90°，颜色从冷蓝 → 暖黄
                    const intensity = Math.min(1, elevDeg / 90);
                    const r1 = 74, g1 = 144, b1 = 217; // 冷蓝（低角度）
                    const r2 = 255, g2 = 215, b2 = 0;   // 金黄（高角度，直射点）
                    r = r1 + (r2 - r1) * intensity;
                    g = g1 + (g2 - g1) * intensity;
                    b = b1 + (b2 - b1) * intensity;
                } else {
                    // 夜晚：越暗越深蓝
                    const intensity = Math.min(1, -elevDeg / 90);
                    const r1 = 10, g1 = 10, b1 = 50;
                    r = r1 * (1 - intensity);
                    g = g1 * (1 - intensity);
                    b = b1 * (1 - intensity);
                }
                const idx = (y * W + x) * 4;
                data[idx] = Math.round(Math.max(0, Math.min(255, r)));
                data[idx+1] = Math.round(Math.max(0, Math.min(255, g)));
                data[idx+2] = Math.round(Math.max(0, Math.min(255, b)));
                data[idx+3] = 255;
            }
        }
        ctx.putImageData(imageData, 0, 0);

        if (mapData) drawOutline();
        drawGrid();
    }

    // ---------- 经纬网格线 ----------
    function drawGrid() {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 0.5;
        for (let lon = -180; lon <= 180; lon += 30) {
            const [x1, y1] = project(lon, -90);
            const [x2, y2] = project(lon, 90);
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
        for (let lat = -90; lat <= 90; lat += 30) {
            const [x1, y1] = project(-180, lat);
            const [x2, y2] = project(180, lat);
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1.2;
        const [xEq1, yEq] = project(-180, 0);
        const [xEq2, yEq2] = project(180, 0);
        ctx.beginPath();
        ctx.moveTo(xEq1, yEq);
        ctx.lineTo(xEq2, yEq2);
        ctx.stroke();
        ctx.restore();
    }

    // ---------- 国家轮廓（白色半透明，所有背景可见） ----------
    let mapData = null;
    function loadMapData() {
        return d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
            .then(data => { mapData = data; })
            .catch(err => console.warn('国家轮廓加载失败，网格线仍将显示', err));
    }

    function drawOutline() {
        if (!mapData) return;
        try {
            const countries = topojson.feature(mapData, mapData.objects.countries);
            const projection = d3.geoEquirectangular()
                .scale(W / (2 * Math.PI))
                .translate([W / 2, H / 2]);
            const pathGen = d3.geoPath().projection(projection).context(ctx);
            ctx.save();
            ctx.lineWidth = 1.2;
            ctx.strokeStyle = 'rgba(255,255,255,0.7)';
            ctx.fillStyle = 'rgba(0,0,0,0)';
            countries.features.forEach(f => {
                ctx.beginPath();
                pathGen(f);
                ctx.stroke();
            });
            ctx.restore();
        } catch(e) {
            console.warn('绘制轮廓失败', e);
        }
    }

    // ---------- 定时更新 ----------
    function update() {
        const now = new Date();
        timeEl.textContent = now.toUTCString();
        const sub = getSubsolarPoint(now);
        const latStr = sub.lat >= 0 ? sub.lat.toFixed(1) + '°N' : (-sub.lat).toFixed(1) + '°S';
        const lonStr = sub.lon >= 0 ? sub.lon.toFixed(1) + '°E' : (-sub.lon).toFixed(1) + '°W';
        subEl.textContent = `直射点 ${latStr}, ${lonStr}`;
        renderSunlight(now);
    }

    // ---------- 启动 ----------
    // 客户端路由切页时本脚本会重新执行（script 上标了 data-astro-rerun），
    // 先清掉上一次的定时器，避免反复进出本页时定时器不断累加。
    if (window.__sunlightTimer) {
        clearInterval(window.__sunlightTimer);
        window.__sunlightTimer = null;
    }

    const depsReady = () => typeof d3 !== 'undefined' && typeof topojson !== 'undefined';

    function start() {
        loadMapData().then(() => {
            update();
            window.__sunlightTimer = setInterval(update, 60000);
        }).catch(() => {
            update();
            window.__sunlightTimer = setInterval(update, 60000);
        });
    }

    // 仅画网格线 + 直射点，不依赖 d3 的降级路径。
    // （mapData 为 null 时 drawOutline 会直接 return，所以这里是安全的）
    function startWithoutOutline() {
        console.warn('[日照图] d3 / topojson 不可用，跳过国家轮廓');
        update();
        window.__sunlightTimer = setInterval(update, 60000);
    }

    // d3 / topojson 是 <head> 里的远程脚本：
    //  · 整页加载时它们是 defer，按文档顺序先于本脚本执行，没等到就说明加载失败；
    //  · 客户端切页时动态插入的脚本没有 defer 语义、加载顺序不保证，需要等它。
    // 用 readyState 区分这两种情况，避免整页加载时白白空等。
    (function waitForDeps(retries) {
        if (depsReady()) return start();

        const mayStillBeLoading = document.readyState === 'complete';
        if (!mayStillBeLoading || retries >= 50) return startWithoutOutline();

        setTimeout(() => waitForDeps(retries + 1), 100);
    })(0);
})();