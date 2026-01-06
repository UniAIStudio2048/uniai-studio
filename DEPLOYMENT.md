# UniAI Studio 部署与运维指南

## 启动脚本使用说明

`entrypoint.sh` 是一个增强型启动脚本，提供了进程管理、日志记录和自动重启功能。

### 功能特性

✅ **自动检测运行状态** - 如果服务已启动则自动重启
✅ **后台运行** - 服务在后台运行，日志输出到文件
✅ **日志管理** - 按日期归档，自动清理超过 7 天的旧日志
✅ **进程管理** - PID 文件跟踪，优雅关闭服务
✅ **实时日志** - 支持查看实时日志输出

---

## 命令大全

### 1. 启动服务（生产环境，跳过构建）⭐ **推荐**

```bash
./entrypoint.sh start
# 或
./entrypoint.sh prod-start
```

**适用场景**：已经构建好代码，直接启动服务

**特点**：
- 监听 `0.0.0.0:3000` 和 `0.0.0.0:4001`（支持外部访问）
- 自动检测是否已运行，如已运行则重启
- 日志输出到 `logs/` 目录
- 启动后显示实时日志（Ctrl+C 退出日志查看，服务继续运行）

---

### 2. 启动服务（生产环境，包含构建）

```bash
./entrypoint.sh production
# 或
./entrypoint.sh prod
```

**适用场景**：代码有更新，需要重新构建后启动

**构建流程**：
1. 构建后端 (`npm run build`)
2. 构建前端 (`npm run build`)
3. 启动服务

---

### 3. 启动服务（开发环境）

```bash
./entrypoint.sh
# 或
./entrypoint.sh development
```

**特点**：
- 使用 `npm run dev`（热重载）
- 监听 `localhost:3000` 和 `localhost:4001`
- 自动重启已运行的服务

---

### 4. 停止服务

```bash
./entrypoint.sh stop
```

**停止流程**：
1. 尝试优雅关闭（SIGTERM，等待 10 秒）
2. 如仍未关闭则强制终止（SIGKILL）
3. 清理 PID 文件

---

### 5. 重启服务

```bash
./entrypoint.sh restart
```

等同于：
```bash
./entrypoint.sh stop
./entrypoint.sh start
```

---

### 6. 查看状态

```bash
./entrypoint.sh status
```

**输出示例**：
```
========================================
Service Status:
========================================
✓ Backend:  Running (PID: 12345)
✓ Frontend: Running (PID: 12346)
========================================
Logs:
  Backend:  /home/devbox/project/logs/backend-20251224.log
  Frontend: /home/devbox/project/logs/frontend-20251224.log
========================================
```

---

### 7. 查看实时日志

```bash
./entrypoint.sh logs
```

**特点**：
- 同时显示前后端日志
- 实时滚动输出（`tail -f`）
- 按 `Ctrl+C` 退出

---

## 目录结构

启动脚本会自动创建以下目录：

```
project/
├── logs/              # 日志目录
│   ├── backend-20251224.log
│   ├── frontend-20251224.log
│   └── ...           # 自动清理超过 7 天的日志
├── pids/              # 进程 PID 文件
│   ├── backend.pid
│   └── frontend.pid
├── backend/
├── frontend/
└── entrypoint.sh
```

---

## 日志管理

### 日志文件命名规则
```
backend-YYYYMMDD.log
frontend-YYYYMMDD.log
```

### 日志保留策略
- **默认保留**：最近 7 天
- **自动清理**：每次启动时删除超过 7 天的日志
- **修改保留天数**：编辑 `entrypoint.sh` 中的 `LOG_RETENTION_DAYS` 变量

### 手动查看历史日志
```bash
# 查看昨天的日志
cat logs/backend-20251223.log

# 搜索错误日志
grep -i error logs/*.log

# 查看最近 100 行
tail -100 logs/backend-20251224.log
```

---

## 常见使用场景

### 场景 1: 首次部署

```bash
# 1. 构建代码
cd backend && npm run build
cd ../frontend && npm run build

# 2. 启动服务
cd ..
./entrypoint.sh start
```

### 场景 2: 代码更新后重启

```bash
# 方式 1: 重新构建并启动
./entrypoint.sh production

# 方式 2: 手动构建后重启
cd backend && npm run build
cd ../frontend && npm run build
cd ..
./entrypoint.sh restart
```

### 场景 3: 检查服务是否正常运行

```bash
# 查看状态
./entrypoint.sh status

# 如果服务停止了，启动它
./entrypoint.sh start

# 查看最近的日志
tail -50 logs/backend-20251224.log
```

### 场景 4: 排查问题

```bash
# 1. 查看实时日志
./entrypoint.sh logs

# 2. 如果服务异常，重启
./entrypoint.sh restart

# 3. 检查端口占用
netstat -tulpn | grep -E '3000|4001'

# 4. 手动测试后端 API
curl http://localhost:4001/api/settings
```

---

## 进程管理详解

