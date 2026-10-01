/**
 * 全站公共脚本：随机壁纸、GitHub 统计、移动端汉堡菜单。
 *
 * 由 BaseLayout 通过 Astro 的 <script> 引入，走 Vite 打包（压缩 + 内容哈希），
 * 不再是 public/ 下手写的静态文件。
 *
 * 壁纸列表直接由 Vite 从 data/wallpapers.json 打进包里，不做运行时请求。
 */

import wallpapers from '@/data/wallpapers.json';

// 壁纸状态是挂在 <body> 上的（class="wallpaper-loaded" + 内联变量 --wallpaper-url）。
// 而 Astro 切页时会用新页面的 <body> 整个替换当前 body
// （swap-functions.js: oldElement.replaceWith(newElement)），这两个状态都会丢，
// body::before 那层不透明渐变随即重新盖住壁纸 —— 表现就是「切页后壁纸消失」。
// 所以这里自己记住选择结果，并在每次 swap 前写进「即将换上来的」新 body。
let wallpaperDecided = false;
let wallpaperUrl = null;

/** 把壁纸状态写到指定 body 上（当前 body，或 swap 前的新 body）。 */
function applyWallpaperState(body) {
  if (!wallpaperDecided) return;

  body.classList.add('wallpaper-loaded');
  if (wallpaperUrl) {
    body.style.setProperty('--wallpaper-url', `url("${wallpaperUrl}")`);
  }
}

// 必须在 swap 之前写入：视图转场是在 DOM 更新后拍「新状态」快照的，
// 若等 astro:page-load 再补，快照里已经是渐变，会先闪一下。
function carryWallpaperOver(event) {
  applyWallpaperState(event.newDocument.body);
}

/** 随机挑一张壁纸，加载完成后淡出渐变占位层（body::before）。 */
function loadWallpaper() {
  // 已经选过：切页后 body 是新的，把状态贴回去即可，不重新随机
  if (wallpaperDecided) {
    applyWallpaperState(document.body);
    return;
  }
  wallpaperDecided = true;

  if (!Array.isArray(wallpapers) || wallpapers.length === 0) return;

  const pick = wallpapers[Math.floor(Math.random() * wallpapers.length)];
  const imageUrl = '/' + String(pick.file || '').replace(/^\/+/, '');
  const image = new Image();

  image.onload = () => {
    wallpaperUrl = imageUrl;
    applyWallpaperState(document.body);
    console.log('[壁纸] 已显示（' + performance.now().toFixed(0) + 'ms）');
  };

  image.onerror = () => {
    console.warn('[壁纸] 加载失败：' + imageUrl);
    applyWallpaperState(document.body);
  };

  console.log('[壁纸] 加载：' + imageUrl);
  image.src = imageUrl;
}

function updateGitHubStats(repoCount, starCount, followersCount) {
  const reposEl = document.getElementById('stat-repos');
  const starsEl = document.getElementById('stat-stars');
  const followersEl = document.getElementById('stat-followers');

  if (reposEl && starsEl && followersEl) {
    reposEl.textContent = repoCount;
    starsEl.textContent = starCount;
    followersEl.textContent = followersCount;
  }
}

async function fetchAndCacheGitHubData(cacheKey) {
  try {
    const username = 'kerorry';
    const headers = { 'User-Agent': 'Kerorry-Blog' };
    const [userRes, reposRes] = await Promise.all([
      fetch(`https://api.github.com/users/${username}`, { headers }),
      fetch(`https://api.github.com/users/${username}/repos?per_page=100`, { headers }),
    ]);

    if (!userRes.ok || !reposRes.ok) {
      throw new Error('[GitHub] API 请求失败');
    }

    const userData = await userRes.json();
    const reposData = await reposRes.json();
    const totalStars = reposData.reduce((sum, repo) => sum + repo.stargazers_count, 0);

    const stats = {
      repoCount: reposData.length,
      starCount: totalStars,
      followersCount: userData.followers || 0,
    };

    localStorage.setItem(cacheKey, JSON.stringify({ data: stats, timestamp: Date.now() }));
    updateGitHubStats(stats.repoCount, stats.starCount, stats.followersCount);
  } catch (error) {
    console.error('[GitHub] 数据获取失败', error);
  }
}

// 一次整页加载只发起一次网络刷新：否则客户端切页时会反复打 GitHub API。
let githubRefreshStarted = false;

/** 先用 localStorage 缓存立即渲染，过期后再后台刷新。 */
async function initGitHubData() {
  const CACHE_KEY = 'github_stats';
  const CACHE_EXPIRE = 3600000;
  const cached = localStorage.getItem(CACHE_KEY);

  if (cached) {
    try {
      const { data, timestamp } = JSON.parse(cached);
      if (data) {
        updateGitHubStats(data.repoCount, data.starCount, data.followersCount);
      }
      if (Date.now() - timestamp < CACHE_EXPIRE) {
        console.log('[GitHub] 数据来自缓存');
        return;
      }
    } catch (_) {
      // 缓存损坏时重新请求
    }
  }

  if (githubRefreshStarted) return;
  githubRefreshStarted = true;

  await fetchAndCacheGitHubData(CACHE_KEY);
}

function bindHamburger() {
  const hamburger = document.getElementById('hamburgerBtn');
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebarOverlay');

  if (!hamburger || !sidebar || !overlay) return;
  // 客户端切页会整块换掉 DOM，新节点必须重新绑定；
  // 这个标记只防「同一批节点被重复绑定」——否则一次点击会 toggle 两次、菜单看起来打不开。
  if (hamburger.dataset.bound === '1') return;
  hamburger.dataset.bound = '1';

  function toggleSidebar() {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
    document.body.classList.toggle('no-scroll');

    const icon = hamburger.querySelector('i');
    if (icon) {
      icon.className = sidebar.classList.contains('open') ? 'fas fa-times' : 'fas fa-bars';
    }
  }

  hamburger.addEventListener('click', toggleSidebar);
  overlay.addEventListener('click', toggleSidebar);

  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
      document.body.classList.remove('no-scroll');

      const icon = hamburger.querySelector('i');
      if (icon) icon.className = 'fas fa-bars';
    }
  });
}

export function initSite() {
  loadWallpaper();
  initGitHubData();
  bindHamburger();

  // 同一个函数引用重复 addEventListener 会被浏览器忽略，所以每次 page-load
  // 都调用也不会重复注册。
  document.addEventListener('astro:before-swap', carryWallpaperOver);
}
