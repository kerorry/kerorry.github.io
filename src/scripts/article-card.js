/**
 * 文章卡片的唯一模板来源。
 *
 * 服务端（ArticleCard.astro）与客户端（article-list.js 渲染分页结果）
 * 共用这一个函数，避免两处各写一份卡片结构而逐渐走样。
 *
 * 注意：调用方用 set:html / innerHTML 注入，不会再有框架转义兜底，
 * 所以这里所有插值都必须经过 escapeHtml。
 */

export function escapeHtml(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char]
  );
}

/** 把 articles.json 里的 file 字段转成站内绝对路径。 */
export function articleHref(file) {
  return '/' + String(file ?? '').replace(/^\/+/, '');
}

/** 渲染一张文章卡片。 */
export function articleCardHtml(article) {
  const tags = article.tags ?? [];
  const href = articleHref(article.file);

  return `<article class="post glass-ground blog-post">
  <h2 class="post-title">${escapeHtml(article.title || '无标题')}</h2>
  <div class="post-meta">
    <span><i class="far fa-calendar"></i> ${escapeHtml(article.date || '')}</span>
    <span><i class="far fa-user"></i> ${escapeHtml(article.author || '未知')}</span>
    ${
      tags.length > 0
        ? `<span><i class="fas fa-tags"></i> ${escapeHtml(tags.join('、'))}</span>`
        : ''
    }
  </div>
  ${
    article.summary
      ? `<div class="post-content"><p>${escapeHtml(article.summary)}</p></div>`
      : ''
  }
  <a href="${escapeHtml(href)}" class="read-more">查看全文 -></a>
</article>`;
}
