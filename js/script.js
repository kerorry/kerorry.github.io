console.log('script.js 已加载');

function getRootPath() {
  const scripts = document.getElementsByTagName('script');
  for (let i = 0; i < scripts.length; i++) {
    const src = scripts[i].src;
    if (src && src.indexOf('script.js') !== -1) {
      const match = src.match(/^(.*\/)js\/script\.js/);
      if (match) return match[1];
    }
  }
  const path = window.location.pathname;
  const dirPath = path.substring(0, path.lastIndexOf('/') + 1);
  const parts = dirPath.split('/').filter((p) => p && p.length > 0);
  const depth = parts.length;
  return depth === 0 ? './' : '../'.repeat(depth);
}

const ROOT_PATH = getRootPath();
console.log('网站根路径:', ROOT_PATH);

(function setFavicon() {
  const link = document.querySelector('link[rel="icon"]');
  if (link) {
    link.href = ROOT_PATH + 'favicon.ico';
  } else {
    const newLink = document.createElement('link');
    newLink.rel = 'icon';
    newLink.href = ROOT_PATH + 'favicon.ico';
    document.head.appendChild(newLink);
  }
})();

/* ---------------- SPA 路由 ---------------- */
const SPA = {
  navigating: false,

  ANIM_OUT: 250,
  ANIM_IN: 300,
  SLIDE_PX: 40,

  pageStyles: [],
  pageScripts: [],

  baseStyles: [
    'css/style.css',
    'css/skeleton.css',
    'css/article.css',
    'css/info.css',
    'css/top.css',
    'css/sidebar.css',
    'font-awesome',
  ],

  isExternal(url) {
    try {
      return (
        new URL(url, window.location.href).origin !== window.location.origin
      );
    } catch {
      return true;
    }
  },

  isSamePage(url) {
    try {
      const a = new URL(url, window.location.href);
      const b = new URL(window.location.href);
      return a.pathname === b.pathname && a.search === b.search;
    } catch {
      return false;
    }
  },

  isBaseStyle(href) {
    return this.baseStyles.some((k) => href.includes(k));
  },

  clearPageAssets() {
    this.pageStyles.forEach((el) => el.remove());
    this.pageScripts.forEach((el) => el.remove());
    this.pageStyles = [];
    this.pageScripts = [];
  },

  injectStyles(doc, baseUrl) {
    const links = doc.querySelectorAll('link[rel="stylesheet"]');
    links.forEach((link) => {
      const href = link.getAttribute('href');
      if (!href) return;
      if (this.isBaseStyle(href)) return;

      const resolved = new URL(href, baseUrl).href;
      if (document.querySelector(`link[href="${resolved}"]`)) return;

      const newLink = document.createElement('link');
      newLink.rel = 'stylesheet';
      newLink.href = resolved;
      document.head.appendChild(newLink);
      this.pageStyles.push(newLink);
    });
  },

  executeExternalScripts(doc, baseUrl) {
    const scripts = doc.querySelectorAll('script[src]');
    scripts.forEach((old) => {
      const src = old.getAttribute('src');
      if (!src) return;

      if (/\/js\/load-css\.js(\?|$)/.test(src)) return;
      if (old.closest('.main-content')) return;

      const resolved = new URL(src, baseUrl).href;

      const s = document.createElement('script');
      s.src = resolved;
      if (old.type) s.type = old.type;
      s.async = false;
      document.head.appendChild(s);
      this.pageScripts.push(s);
    });
  },

  executeInlineScripts(container, baseUrl) {
    const scripts = container.querySelectorAll('script');
    scripts.forEach((old) => {
      const s = document.createElement('script');
      for (const attr of old.attributes) {
        s.setAttribute(attr.name, attr.value);
      }
      s.textContent = old.textContent;
      s.async = false;

      if (old.getAttribute('src')) {
        s.src = new URL(old.getAttribute('src'), baseUrl).href;
        document.head.appendChild(s);
        this.pageScripts.push(s);
      } else {
        old.parentNode.replaceChild(s, old);
      }
    });
  },

  animateOut(el) {
    const px = this.SLIDE_PX;
    const anim = el.animate(
      [
        { opacity: 1, transform: 'translateX(0)' },
        { opacity: 0, transform: `translateX(${px}px)` },
      ],
      {
        duration: this.ANIM_OUT,
        easing: 'cubic-bezier(0.4, 0, 1, 1)',
        fill: 'forwards',
      }
    );
    return anim.finished.catch(() => {});
  },

  animateIn(el) {
    const px = this.SLIDE_PX;
    const anim = el.animate(
      [
        { opacity: 0, transform: `translateX(${px}px)` },
        { opacity: 1, transform: 'translateX(0)' },
      ],
      {
        duration: this.ANIM_IN,
        easing: 'cubic-bezier(0, 0, 0.2, 1)',
        fill: 'forwards',
      }
    );
    return anim.finished.catch(() => {});
  },

  cancelAnimations(el) {
    if (typeof el.getAnimations === 'function') {
      el.getAnimations().forEach((a) => {
        try {
          a.cancel();
        } catch (_) {}
      });
    }
  },

  async navigate(url, push = true) {
    if (this.navigating) return;
    this.navigating = true;

    try {
      const targetUrl = new URL(url, window.location.href);

      if (targetUrl.origin !== window.location.origin) {
        window.location.href = targetUrl.href;
        return;
      }

      if (this.isSamePage(targetUrl.href)) return;

      const res = await fetch(targetUrl.href);
      if (!res.ok) throw new Error('HTTP ' + res.status);

      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');

      const newMain = doc.querySelector('.main-content');
      const currentMain = document.querySelector('.main-content');

      if (!newMain || !currentMain) {
        window.location.href = targetUrl.href;
        return;
      }

      document.dispatchEvent(new CustomEvent('spa:before-navigate'));

      this.cancelAnimations(currentMain);

      // 1. 旧内容右滑淡出
      await this.animateOut(currentMain);

      // 2. 清理旧资源 + 注入新样式
      this.clearPageAssets();
      this.injectStyles(doc, targetUrl.href);

      // 3. 换掉主内容
      currentMain.innerHTML = newMain.innerHTML;

      // 4. 同步 body class / title / 地址栏
      document.body.className = doc.body.className;
      if (doc.title) document.title = doc.title;

      if (push) {
        history.pushState(
          { spa: true },
          '',
          targetUrl.pathname + targetUrl.search + targetUrl.hash
        );
      }

      // 5. ★ 关键：让 PageManager 同步插入骨架屏（在滑入之前！）
      if (window.PageManager && PageManager.prepareContent) {
        PageManager.prepareContent();
      }

      // 6. 新内容（带骨架屏）右滑淡入
      await this.animateIn(currentMain);
      this.cancelAnimations(currentMain);

      // 7. 注入并执行脚本
      this.executeExternalScripts(doc, targetUrl.href);
      this.executeInlineScripts(currentMain, targetUrl.href);

      // 8. 加载数据
      if (window.PageManager && PageManager.initContent) {
        await PageManager.initContent();
      }

      document.dispatchEvent(
        new CustomEvent('spa:content-loaded', {
          detail: { url: targetUrl.href },
        })
      );

      window.scrollTo({ top: 0 });
    } catch (e) {
      console.error('[SPA] 导航失败，回退整页跳转', e);
      window.location.href = url;
    } finally {
      this.navigating = false;
    }
  },
};

