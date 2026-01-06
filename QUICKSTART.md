# 快速启动指南

## 一键启动（生产环境）

```bash
./entrypoint.sh start
```

**说明**：
- ✅ 自动检测是否已运行，如已运行则重启
- ✅ 后端监听 `0.0.0.0:4001`（支持外部访问）
- ✅ 前端监听 `0.0.0.0:3000`（支持外部访问）
- ✅ 日志输出到 `logs/` 目录
- ✅ 自动清理超过 7 天的旧日志
- ⚠️ 启动后会显示实时日志，按 `Ctrl+C` 退出（服务继续运行）

---

## 常用命令

| 命令 | 说明 |
|------|------|
| `./entrypoint.sh start` | 启动服务（生产模式，跳过构建）⭐ |
| `./entrypoint.sh status` | 查看服务状态 |
| `./entrypoint.sh logs` | 查看实时日志 |
| `./entrypoint.sh restart` | 重启服务 |
| `./entrypoint.sh stop` | 停止服务 |
| `./entrypoint.sh production` | 重新构建并启动（包含 build） |

---

## 首次部署

```bash
# 1. 确保已安装依赖
cd backend && npm install
cd ../frontend && npm install

# 2. 初始化数据库（仅首次）
cd backend && npm run init-db

# 3. 构建项目
cd backend && npm run build
cd ../frontend && npm run build

# 4. 启动服务
cd ..
./entrypoint.sh start
```

---

## 检查服务状态

```bash
./entrypoint.sh status
```

**输出示例**：
```
✓ Backend:  Running (PID: 12345)
✓ Frontend: Running (PID: 12346)
```

---

## 查看日志

```bash
# 方式 1: 实时日志
./entrypoint.sh logs

# 方式 2: 直接查看日志文件
tail -f logs/backend-20251224.log
tail -f logs/frontend-20251224.log

# 方式 3: 搜索错误
grep -i error logs/*.log
```

---

## 故障排查

### 服务启动失败？

```bash
# 1. 查看日志
cat logs/backend-$(date +%Y%m%d).log
cat logs/frontend-$(date +%Y%m%d).log

# 2. 检查端口占用
netstat -tulpn | grep -E '3000|4001'

# 3. 重启服务
./entrypoint.sh restart
```

### 无法外部访问？

确保使用 `./entrypoint.sh start`（而不是 `npm start`），脚本会设置 `HOSTNAME=0.0.0.0`

---

## 更新代码后重启

```bash
# 方式 1: 自动构建并重启
./entrypoint.sh production

# 方式 2: 手动构建后重启
git pull
cd backend && npm run build
cd ../frontend && npm run build
cd ..
./entrypoint.sh restart
```

---

## 详细文档

查看完整的部署与运维指南：[DEPLOYMENT.md](./DEPLOYMENT.md)