### PID 文件
- **位置**：`pids/backend.pid` 和 `pids/frontend.pid`
- **内容**：进程 ID（数字）
- **用途**：检测服务是否运行、优雅关闭服务

### 进程检测逻辑
1. 检查 PID 文件是否存在
2. 读取 PID 并验证进程是否真实存在
3. 如果进程已死但 PID 文件仍存在，自动清理

### 优雅关闭流程
1. 发送 `SIGTERM` 信号（优雅关闭）
2. 等待最多 10 秒让进程自行退出
3. 如果仍未退出，发送 `SIGKILL`（强制终止）
4. 删除 PID 文件

---

## 故障排查

### 问题 1: 启动后服务立即停止

**排查步骤**：
```bash
# 查看日志
cat logs/backend-20251224.log
cat logs/frontend-20251224.log

# 常见原因：
# - 端口被占用
# - 数据库连接失败
# - 构建文件不存在
```

### 问题 2: 无法访问前端（502 错误）

**排查步骤**：
```bash
# 检查服务状态
./entrypoint.sh status

# 检查端口监听
netstat -tulpn | grep 3000

# 检查 Next.js 是否监听 0.0.0.0
ps aux | grep "next start" | grep HOSTNAME
```

**解决方案**：
- 确保使用 `./entrypoint.sh start` 启动（包含 `HOSTNAME=0.0.0.0`）
- 检查防火墙是否开放端口

### 问题 3: 日志文件过大

**临时清理**：
```bash
# 清空当前日志
> logs/backend-20251224.log
> logs/frontend-20251224.log

# 删除所有旧日志
rm -f logs/*.log
```

**永久方案**：
- 调整 `LOG_RETENTION_DAYS`（减少保留天数）
- 配置日志轮转工具（如 `logrotate`）

---

## 生产环境最佳实践

### 1. 使用进程管理工具（可选）

虽然脚本已支持后台运行，但生产环境可考虑使用：
- **PM2**（推荐）
- **systemd**
- **Supervisor**

### 2. 监控服务健康

```bash
# 定时检查（crontab）
*/5 * * * * /home/devbox/project/entrypoint.sh status >> /var/log/uniai-health.log
```

### 3. 自动重启（systemd 示例）

创建 `/etc/systemd/system/uniai.service`：
```ini
[Unit]
Description=UniAI Studio
After=network.target mysql.service

[Service]
Type=forking
WorkingDirectory=/home/devbox/project
ExecStart=/home/devbox/project/entrypoint.sh start
ExecStop=/home/devbox/project/entrypoint.sh stop
Restart=on-failure
RestartSec=10s
User=devbox

[Install]
WantedBy=multi-user.target
```

启用服务：
```bash
sudo systemctl enable uniai
sudo systemctl start uniai
sudo systemctl status uniai
```

---

## 更新日志清理策略

编辑 `entrypoint.sh`，修改这一行：
```bash
LOG_RETENTION_DAYS=7  # 改为你想要的天数
```

然后重启服务：
```bash
./entrypoint.sh restart
```

---

## 总结

| 命令 | 用途 | 是否重启 | 是否构建 |
|------|------|----------|----------|
| `./entrypoint.sh start` | 生产启动（跳过构建）⭐ | 是 | 否 |
| `./entrypoint.sh production` | 生产启动（含构建） | 是 | 是 |
| `./entrypoint.sh` | 开发启动 | 是 | 否 |
| `./entrypoint.sh stop` | 停止服务 | - | - |
| `./entrypoint.sh restart` | 重启服务 | 是 | 否 |
| `./entrypoint.sh status` | 查看状态 | - | - |
| `./entrypoint.sh logs` | 查看日志 | - | - |

---

## 快速参考

```bash
# 生产环境启动（推荐）
./entrypoint.sh start

# 查看状态
./entrypoint.sh status

# 查看日志
./entrypoint.sh logs

# 重启服务
./entrypoint.sh restart

# 停止服务
./entrypoint.sh stop
```

---

## Sealos 云平台部署指南

### 问题说明

如果在 Sealos 生产环境中遇到 **Network Error**（前端无法连接到后端 API），通常是因为前端和后端的网络配置不正确。

我们已经修复了这个问题，通过添加 **Nginx 反向代理** 作为统一入口。

### 部署架构

```
用户请求
   ↓
Nginx (端口 80) ← Sealos 公网入口
   ├─→ / (前端) → Frontend Service (端口 3000)
   └─→ /api (后端) → Backend Service (端口 4001)
```

### Sealos 部署步骤（推荐使用 Docker Compose）

#### 1. 准备工作

确保项目包含以下文件：
- ✅ `docker-compose.yml` - 编排配置（已更新）
- ✅ `nginx.conf` - Nginx 配置（新增）
- ✅ `Dockerfile.nginx` - Nginx 镜像（新增）
- ✅ `frontend/Dockerfile` - 前端镜像（已更新）
- ✅ `backend/Dockerfile` - 后端镜像

#### 2. 在 Sealos 创建应用

