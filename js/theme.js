/* ============================================================
   js/theme.js —— 白天 / 黑夜主题
   - 在 <head> 中同步执行：首屏绘制前就把 data-theme 写到 <html> 上，不会闪屏
   - 优先级：localStorage 里用户的选择 > 系统的 prefers-color-scheme
   - 用户没手动选过时跟随系统；一旦点过开关，就以开关为准
   - 切换时派发 document 事件 'themechange'，供 js/bg.js 重新读取 CSS 变量
   - 依赖：partials/top.html 里的 #themeToggle（.theme-switch）
   ============================================================ */

(function () {
  'use strict';

  var STORAGE_KEY = 'theme';
  var root = document.documentElement;
  var mq = window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

  function readStored() {
    try {
      var v = localStorage.getItem(STORAGE_KEY);
      return v === 'dark' || v === 'light' ? v : null;
    } catch (e) {
      return null;                       // 隐私模式下 localStorage 可能不可用
    }
  }

  function writeStored(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {}
  }

  function systemTheme() {
    return mq && mq.matches ? 'dark' : 'light';
  }

  function current() {
    return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  /* ---- 1. 首屏定调：要在样式表生效前跑完 ---- */
  root.setAttribute('data-theme', readStored() || systemTheme());

  if (window.__themeInit) return;
  window.__themeInit = true;

  /* 同步开关的图标方向与无障碍状态（partials/top.html 是异步注入的，可能还不存在） */
  function syncUI() {
    var btn = document.getElementById('themeToggle');
    if (!btn) return;

    var dark = current() === 'dark';
    var label = dark ? '切换到白天模式' : '切换到夜间模式';

    btn.setAttribute('aria-checked', dark ? 'true' : 'false');
    btn.setAttribute('aria-label', label);
    btn.title = label;
  }

  function apply(theme, remember) {
    root.setAttribute('data-theme', theme);
    if (remember) writeStored(theme);
    syncUI();
    /* getComputedStyle 会同步触发样式重算，bg.js 收到事件后读到的就是新配色 */
    document.dispatchEvent(
      new CustomEvent('themechange', { detail: { theme: theme } })
    );
  }

  function toggle() {
    apply(current() === 'dark' ? 'light' : 'dark', true);
  }

  /* ---- 2. 事件委托：partials/top.html 是 fetch 进来的，绑在 document 上更稳 ---- */
  document.addEventListener('click', function (e) {
    var el = e.target;
    if (!el || typeof el.closest !== 'function') return;
    if (!el.closest('#themeToggle')) return;
    e.preventDefault();
    toggle();
  });

  /* ---- 3. 没手动选过时跟随系统 ---- */
  if (mq) {
    var onSystemChange = function () {
      if (readStored()) return;          // 用户已经定过，不再跟随
      apply(systemTheme(), false);
    };

    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onSystemChange);
    } else if (typeof mq.addListener === 'function') {
      mq.addListener(onSystemChange);    // Safari < 14
    }
  }

  /* ---- 4. 对外接口：script.js 在注入 partials/top.html 后会调用 Theme.sync() ---- */
  window.Theme = {
    get: current,
    set: function (theme) {
      apply(theme === 'dark' ? 'dark' : 'light', true);
    },
    toggle: toggle,
    sync: syncUI
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncUI);
  } else {
    syncUI();
  }
})();
