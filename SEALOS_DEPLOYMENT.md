# Sealos 部署指南

## 问题说明

您在 Sealos 上部署时遇到的报错是因为**前端和后端是分开部署**的，但前端无法正确连接到后端 API。

### 当前状态
- ✅ 前端地址：`https://klujxzactnpe.sealosbja.site`
- ✅ 后端 API：`https://ebnqdnzsdhoa.sealosbja.site/api`
- ❌ 前端调用后端 API 时出现 Network Error

## 解决方案

我已经修复了代码配置，现在提供两种部署方式：

---

## 方案一：分离部署（前后端分开）⭐ 推荐

### 1. 部署后端

在 Sealos 应用管理中创建后端应用：

**基本配置**：
- 应用名称：`uniai-backend`
- 镜像：Node.js 20
- 工作目录：`/backend`
- 启动命令：`npm run start`（生产环境）或 `npm run dev`（开发环境）

**环境变量**：
```bash
NODE_ENV=production
```

**端口设置**：
- 容器端口：4001
- 外网访问：开启
- 域名：会自动生成类似 `https://xxx.sealosbja.site` 的地址

### 2. 部署前端

在 Sealos 应用管理中创建前端应用：

**基本配置**：
- 应用名称：`uniai-frontend`
- 镜像：Node.js 20
- 工作目录：`/frontend`
- 启动命令：`npm run start`（生产环境）或 `npm run dev`（开发环境）

**重要：环境变量配置** ⚠️
```bash
NEXT_PUBLIC_API_URL=https://ebnqdnzsdhoa.sealosbja.site/api
```
> **将 `https://ebnqdnzsdhoa.sealosbja.site/api` 替换为您后端应用的实际域名**

**端口设置**：
- 容器端口：3000
- 外网访问：开启
- 域名：会自动生成类似 `https://klujxzactnpe.sealosbja.site` 的地址

### 3. 构建和部署步骤

#### 方法A：使用 Sealos 应用商店（推荐）

1. 登录 Sealos 控制台
2. 进入"应用管理"
3. 点击"创建新应用"
4. 选择"从 Git 仓库部署"
5. 配置后端应用：
   - Git 地址：您的代码仓库地址
   - 分支：main
   - 构建上下文：`./backend`
   - Dockerfile路径：`./backend/Dockerfile`（如果有）
   - 端口：4001
6. 配置前端应用（重复上述步骤）：
   - 构建上下文：`./frontend`
   - Dockerfile路径：`./frontend/Dockerfile`（如果有）
   - 端口：3000
   - **重要**：添加环境变量 `NEXT_PUBLIC_API_URL`

#### 方法B：本地构建后上传

1. **构建后端**：
```bash
cd backend
npm install
npm run build
```

2. **构建前端**：
```bash
cd frontend
npm install
npm run build
```

3. 将构建好的代码打包上传到 Sealos

---

## 方案二：统一部署（单一应用）

如果您想简化部署，可以将前后端合并为一个应用。

### 1. 创建统一启动脚本

在项目根目录创建 `start.sh`：

```bash
#!/bin/bash

# 启动后端
cd backend
npm run start &
BACKEND_PID=$!

# 启动前端
cd ../frontend
npm run start &
FRONTEND_PID=$!

# 等待进程
wait $BACKEND_PID $FRONTEND_PID
```

### 2. Sealos 应用配置

**基本配置**：
- 应用名称：`uniai-studio`
- 镜像：Node.js 20
- 启动命令：`bash start.sh`

**环境变量**：
```bash
NEXT_PUBLIC_API_URL=http://localhost:4001/api
```

**端口映射**：
- 主端口：3000（前端）
- 副端口：4001（后端API）

---

## 验证部署

### 1. 检查后端健康状态

访问：`https://您的后端域名/api/health`

应该返回：
```json
{
  "status": "healthy",
  "timestamp": "2025-12-24T...",
  "uptime": 123.45,
  "checks": {
    "database": "healthy"
  },
  "responseTime": "5ms"
}
```

### 2. 检查前端页面

访问：`https://您的前端域名`

页面应该正常显示，并且不再出现 Network Error。

### 3. 测试 API 调用

打开浏览器开发者工具（F12），切换到 Network 标签，刷新页面：
- 检查 API 请求是否成功（状态码 200）
- 检查请求地址是否正确

---

## 常见问题

### Q1: 前端仍然显示 Network Error

**解决**：
1. 检查前端环境变量 `NEXT_PUBLIC_API_URL` 是否正确配置
2. 确认后端应用已启动且可访问
3. 检查浏览器控制台的具体错误信息

### Q2: API 请求返回 503 错误

**解决**：
1. 后端服务可能崩溃了，查看后端日志
2. 检查数据库连接是否正常
3. 重启后端应用

### Q3: CORS 错误

**解决**：
后端已经配置了CORS，如果仍有问题：
1. 检查后端 `app/api/proxy.ts` 文件中的 CORS 配置
2. 确认前端域名在允许列表中

### Q4: 如何查看日志

在 Sealos 应用详情页：
1. 点击"日志"标签
2. 查看实时日志输出
3. 检查报错信息

---

## 数据库配置

### MySQL 数据库

在 Sealos 上部署 MySQL：

1. 进入"数据库"
2. 创建 MySQL 实例
3. 记录连接信息：
   - Host：`xxx.ns-xxx.svc`
   - Port：3306
   - User：`root`
   - Password：自动生成
   - Database：`uniai_studio`

4. 更新后端配置 `backend/lib/db.ts`：
```typescript
const dbConfig = {
  host: 'YOUR_MYSQL_HOST',
  port: 3306,
  user: 'root',
  password: 'YOUR_PASSWORD',
  database: 'uniai_studio',
};
```

5. 初始化数据库：
```bash
cd backend
npm run init-db
```

---

## 对象存储配置

### Sealos 对象存储

1. 在 Sealos 创建对象存储桶
2. 获取访问凭证
3. 在前端"设置"页面配置：
   - Endpoint：`objectstorageapi.bja.sealos.run`
   - Region：`bja`
   - Bucket：您的桶名
   - Access Key：访问密钥
   - Secret Key：密钥

---

## 完成部署后

1. ✅ 前端页面正常访问
2. ✅ API 健康检查通过
3. ✅ 可以正常生成图片
4. ✅ 数据库连接正常
5. ✅ 对象存储配置完成

现在您的 UniAI Studio 已经成功部署到 Sealos！🎉

---

## 需要帮助？

如果遇到问题：
1. 查看 Sealos 应用日志
2. 检查环境变量配置
3. 确认所有服务都已启动
4. 测试后端 API 健康检查端点

**关键检查点**：
- 环境变量 `NEXT_PUBLIC_API_URL` 必须正确设置
- 后端服务必须可以从外网访问
- 数据库连接信息必须正确
- MySQL 数据库必须已初始化