1. 登录 Sealos 控制台
2. 选择 **应用管理** → **创建应用**
3. 选择 **Docker Compose** 部署方式
4. 上传或粘贴 `docker-compose.yml` 内容
5. 设置公网访问端口为 **80**（映射到 nginx 服务）

#### 3. 配置环境变量

在 Sealos 应用配置中，为后端服务添加数据库环境变量：

```bash
MYSQL_HOST=你的数据库地址
MYSQL_USER=root
MYSQL_PASSWORD=你的密码
MYSQL_DATABASE=uniai_studio
```

#### 4. 部署完成

- 点击 **部署** 按钮
- 等待所有服务启动（约 2-5 分钟）
- 访问 Sealos 分配的公网域名

### 验证部署

#### 1. 访问前端页面
- 打开浏览器，访问 Sealos 公网域名
- 应该能看到 UniAI Studio 界面

#### 2. 检查 API 连接
- 按 `F12` 打开浏览器开发者工具
- 切换到 **Network** 标签
- 刷新页面
- 应该能看到 `/api/settings`、`/api/tasks` 等请求返回 200 状态码

#### 3. 测试参数保存功能
- 点击右上角的 **设置** 按钮
- 输入 Nano Banana API Key
- 点击 **保存**
- 应该能成功保存并关闭弹窗

### 故障排查

#### 问题 1: 仍然出现 Network Error

**检查清单：**
- [ ] 前端是否已重新构建（环境变量需要在构建时注入）
- [ ] 检查浏览器控制台，查看实际请求的 URL
- [ ] 访问 `/api/health` 检查后端是否正常
- [ ] 检查 Sealos 网络配置，确保服务间可以互相访问
- [ ] 检查 nginx 日志：`docker logs <nginx容器ID>`

#### 问题 2: 参数无法保存

**可能原因：**
- 数据库连接失败
- `settings` 表未创建

**解决方法：**
1. 查看后端日志：`docker logs <backend容器ID>`
2. 进入后端容器：`docker exec -it <backend容器ID> sh`
3. 运行数据库初始化：`npm run init-db`

#### 问题 3: Nginx 无法启动

**可能原因：**
- nginx.conf 配置语法错误
- 端口冲突

**解决方法：**
- 测试配置文件：`nginx -t`
- 查看 nginx 日志：`docker logs <nginx容器ID>`
- 检查 Sealos 端口映射配置

### 核心修复说明

我们对以下文件进行了修改，以解决生产环境网络错误：

#### 1. `frontend/lib/api.ts` 修改

**修改前：**
```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://ebnqdnzsdhoa.sealosbja.site/api';
```

**修改后：**
```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';
```

- 默认使用相对路径 `/api`
- 通过 nginx 路由到后端服务
- 避免硬编码外部 URL

#### 2. 新增 `nginx.conf` 配置

添加了反向代理配置，将：
- `/` 路径请求 → 前端服务（端口 3000）
- `/api/` 路径请求 → 后端服务（端口 4001）

#### 3. 更新 `docker-compose.yml`

添加了 nginx 服务作为统一入口：
- 前端和后端不再直接暴露端口
- 所有请求通过 nginx（端口 80）分发
- 前端使用相对路径访问后端

### 本地测试部署

在推送到 Sealos 前，可以在本地测试：

```bash
# 1. 构建并启动所有服务
docker-compose up --build

# 2. 访问应用
open http://localhost

# 3. 查看日志
docker-compose logs -f

# 4. 停止服务
docker-compose down
```

### 单独部署前后端（备选方案）

如果你希望在 Sealos 上将前后端分别部署为两个独立应用：

#### 后端部署
1. 创建应用，选择 Dockerfile 部署
2. 使用 `backend/Dockerfile`
3. 设置端口为 `4001`
4. 记录后端的公网 URL（如 `https://backend-xxx.sealos.run`）

#### 前端部署
1. 创建应用，选择 Dockerfile 部署
2. 使用 `frontend/Dockerfile`
3. 在构建参数中添加：
   ```
   NEXT_PUBLIC_API_URL=https://backend-xxx.sealos.run/api
   ```
4. 设置端口为 `3000`

**注意**：这种方式需要确保后端设置了正确的 CORS 配置。

### 技术说明

#### 为什么使用 Nginx？

在生产环境中，Nginx 提供：
1. **统一入口** - 所有请求通过同一域名，避免跨域问题
2. **路径路由** - 根据 URL 路径转发到不同服务
3. **负载均衡** - 可扩展为多实例部署
4. **静态文件缓存** - 提升性能
5. **HTTPS 终止** - 统一处理 SSL 证书

#### API_BASE_URL 的工作原理

- **开发环境**：通过 `next.config.ts` 的 `rewrites()` 代理到 localhost:4001
- **生产环境**：使用相对路径 `/api`，由 nginx 路由到后端容器
- **灵活覆盖**：仍可通过 `NEXT_PUBLIC_API_URL` 环境变量指定外部 URL

---
