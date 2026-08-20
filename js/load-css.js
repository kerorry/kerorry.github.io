(function() {
  // 固定根路径为网站根目录
  var rootPath = '/';

  var styles = [
    rootPath + 'css/style.css',
    rootPath + 'css/skeleton.css',
    rootPath + 'css/loading.css',
    rootPath + 'css/article.css',
    rootPath + 'css/info.css',
    rootPath + 'css/top.css',
    rootPath + 'css/sidebar.css'
  ];

  styles.forEach(function(href) {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  });

  // Font Awesome
  var faLink = document.createElement('link');
  faLink.rel = 'stylesheet';
  faLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
  document.head.appendChild(faLink);

  // 加载动画
  document.write(`
    <div class="loading-wrapper show" id="loadingWrapper">
      <div class="loading">
        <div></div><div></div><div></div><div></div><div></div>
      </div>
    </div>
  `);

  // 加载主脚本
  function loadScript(src) {
    return new Promise(function(resolve, reject) {
      var script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function init() {
    loadScript(rootPath + 'js/script.js')
      .then(function() {
        console.log('script.js loaded');
      })
      .catch(function(err) {
        console.error('script.js load failed:', err);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();