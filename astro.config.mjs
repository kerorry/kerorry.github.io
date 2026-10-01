import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://kerorry.github.io',
  build: {
    format: 'directory',
  },
  // 静态站点迁移前的老地址，保留重定向避免旧书签失效
  redirects: {
    '/article.html': '/article/',
  },
  vite: {
    resolve: {
      // 用 @ 指向 src，避免文章页那种 ../../../../../.. 的深层相对路径
      // （路径层级一旦数错，构建会直接失败）
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  },
});
