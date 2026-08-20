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

window.loading = {
    loadingAnimation: document.querySelector('.loading-wrapper'),
    in(target) {
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
        const wrapper = this.loadingAnimation;
        if (wrapper) wrapper.classList.add('show');
        setTimeout(() => {
            window.location.href = finalTarget;
        }, 400);
    },
};

const PageManager = {
    allArticles: [],
    searchText: '',
    activeTags: [],
    listContainer: null,
    currentPage: 1,
    pageSize: 10,
    totalPages: 0,
    filteredArticles: [],

    async init() {
        this.showLoading();
        await this.loadWallpaper();
        await Promise.all([
            this.loadTop(),
            this.loadSidebar(),
            this.loadFooter(),
            this.bindBackButton(),
        ]);
        await this.loadArticleCount();
        this.hideLoadingIfNeeded();
        this.bindHamburger();

        // 注册 pageshow 事件，解决浏览器后退时动画残留
        window.addEventListener('pageshow', (e) => {
            if (e.persisted) {
                this.hideLoadingIfNeeded();
            }
        });

        const path = window.location.pathname.split('/').pop() || 'index.html';
        const baseName = path.replace(/\.html$/, '');
        if (baseName === 'article') {
            await this.loadArticleList();
        }
    },

    async loadTop() {
        const container = document.getElementById('top-container');
        if (!container) return;

        try {
            const res = await fetch(ROOT_PATH + 'top.html');
            if (!res.ok) throw new Error('Top 加载失败');
            const html = await res.text();
            document.getElementById('top-container').innerHTML = html;
        } catch (error) {
            console.error('加载 top 出错:', error);
            document.getElementById('top-container').innerHTML =
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
            document.getElementById('sidebar-container').innerHTML = html;
            await this.initGitHubData();
            this.bindEvents();
        } catch (error) {
            console.error('加载 sidebar 出错:', error);
            document.getElementById('sidebar-container').innerHTML =
                '<aside class="sidebar glass-ground">侧边栏加载失败</aside>';
        }
    },

    async loadArticleCount() {
        try {
            const res = await fetch(ROOT_PATH + 'articles.json');
            if (!res.ok) throw new Error('加载文章列表失败');
            const articles = await res.json();
            const count = articles.length;
            const el = document.getElementById('stat-articles');
            if (el) el.textContent = count;
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
            document.getElementById('footer-container').innerHTML = html;
        } catch (error) {
            console.error('加载 footer 出错:', error);
            document.getElementById('footer-container').innerHTML =
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
            if (!userRes.ok || !reposRes.ok)
                throw new Error('GitHub API 请求失败');
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
                if (data)
                    this.updateGitHubStats(
                        data.repoCount,
                        data.starCount,
                        data.followersCount
                    );
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

    showLoading() {
        const wrapper = document.querySelector('.loading-wrapper');
        if (wrapper) wrapper.classList.add('show');
        document.body.classList.add('no-scroll');
    },

    async loadArticleList() {
        const container = document.querySelector('#article-list-container');
        if (!container) return;

        const searchInput = container.querySelector('#search-input');
        const tagsFilter = container.querySelector('#tags-filter');
        const listSection = container.querySelector('#list-section');
        if (!listSection) return;
        this.listContainer = listSection;

        container.addEventListener('click', (e) => {
            const link = e.target.closest('a.read-more');
            if (link && link.href) {
                e.preventDefault();
                window.loading.in(link.href);
                return;
            }
            const btn = e.target.closest('.pagination-btn');
            if (btn && btn.dataset.page) {
                e.preventDefault();
                this.handlePaginationClick(btn.dataset.page);
            }
        });

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
        container.classList.remove('fade-out', 'fade-in');

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

            if (tagsFilter) {
                tagsFilter.innerHTML = allTags
                    .map(
                        (tag) =>
                            `<span class="tag-filter-item" data-tag="${tag}">${tag}</span>`
                    )
                    .join('');

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

            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    this.searchText = e.target.value.trim();
                    this.filterAndRender(true);
                });
            }

            container.classList.add('fade-out');
            await new Promise((resolve) => setTimeout(resolve, 300));
            this.filterAndRender(true);
            container.classList.remove('fade-out');
            container.classList.add('fade-in');
            setTimeout(() => {
                container.classList.remove('fade-in');
            }, 300);
        } catch (error) {
            console.error('加载文章列表失败:', error);
            listSection.innerHTML =
                '<p style="color:white; padding:20px;">加载失败，请稍后重试。</p>';
            container.classList.remove('fade-out', 'fade-in');
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
                const hasAny = this.activeTags.some(tag => articleTags.includes(tag));
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
        ${articles.map(article => {
          // 文章目录链接
          const link = `${article.file}`;
          return `
            <article class="post glass-ground blog-post">
              <h2 class="post-title">${article.title || '无标题'}</h2>
              <div class="post-meta">
                <span><i class="far fa-calendar"></i> ${article.date || ''}</span>
                <span><i class="far fa-user"></i> ${article.author || '未知'}</span>
                ${article.tags && article.tags.length
                  ? `<span><i class="fas fa-tags"></i> ${article.tags.join('、')}</span>`
                  : ''}
              </div>
              ${article.summary
                ? `<div class="post-content"><p>${article.summary}</p></div>`
                : ''}
              <a href="${link}" class="read-more" data-target="${link}">查看全文 -></a>
            </article>
          `;
        }).join('')}
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

      // 生成页码数组并填充
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

    loadWallpaper: async function() {
        try {
            const res = await fetch(ROOT_PATH + 'wallpaper.json');
            if (!res.ok) throw new Error('加载壁纸列表失败');
            const wallpapers = await res.json();
            if (wallpapers.length === 0) return;
            const randomIndex = Math.floor(Math.random() * wallpapers.length);
            const wallpaper = wallpapers[randomIndex];
            const imgUrl = ROOT_PATH + wallpaper.file;

            // 设置 body 背景为图片
            document.body.style.backgroundImage = `url(${imgUrl})`;
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundPosition = 'center';
            document.body.style.backgroundAttachment = 'fixed';
            // 背景色作为后备
            document.body.style.backgroundColor = '#f0f2f5';

            // 创建伪元素渐变覆盖层
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

            // 预加载图片，加载完成后淡出覆盖层
            const img = new Image();
            img.onload = () => {
                // 渐变层渐出，露出背景图片
                styleEl.textContent = styleEl.textContent.replace('opacity: 1;', 'opacity: 0;');
            };
            img.onerror = () => {
                // 加载失败同样淡出，保留纯色背景
                styleEl.textContent = styleEl.textContent.replace('opacity: 1;', 'opacity: 0;');
            };
            img.src = imgUrl;
        } catch (error) {
            console.warn('壁纸加载失败，使用默认渐变', error);
            document.body.style.backgroundImage = 'linear-gradient(135deg, #e0e5ec, #f5f7fa)';
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
        let start = Math.max(2, current - 1);
        let end = Math.min(total - 1, current + 1);
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
            if (!target) return; // 无目标则忽略

            event.preventDefault(); // 阻止默认跳转（使用 loading）

            // 统一处理：传入 ROOT_PATH + target，loading.in 会自动补全 .html（本地环境）
            window.loading.in(ROOT_PATH + target);
        });
    },

    bindBackButton() {
        const backLink = document.getElementById('back-article-link');
        if (!backLink) return; // 只在文章详情页存在

        const target = ROOT_PATH + 'article.html';
        backLink.href = target; // 降级方案

        backLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.loading.in(target); // 使用全局 loading 动画跳转
        });
    },

    hideLoadingIfNeeded() {
        const wrapper = document.querySelector('.loading-wrapper');
        if (wrapper) wrapper.classList.remove('show');
        document.body.classList.remove('no-scroll');
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
            icon.className = sidebar.classList.contains('open') ? 'fas fa-times' : 'fas fa-bars';
            }
        }

        hamburger.addEventListener('click', toggleSidebar);
        overlay.addEventListener('click', toggleSidebar);

        // 窗口尺寸变化时自动关闭
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