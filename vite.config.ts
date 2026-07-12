import { defineConfig } from 'vite';

export default defineConfig({
    // 线上静态文件部署在 https://genwhole.com/admin/，构建资源必须保留该前缀。
    base: '/admin/',
    server: {
        host: '127.0.0.1',
        port: 3000,
        proxy: {
            // 浏览器保持线上 `/admin/api` 路径，本地转发时移除网关前缀以匹配 Rust 路由。
            '/admin/api': {
                target: 'http://127.0.0.1:8081',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/admin\/api/, ''),
            },
        },
    },
});
