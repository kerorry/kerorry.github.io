/**
 * 文章列表页的客户端逻辑：搜索、标签筛选、分页。
 *
 * 页面只负责输出结构（含首屏服务端渲染的卡片），交互全部在这里。
 */

import articles from '@/data/articles.json';
import { articleCardHtml } from '@/scripts/article-card';

/** 每页文章数。服务端首屏切片同样引用它，避免两处各写一个魔数。 */
export const PAGE_SIZE = 10;

/** 分页条最多显示几个页码，超出则用省略号折叠。 */
const MAX_VISIBLE_PAGES = 5;

function getFilteredArticles(allArticles, searchText, activeTags) {
  const text = searchText.toLowerCase();

  return allArticles.filter((article) => {
    const matchText =
      !text ||
      [article.title, article.summary, article.author, article.date].some((field) =>
        String(field ?? '')
          .toLowerCase()
          .includes(text)
      );

    if (!matchText) return false;
    if (activeTags.length === 0) return true;

    const articleTags = article.tags ?? [];
    return activeTags.some((tag) => articleTags.includes(tag));
  });
}

function generatePages(current, total) {
  if (total <= MAX_VISIBLE_PAGES) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const pages = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  if (start > 2) pages.push('...');
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push('...');

  pages.push(total);
  return pages;
}

export function initArticleList() {
  const listSection = document.getElementById('list-section');
  if (!listSection) return;

  const tagsFilter = document.getElementById('tags-filter');
  const searchInput = document.getElementById('search-input');
  const paginationContainer = document.getElementById('pagination-container');
  const paginationLine = document.getElementById('pagination-line');
  const prevButton = document.getElementById('prev-page');
  const nextButton = document.getElementById('next-page');
  const pagesContainer = document.getElementById('pagination-pages');

  // 数据由 Vite 直接打进客户端包，不再需要页面里手写 #articles-data 这个 JSON <script>
  const allArticles = articles;

  let currentPage = 1;
  let searchText = '';
  let activeTags = [];

  function renderArticleList(list) {
    if (list.length === 0) {
      listSection.innerHTML = `
        <p style="color: rgba(255,255,255,0.7); padding: 20px; text-align: center;">
          没有找到匹配的文章
        </p>
      `;
      return;
    }

    listSection.innerHTML = `<div class="article-list">${list
      .map((article) => articleCardHtml(article))
      .join('')}</div>`;
  }

  function renderPagination(totalPages) {
    if (!paginationContainer || !paginationLine || !pagesContainer) return;

    paginationContainer.style.display = 'flex';
    paginationLine.style.display = 'block';

    if (prevButton) prevButton.disabled = currentPage === 1;
    if (nextButton) nextButton.disabled = currentPage === totalPages;

    pagesContainer.innerHTML = generatePages(currentPage, totalPages)
      .map((page) => {
        if (page === '...') return '<span class="pagination-ellipsis"></span>';

        const active = page === currentPage ? 'active' : '';
        return `<button class="pagination-btn ${active}" data-page="${page}">${page}</button>`;
      })
      .join('');
  }

  function render(resetPage = false) {
    if (resetPage) currentPage = 1;

    const filtered = getFilteredArticles(allArticles, searchText, activeTags);
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;

    currentPage = Math.min(Math.max(currentPage, 1), totalPages);

    const start = (currentPage - 1) * PAGE_SIZE;
    renderArticleList(filtered.slice(start, start + PAGE_SIZE));
    renderPagination(totalPages);
  }

  // 三处监听器都带 dataset.bound 守卫，使 initArticleList 可以安全地重复调用：
  // 切页会换掉 DOM，新节点需要重新绑定；而同一批节点绝不能被绑两次
  // （否则点一次标签会被 toggle 两次，筛选结果正好反过来）。
  if (tagsFilter && tagsFilter.dataset.bound !== '1') {
    tagsFilter.dataset.bound = '1';
    tagsFilter.addEventListener('click', (event) => {
      const target = event.target.closest('.tag-filter-item');
      const tag = target?.dataset.tag;
      if (!tag) return;

      target.classList.toggle('active');
      activeTags = Array.from(tagsFilter.querySelectorAll('.tag-filter-item.active')).map(
        (el) => el.dataset.tag
      );
      render(true);
    });
  }

  if (searchInput && searchInput.dataset.bound !== '1') {
    searchInput.dataset.bound = '1';
    searchInput.addEventListener('input', (event) => {
      searchText = event.target.value.trim();
      render(true);
    });
  }

  if (paginationContainer && paginationContainer.dataset.bound !== '1') {
    paginationContainer.dataset.bound = '1';
    paginationContainer.addEventListener('click', (event) => {
      const button = event.target.closest('.pagination-btn');
      const action = button?.dataset.page;
      if (!action) return;

      const totalPages =
        Math.ceil(getFilteredArticles(allArticles, searchText, activeTags).length / PAGE_SIZE) || 1;

      if (action === 'prev') {
        if (currentPage <= 1) return;
        currentPage--;
      } else if (action === 'next') {
        if (currentPage >= totalPages) return;
        currentPage++;
      } else {
        const page = Number.parseInt(action, 10);
        if (Number.isNaN(page) || page < 1 || page > totalPages || page === currentPage) return;
        currentPage = page;
      }

      render(false);
      listSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  render();
}
