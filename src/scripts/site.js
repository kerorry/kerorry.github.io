/**
 * 全站公共脚本：随机壁纸、GitHub 统计、移动端汉堡菜单。
 *
 * 由 BaseLayout 通过 Astro 的 <script> 引入，走 Vite 打包（压缩 + 内容哈希），
 * 不再是 public/ 下手写的静态文件。
 *
 * 壁纸列表原本每次运行时 fetch /wallpaper.json，现在直接由 Vite 把
 * data/wallpapers.json 打进包里，少一次请求。
 * （/wallpaper.json 端点仍保留，作为站点原有的公开数据接口。）
 */

import wallpapers from '@/data/wallpapers.json';

/** 随机挑一张壁纸，加载完成后淡出渐变占位层（body::before）。 */
function loadWallpaper() {
  if (!Array.isArray(wallpapers) || wallpapers.length === 0) return;

  const pick = wallpapers[Math.floor(Math.random() * wallpapers.length)];
  const imageUrl = '/' + String(pick.file || '').replace(/^\/+/, '');
  const image = new Image();

  image.onload = () => {
    document.body.style.setProperty('--wallpaper-url', `url("${imageUrl}")`);
    document.body.classList.add('wallpaper-loaded');
    console.log('[壁纸] 已显示（' + performance.now().toFixed(0) + 'ms）');
  };

  image.onerror = () => {
    console.warn('[壁纸] 加载失败：' + imageUrl);
    document.body.classList.add('wallpaper-loaded');
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

  await fetchAndCacheGitHubData(CACHE_KEY);
}

function bindHamburger() {
  const hamburger = document.getElementById('hamburgerBtn');
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebarOverlay');

  if (!hamburger || !sidebar || !overlay) return;

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
}
