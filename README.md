# Medi Stream Admin Web

Medi Stream 管理后台前端，使用 Vite、TypeScript 和原生 Web Components 构建。

项目面向医疗直播平台的后台管理场景。目前已实现管理员登录、登录态恢复、欢迎工作台、权限菜单、退出登录、响应式后台框架，以及用户账号和 RBAC 管理页面。

## 技术栈

- Vite 6
- TypeScript 5
- 原生 Web Components
- Vitest + jsdom
- 原生 Fetch API
- 原生 Hash Router

项目没有引入 React、Vue 或 UI 组件框架。

## 已实现功能

- 管理员账号密码登录
- JWT 本地保存与刷新后会话恢复
- `401 Unauthorized` 自动清理失效会话
- 服务端退出登录与浏览器本地状态清理
- 基于角色和权限代码的侧边栏菜单过滤
- 可折叠桌面侧边栏和移动端抽屉导航
- 工作台欢迎页和模块快捷入口
- 普通用户查询、详情及封禁/解封
- 管理员增删改查、状态、密码重置和角色分配
- 角色增删改查、状态和权限分配
- 权限定义增删改查和状态管理
- 直播间分页查询、筛选、创建、编辑、删除、置顶、状态和房主管理
- 直播间封面上传及多路直播流维护
- 腾讯云推流/播放地址生成和直播流状态查询
- 未开发模块的统一占位页
- 统一 API 错误处理和关键状态日志
- `/admin/` 子路径构建与部署

> 前端菜单权限只负责界面可见性，Rust 后端仍是最终权限边界。

## 菜单结构

```text
工作台
用户与机构
├── 用户管理
└── 医院管理
内容管理
└── 内容目录
直播运营
├── 直播间管理
└── 腾讯云直播
权限管理
├── 管理员
├── 角色
└── 权限
```

## 快速开始

### 安装依赖

```bash
npm install
```

本机需要通过现有代理安装依赖时：

```bash
zsh -ic 'proxy_on && npm install'
```

### 启动开发服务

先启动管理端 Rust 服务，默认监听 `127.0.0.1:8081`，然后运行：

```bash
npm run dev
```

访问：

```text
http://127.0.0.1:3000/admin/
```

开发环境中，浏览器请求：

```text
/admin/api/auth/login
```

Vite 会移除 `/admin/api` 前缀并转发为：

```text
http://127.0.0.1:8081/auth/login
```

## 可用命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动 Vite 开发服务 |
| `npm run check` | 执行 TypeScript 类型检查 |
| `npm test` | 运行 Vitest 测试 |
| `npm run build` | 类型检查并生成生产构建 |

## API 约定

前端统一使用 `/admin/api` 网关前缀：

| 功能 | 请求 |
| --- | --- |
| 管理员登录 | `POST /admin/api/auth/login` |
| 当前管理员 | `GET /admin/api/auth/me` |
| 退出登录 | `POST /admin/api/auth/logout` |
| 普通用户查询与状态 | `GET /admin/api/users`、`PUT /admin/api/users/:id/status` |
| 管理员账号管理 | `/admin/api/admins`、`/admin/api/admins/:id/*` |
| 角色与角色权限 | `/admin/api/roles`、`/admin/api/roles/:id/permissions` |
| 权限定义管理 | `/admin/api/permissions`、`/admin/api/permissions/:id/status` |
| 文件上传与查询 | `POST /admin/api/files/upload`、`GET /admin/api/files/:id` |
| 直播间与直播流 | `/admin/api/live-rooms`、`/admin/api/live-rooms/:id/*` |
| 腾讯云直播工具 | `GET /admin/api/tencent-live/urls`、`POST /admin/api/tencent-live/stream-state` |

登录成功后，后续请求使用：

```http
Authorization: Bearer <token>
```

项目不会在日志中输出密码、Token 或完整请求体。

## 路由

项目部署在 `/admin/` 子路径，并使用 Hash Router：


Hash 后面的页面路径不会发送给服务器，因此刷新业务页面不需要为每条前端路由配置 Nginx fallback。

## 生产构建与部署

生成构建产物：

```bash
npm run build
```

构建结果位于 `dist/`。Vite 的 `base` 已设置为 `/admin/`，生成的静态资源路径为：

```text
/admin/assets/*.js
/admin/assets/*.css
```

将 `dist/` 中的内容部署到站点 `/admin/` 对应的静态目录。Nginx 可参考：

```nginx
location /admin/api/ {
    proxy_pass http://127.0.0.1:8081/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location /admin/ {
    try_files $uri $uri/ /admin/index.html;
}

location /uploads/ {
    alias /var/lib/medi-stream/uploads/;
    try_files $uri =404;
}
```

`proxy_pass` 结尾的 `/` 用于将 `/admin/api/auth/login` 转发为后端的 `/auth/login`。

## 项目结构

```text
src/
├── api/          # HTTP 客户端、认证和管理接口
├── auth/         # Token 与当前管理员会话
├── common/       # 通用日志等基础能力
├── components/   # 侧边栏和顶栏 Web Components
├── navigation/   # 菜单定义与权限过滤
├── pages/        # 登录、欢迎、用户、RBAC 和占位页面
├── router/       # Hash 路由与页面匹配
├── styles/       # 全局设计令牌和响应式样式
├── ui/           # SVG 图标和品牌标记
├── app.ts        # 根组件与访问控制
├── main.ts       # 应用入口
└── types.ts      # 公共类型
```

## 登录流程

```text
提交用户名和密码
        ↓
POST /admin/api/auth/login
        ↓
保存后端返回的 Token
        ↓
GET /admin/api/auth/me
        ↓
加载管理员角色和权限
        ↓
进入工作台并生成权限菜单
```

如果登录后无法加载当前管理员信息，前端会回滚本地 Token，避免留下半登录状态。

## 当前功能边界

以下模块目前已有导航入口，但业务页面仍为占位状态：

- 医院管理
- 内容目录

后续接入这些模块时，应继续复用现有 API、会话、路由和页面框架，不在页面组件内重复实现鉴权逻辑。
