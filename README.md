# ⚡ UniAI Studio

<p align="center">
  <img src="https://github.com/user-attachments/assets/819c4787-364a-40a8-85a3-2a7404136279" width="50" />
</p>

<p align="center">
  <strong>一个现代化的 AI 图片生成与编辑平台</strong>
</p>

<p align="center">
  <a href="#功能特性">功能特性</a> •
  <a href="#技术栈">技术栈</a> •
  <a href="#快速开始">快速开始</a> •
  <a href="#部署指南">部署指南</a> •
  <a href="#api-文档">API 文档</a>
</p>

---

## 📸 预览

![UniAI Studio Screenshot]<img width="3840" height="1947" alt="c76a1410c9182c1d0cb85fe2765bfe35" src="https://github.com/user-attachments/assets/4dece1f2-df37-4d7e-b34f-482714038813" />


## ✨ 功能特性

- 🎨 **AI 图片生成** - 集成 Nano Banana 2 和 Z-Image Turbo 模型
- 📤 **图片上传** - 支持拖拽上传，自动存储到 S3 兼容的对象存储
- 🖼️ **图生图** - 上传参考图片，AI 根据描述进行编辑
- ⭐ **收藏功能** - 收藏喜欢的生成结果
- 💡 **灵感广场** - 浏览和管理创作灵感
- 📱 **响应式设计** - 适配桌面和移动设备
- 🎯 **实时任务队列** - 查看生成进度和历史记录
- ⚙️ **灵活配置** - 支持多种 AI 模型和存储方案

## 🛠️ 技术栈

### 前端 (端口 3000)
- **框架**: Next.js 16 + React 19
- **语言**: TypeScript
- **样式**: Tailwind CSS 4
- **状态管理**: Zustand
- **HTTP 客户端**: Axios
- **UI 组件**: Lucide React Icons, Headless UI

### 后端 (端口 4001)
- **框架**: Next.js API Routes
- **语言**: TypeScript
- **数据库**: MySQL 8.0+
- **ORM**: mysql2
- **对象存储**: AWS S3 SDK (兼容 Sealos、MinIO 等)
- **文件上传**: Multer

## 📁 项目结构

```
project/
├── frontend/                 # 前端项目 (端口 3000)
│   ├── app/                  # Next.js App Router
│   │   ├── page.tsx          # 首页
│   │   └── nanobanana/       # AI 工作室页面
│   ├── components/           # React 组件
│   │   ├── TopNav.tsx        # 顶部导航栏
│   │   ├── LeftSidebar.tsx   # 左侧工具栏
│   │   ├── Canvas.tsx        # 中央画布
│   │   ├── RightTaskQueue.tsx# 右侧任务队列
│   │   └── ...
│   └── lib/
│       ├── api.ts            # API 请求封装
│       └── store.ts          # Zustand 状态管理
│
├── backend/                  # 后端项目 (端口 4001)
│   ├── app/api/              # API 路由
│   │   ├── upload/           # 图片上传
│   │   ├── generate/         # AI 生成
│   │   ├── tasks/            # 任务管理
│   │   ├── favorites/        # 收藏管理
│   │   ├── inspirations/     # 灵感管理
│   │   └── settings/         # 配置管理
│   ├── lib/
│   │   ├── db.ts             # 数据库配置
│   │   └── storage.ts        # 对象存储配置
│   └── scripts/
│       └── init-db.sql       # 数据库初始化 SQL
│
├── public/                   # 静态资源
├── docker-compose.yml        # Docker 编排配置
└── README.md
```

## 🚀 快速开始

### 环境要求

- Node.js >= 18
- MySQL >= 8.0
- npm / yarn / pnpm

### 1. 克隆项目

```bash
git clone https://github.com/UniAIStudio2048/uniai-studio.git
cd uniai-studio
```

### 2. 配置环境变量

**后端配置**:
```bash
cd backend
cp .env.example .env.local
# 编辑 .env.local 填入你的数据库配置
```

```env
# backend/.env.local
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=uniai_studio
```

**前端配置**:
```bash
cd frontend
cp .env.example .env.local
# 编辑 .env.local 配置后端 API 地址
```

```env
# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:4001/api
```

### 3. 初始化数据库

```bash
# 使用 MySQL 客户端执行初始化脚本
mysql -u root -p < backend/scripts/init-db.sql
```

### 4. 安装依赖并启动

**启动后端**:
```bash
cd backend
npm install
npm run dev
# 后端运行在 http://localhost:4001
```

**启动前端**:
```bash
cd frontend
npm install
npm run dev
# 前端运行在 http://localhost:3000
```

### 5. 配置 API Key

访问 http://localhost:3000，点击右上角「设置」按钮，配置你的 AI 模型 API Key：

- **Nano Banana API Key**: 用于 Nano Banana 2 模型
- **Z-Image API Key**: 用于 Z-Image Turbo 模型（可选）

## 📦 部署指南

### Docker 部署

```bash
# 构建并启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f
```

### Sealos 云部署

1. 在 Sealos 创建 MySQL 数据库
2. 在 Sealos 创建对象存储 Bucket
3. 部署前端和后端应用，配置环境变量
4. 配置域名和 HTTPS

详细部署文档请参考 [DEPLOYMENT.md](DEPLOYMENT.md)

## 📖 API 文档

### 图片上传
```http
POST /api/upload
Content-Type: multipart/form-data

Body: { file: File }
Response: { id, url, filename, size, format }
```

### AI 生成任务
```http
POST /api/generate
Content-Type: application/json

Body: { 
  prompt: string,
  resolution?: "1K" | "2K" | "4K",
  aspectRatio?: string,
  batchCount?: number,
  imageUrl?: string  // 图生图时传入
}
Response: { taskId, status, message }
```

### 获取任务列表
```http
GET /api/tasks?limit=50
Response: { tasks: Task[] }
```

### 收藏管理
```http
GET /api/favorites           # 获取收藏列表
POST /api/favorites          # 添加收藏
DELETE /api/favorites/:url   # 取消收藏
```

### 灵感管理
```http
GET /api/inspirations        # 获取灵感列表
POST /api/inspirations       # 添加灵感
PUT /api/inspirations        # 更新灵感
DELETE /api/inspirations?id= # 删除灵感
```

## 🔧 配置说明

### 对象存储配置

在前端「设置」→「对象存储」中配置：

| 配置项 | 说明 | 示例 |
|--------|------|------|
| External | S3 API 地址 | objectstorageapi.xxx.sealos.run |
| Bucket | 存储桶名称 | my-bucket |
| Access Key | 访问密钥 | your-access-key |
| Secret Key | 私有密钥 | your-secret-key |

支持 Sealos、AWS S3、MinIO 等 S3 兼容存储。

### AI 模型配置

| 模型 | 用途 | 获取 API Key |
|------|------|--------------|
| Nano Banana 2 | 高质量图片生成 | [Nano Banana](https://nanobanana.ai) |
| Z-Image Turbo | 快速图片生成 | 联系获取 |

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

## 📄 许可证

本项目基于 MIT 许可证开源 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- [Next.js](https://nextjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Nano Banana](https://nanobanana.ai/)
- [Sealos](https://sealos.io/)

---

<p align="center">
  Made with ❤️ by UniAI Team
</p>