/* 导航辅助函数 */
async function navigateTo(target) {
  const isLocal =
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1' ||
    location.protocol === 'file:';

  let finalTarget = target;
  if (
    isLocal &&
    target &&
    !target.endsWith('.html') &&
    !target.endsWith('/')
  ) {
    finalTarget = target + '.html';
  }

  console.log('跳转到:', finalTarget);
  await SPA.navigate(finalTarget);
}

window.navigateTo = navigateTo;

/* ---------------- PageManager ---------------- */
const PageManager = {
  allArticles: [],
  searchText: '',
  activeTags: [],
  listContainer: null,
  currentPage: 1,
  pageSize: 10,
  totalPages: 0,
  filteredArticles: [],

  // ★ 新增：localStorage 缓存键
  TAGS_CACHE_KEY: 'all_tags',

  async init() {
    await this.loadWallpaper();

    await Promise.all([
      this.loadTop(),
      this.loadSidebar(),
      this.loadFooter(),
    ]);

    await this.loadArticleCount();
    this.bindHamburger();
    this.bindPopState();

    await this.initContent();
  },

  /* ★ 新增：同步准备内容（重置状态 + 插入骨架屏 + 同步渲染缓存标签） */
  prepareContent() {
    // 重置与主内容相关的状态
    this.allArticles = [];
    this.searchText = '';
    this.activeTags = [];
    this.listContainer = null;
    this.currentPage = 1;
    this.totalPages = 0;
    this.filteredArticles = [];

    this.bindBackButton();

    const path = window.location.pathname.split('/').pop() || 'index.html';
    const baseName = path.replace(/\.html$/, '');

    // 文章列表页：同步插入骨架屏，让它跟着主内容一起滑入
    if (baseName === 'article') {
      const listSection = document.querySelector('#list-section');
      // 幂等：已经有骨架屏就不再插
      if (listSection && !listSection.querySelector('.skeleton')) {
        listSection.innerHTML = `
          <div class="article-list">
            ${[1, 2, 3]
              .map(
                () => `
              <article class="post glass-ground blog-post">
                <div class="skeleton skeleton-title"></div>
                <div class="skeleton skeleton-meta"></div>
                <div class="skeleton skeleton-line"></div>
                <div class="skeleton skeleton-line short"></div>
                <div class="skeleton skeleton-button"></div>
              </article>
            `
              )
              .join('')}
          </div>
        `;
      }

      // ★ 新增：同步渲染缓存标签，避免搜索卡片高度跳动
      const tagsFilter = document.querySelector('#tags-filter');
      if (tagsFilter && !tagsFilter.children.length) {
        try {
          const cached = localStorage.getItem(this.TAGS_CACHE_KEY);
          const tags = cached ? JSON.parse(cached) : null;
          if (Array.isArray(tags) && tags.length) {
            tagsFilter.innerHTML = tags
              .map(
                (tag) =>
                  `<span class="tag-filter-item" data-tag="${tag}">${tag}</span>`
              )
              .join('');
          }
        } catch (_) {}
      }
    }
  },

  /* 异步加载数据（骨架屏已在 prepareContent 里插好） */
  async initContent() {
    // 首次加载时 prepareContent 还没跑过，这里兜底一次（幂等）
    this.prepareContent();

    const path = window.location.pathname.split('/').pop() || 'index.html';
    const baseName = path.replace(/\.html$/, '');
    if (baseName === 'article') {
      await this.loadArticleList();
    }
  },

  bindPopState() {
    window.addEventListener('popstate', () => {
      SPA.navigate(window.location.href, false);
    });
  },

  async loadTop() {
    const container = document.getElementById('top-container');
    if (!container) return;

    try {
      const res = await fetch(ROOT_PATH + 'top.html');
      if (!res.ok) throw new Error('Top 加载失败');
      const html = await res.text();
      container.innerHTML = html;
    } catch (error) {
      console.error('加载 top 出错:', error);
      container.innerHTML =
        '<div class="top glass-ground">顶部加载失败</div>';
    }
  },

  async loadSidebar() {
    const container = document.getElementById('sidebar-container');
    if (!container) return;

    try {
      const res = await fetch(ROOT_PATH + 'sidebar.html');
      if (!res.ok) throw new Error('Sidebar 加载失败');
      const html = await res.text();
      container.innerHTML = html;
      await this.initGitHubData();
      this.bindEvents();
    } catch (error) {
      console.error('加载 sidebar 出错:', error);
      container.innerHTML =
        '<aside class="sidebar glass-ground">侧边栏加载失败</aside>';
    }
  },

  async loadArticleCount() {
    try {
      const res = await fetch(ROOT_PATH + 'articles.json');
      if (!res.ok) throw new Error('加载文章列表失败');
      const articles = await res.json();
      const el = document.getElementById('stat-articles');
      if (el) el.textContent = articles.length;
    } catch (error) {
      console.error('获取文章数量失败:', error);
    }
  },

  async loadFooter() {
    const container = document.getElementById('footer-container');
    if (!container) return;

    try {
      const res = await fetch(ROOT_PATH + 'footer.html');
      if (!res.ok) throw new Error('Footer 加载失败');
      const html = await res.text();
      container.innerHTML = html;
    } catch (error) {
      console.error('加载 footer 出错:', error);
      container.innerHTML =
        '<footer class="glass-ground"><p>页脚加载失败</p></footer>';
    }
  },

  async fetchAndCacheGitHubData(cacheKey) {
    try {
      const username = 'kerorry';
      const headers = { 'User-Agent': 'Kerorry-Blog' };
      const [userRes, reposRes] = await Promise.all([
        fetch(`https://api.github.com/users/${username}`, { headers }),
        fetch(
          `https://api.github.com/users/${username}/repos?per_page=100`,
          { headers }
        ),
      ]);

      if (!userRes.ok || !reposRes.ok) {
        throw new Error('GitHub API 请求失败');
      }

      const userData = await userRes.json();
      const reposData = await reposRes.json();
      const totalStars = reposData.reduce(
        (sum, repo) => sum + repo.stargazers_count,
        0
      );

      const stats = {
        repoCount: reposData.length,
        starCount: totalStars,
        followersCount: userData.followers || 0,
      };

      localStorage.setItem(
        cacheKey,
        JSON.stringify({ data: stats, timestamp: Date.now() })
      );

      this.updateGitHubStats(
        stats.repoCount,
        stats.starCount,
        stats.followersCount
      );
    } catch (error) {
      console.error('GitHub 数据获取失败', error);
    }
  },

  async initGitHubData() {
    const CACHE_KEY = 'github_stats';
    const CACHE_EXPIRE = 3600000;
    const cached = localStorage.getItem(CACHE_KEY);

    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached);
        if (data) {
          this.updateGitHubStats(
            data.repoCount,
            data.starCount,
            data.followersCount
          );
        }
        if (Date.now() - timestamp < CACHE_EXPIRE) {
          console.log('GitHub 数据来自缓存');
          return;
        }
      } catch (_) {}
    }

    await this.fetchAndCacheGitHubData(CACHE_KEY);
  },

  updateGitHubStats(repoCount, starCount, followersCount) {
    const reposEl = document.getElementById('stat-repos');
    const starsEl = document.getElementById('stat-stars');
    const followersEl = document.getElementById('stat-followers');

    if (reposEl && starsEl && followersEl) {
      reposEl.textContent = repoCount;
      starsEl.textContent = starCount;
      followersEl.textContent = followersCount;
    }
  },

  async loadArticleList() {
    const container = document.querySelector('#article-list-container');
    if (!container) return;

    const searchInput = container.querySelector('#search-input');
    const tagsFilter = container.querySelector('#tags-filter');
    const listSection = container.querySelector('#list-section');
    if (!listSection) return;

    this.listContainer = listSection;

    // 事件只绑定一次（SPA 每次替换 DOM，容器是新元素，dataset 会重置）
    if (container.dataset.bound !== '1') {
      container.dataset.bound = '1';

      container.addEventListener('click', (e) => {
        const link = e.target.closest('a.read-more');
        if (link && link.href) {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          window.navigateTo(link.href);
          return;
        }

        const btn = e.target.closest('.pagination-btn');
        if (btn && btn.dataset.page) {
          e.preventDefault();
          this.handlePaginationClick(btn.dataset.page);
        }
      });
    }

    // ★ 不再插骨架屏 —— 骨架屏已经在 prepareContent 里跟着 SPA 滑入
    // ★ 标签也已经由 prepareContent 同步渲染（若有缓存）

    try {
      const res = await fetch(ROOT_PATH + 'articles.json');
      if (!res.ok) throw new Error('加载文章列表失败');
      const articles = await res.json();
      this.allArticles = articles;

      const tagSet = new Set();
      this.allArticles.forEach((article) => {
        if (article.tags && Array.isArray(article.tags)) {
          article.tags.forEach((t) => tagSet.add(t));
        }
      });
      const allTags = Array.from(tagSet);

      // ★ 新增：把标签写入 localStorage，供下次 SPA 切页同步渲染
      try {
        localStorage.setItem(this.TAGS_CACHE_KEY, JSON.stringify(allTags));
      } catch (_) {}

      if (tagsFilter) {
        tagsFilter.innerHTML = allTags
          .map(
            (tag) =>
              `<span class="tag-filter-item" data-tag="${tag}">${tag}</span>`
          )
          .join('');

        if (tagsFilter.dataset.bound !== '1') {
          tagsFilter.dataset.bound = '1';
          tagsFilter.addEventListener('click', (e) => {
            const target = e.target.closest('.tag-filter-item');
            if (!target) return;
            const tag = target.dataset.tag;
            if (!tag) return;

            target.classList.toggle('active');
            this.activeTags = Array.from(
              tagsFilter.querySelectorAll('.tag-filter-item.active')
            ).map((el) => el.dataset.tag);

            this.filterAndRender(true);
          });
        }
      }

      if (searchInput) {
        if (searchInput.dataset.bound !== '1') {
          searchInput.dataset.bound = '1';
          searchInput.addEventListener('input', (e) => {
            this.searchText = e.target.value.trim();
            this.filterAndRender(true);
          });
        }
      }

      // ★ 直接渲染，不再做 fade-out / 等 300ms / fade-in 那一套
      this.filterAndRender(true);

      // 给刚渲染出来的真内容一个轻微的淡入，让替换不那么突兀
      this.listContainer.classList.remove('fade-in');
      // 强制重排，确保 fade-in 动画会重新触发
      void this.listContainer.offsetWidth;
      this.listContainer.classList.add('fade-in');
      setTimeout(() => {
        if (this.listContainer) {
          this.listContainer.classList.remove('fade-in');
        }
      }, 250);
    } catch (error) {
      console.error('加载文章列表失败:', error);
      listSection.innerHTML =
        '<p style="color:white; padding:20px;">加载失败，请稍后重试。</p>';
    }
  },

  filterAndRender(resetPage = true) {
    if (!this.listContainer) return;
    if (resetPage) this.currentPage = 1;

    const filtered = this.allArticles.filter((article) => {
      let matchText = true;

      if (this.searchText) {
        const text = this.searchText.toLowerCase();
        const title = (article.title || '').toLowerCase();
        const summary = (article.summary || '').toLowerCase();
        const author = (article.author || '').toLowerCase();
        const date = (article.date || '').toLowerCase();

        matchText =
          title.includes(text) ||
          summary.includes(text) ||
          author.includes(text) ||
          date.includes(text);
      }

      if (!matchText) return false;

      if (this.activeTags.length > 0) {
        const articleTags = article.tags || [];
        const hasAny = this.activeTags.some((tag) =>
          articleTags.includes(tag)
        );
        if (!hasAny) return false;
      }

      return true;
    });

    this.filteredArticles = filtered;
    this.totalPages = Math.ceil(filtered.length / this.pageSize) || 1;

    if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;
    if (this.currentPage < 1) this.currentPage = 1;

    const start = (this.currentPage - 1) * this.pageSize;
    const end = Math.min(start + this.pageSize, filtered.length);
    const pageArticles = filtered.slice(start, end);

    this.renderArticleList(pageArticles);
    this.renderPagination();
  },

  renderArticleList(articles) {
    if (!this.listContainer) return;

    if (articles.length === 0) {
      this.listContainer.innerHTML = `
        <p style="color: rgba(255,255,255,0.7); padding: 20px; text-align: center;">
          没有找到匹配的文章
        </p>
      `;
      return;
    }

    const listHtml = `
      <div class="article-list">
        ${articles
          .map((article) => {
            const link = `${article.file}`;
            return `
              <article class="post glass-ground blog-post">
                <h2 class="post-title">${article.title || '无标题'}</h2>
                <div class="post-meta">
                  <span><i class="far fa-calendar"></i> ${article.date || ''}</span>
                  <span><i class="far fa-user"></i> ${article.author || '未知'}</span>
                  ${
                    article.tags && article.tags.length
                      ? `<span><i class="fas fa-tags"></i> ${article.tags.join('、')}</span>`
                      : ''
                  }
                </div>
                ${
                  article.summary
                    ? `<div class="post-content"><p>${article.summary}</p></div>`
                    : ''
                }
                <a href="${link}" class="read-more" data-target="${link}">查看全文 -></a>
              </article>
            `;
          })
          .join('')}
      </div>
    `;

    this.listContainer.innerHTML = listHtml;
  },

  renderPagination() {
    const container = document.getElementById('pagination-container');
    const line = document.getElementById('pagination-line');
    if (!container || !line) return;

    const total = this.totalPages;
    const current = this.currentPage;

    container.style.display = 'flex';
    line.style.display = 'block';

    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    if (prevBtn) prevBtn.disabled = current === 1;
    if (nextBtn) nextBtn.disabled = current === total;

    const pages = this.generatePages(current, total);
    const pagesContainer = document.getElementById('pagination-pages');
    if (!pagesContainer) return;

    pagesContainer.innerHTML = pages
      .map((p) => {
        if (p === '...') {
          return `<span class="pagination-ellipsis">…</span>`;
        }
        const active = p === current ? 'active' : '';
        return `<button class="pagination-btn ${active}" data-page="${p}">${p}</button>`;
      })
      .join('');
  },

  async loadWallpaper() {
    try {
      const res = await fetch(ROOT_PATH + 'wallpaper.json');
      if (!res.ok) throw new Error('加载壁纸列表失败');
      const wallpapers = await res.json();
      if (wallpapers.length === 0) return;

      const randomIndex = Math.floor(Math.random() * wallpapers.length);
      const wallpaper = wallpapers[randomIndex];
      const imgUrl = ROOT_PATH + wallpaper.file;

      document.body.style.backgroundImage = `url(${imgUrl})`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';
      document.body.style.backgroundAttachment = 'fixed';
      document.body.style.backgroundColor = '#f0f2f5';

      const styleId = 'bg-overlay-style';
      let styleEl = document.getElementById(styleId);
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
      }

      const gradient = 'linear-gradient(135deg, #e0e5ec, #f5f7fa)';
      styleEl.textContent = `
        body::before {
          content: '';
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: ${gradient};
          transition: opacity 0.8s ease;
          opacity: 1;
          pointer-events: none;
          z-index: 0;
        }
      `;

      const img = new Image();
      img.onload = () => {
        styleEl.textContent = styleEl.textContent.replace(
          'opacity: 1;',
          'opacity: 0;'
        );
      };
      img.onerror = () => {
        styleEl.textContent = styleEl.textContent.replace(
          'opacity: 1;',
          'opacity: 0;'
        );
      };
      img.src = imgUrl;
    } catch (error) {
      console.warn('壁纸加载失败，使用默认渐变', error);
      document.body.style.backgroundImage =
        'linear-gradient(135deg, #e0e5ec, #f5f7fa)';
      document.body.style.backgroundColor = '';
    }
  },

  generatePages(current, total) {
    const pages = [];
    const maxVisible = 5;

    if (total <= maxVisible) {
      for (let i = 1; i <= total; i++) pages.push(i);
      return pages;
    }

    pages.push(1);

    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);

    if (start > 2) pages.push('...');
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < total - 1) pages.push('...');

    pages.push(total);
    return pages;
  },

  handlePaginationClick(action) {
    if (action === 'prev') {
      if (this.currentPage <= 1) return;
      this.currentPage--;
    } else if (action === 'next') {
      if (this.currentPage >= this.totalPages) return;
      this.currentPage++;
    } else {
      const page = parseInt(action, 10);
      if (isNaN(page) || page < 1 || page > this.totalPages) return;
      if (page === this.currentPage) return;
      this.currentPage = page;
    }

    this.filterAndRender(false);

    if (this.listContainer) {
      this.listContainer.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  },

  bindEvents() {
    const menuContainer = document.querySelector('.menu-links');
    if (!menuContainer) return;

    menuContainer.addEventListener('click', (event) => {
      const li = event.target.closest('li');
      if (!li) return;

      const target = li.dataset.target;
      if (!target) return;

      if (
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.button !== 0
      )
        return;

      event.preventDefault();
      window.navigateTo(ROOT_PATH + target);
    });
  },

  bindBackButton() {
    const backLink = document.getElementById('back-article-link');
    if (!backLink) return;

    const target = ROOT_PATH + 'article.html';
    backLink.href = target;

    if (backLink.dataset.bound === '1') return;
    backLink.dataset.bound = '1';

    backLink.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      window.navigateTo(target);
    });
  },

  bindHamburger() {
    const hamburger = document.getElementById('hamburgerBtn');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    if (!hamburger || !sidebar || !overlay) {
      console.warn('汉堡菜单元素未找到，可能不在移动端');
      return;
    }

    function toggleSidebar() {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('active');
      document.body.classList.toggle('no-scroll');

      const icon = hamburger.querySelector('i');
      if (icon) {
        icon.className = sidebar.classList.contains('open')
          ? 'fas fa-times'
          : 'fas fa-bars';
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
  },
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM 已加载，初始化...');
    PageManager.init();
  });
} else {
  console.log('DOM 已就绪，初始化...');
  PageManager.init();
}

window.PageManager = PageManager;
window.SPA = SPA;