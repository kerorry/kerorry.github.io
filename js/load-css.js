(function () {
  'use strict';

  // 获取当前脚本
  const script = document.currentScript || (() => {
    const scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  // 计算根路径
  const src = script.src;
  const rootPath = src.substring(0, src.lastIndexOf('/js/') + 1);

  // 需要加载的 CSS（已去掉 loading.css）
  const CSS_FILES = [
    'css/style.css',
    'css/skeleton.css',
    'css/article.css',
    'css/info.css',
    'css/top.css',
    'css/sidebar.css'
  ];

  // Font Awesome
  const FONT_AWESOME_URL =
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';

  // 插入 link 标签
  function appendLink(href) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }

  // 加载所有样式
  function loadStyles() {
    CSS_FILES.forEach((file) => {
      appendLink(rootPath + file);
    });

    appendLink(FONT_AWESOME_URL);
  }

  // 动态加载脚本
  function loadScript(url) {
    return new Promise((resolve, reject) => {
      const scriptEl = document.createElement('script');
      scriptEl.src = url;
      scriptEl.onload = resolve;
      scriptEl.onerror = reject;
      document.head.appendChild(scriptEl);
    });
  }

  // 初始化
  function init() {
    loadScript(rootPath + 'js/script.js')
      .then(() => {
        console.log('[加载] load-css.js 已加载');
      })
      .catch((err) => {
        console.error('[加载] load-css.js load failed:', err);
      });
  }

  loadStyles();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();