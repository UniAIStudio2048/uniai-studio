# Sealos 部署问题快速修复指南

## 问题现象

您在访问 `https://klujxzactnpe.sealosbja.site` 时看到以下报错：

```
Network Error
- getSetting 失败
- saveSetting 失败
- getInspirations 失败
- getFavorites 失败
- getTasks 失败
```

## 问题根源

✅ **已诊断**：前端无法连接到后端 API

- 前端地址：`https://klujxzactnpe.sealosbja.site`
- 后端 API：`https://ebnqdnzsdhoa.sealosbja.site/api`（已正常工作）
- 问题：前端配置错误，无法调用后端

## 快速解决方案（5分钟）

### 步骤1：在 Sealos 上配置前端环境变量

1. 登录 Sealos 控制台
2. 找到前端应用 `uniai-frontend`（或您的应用名）
3. 点击"设置" → "环境变量"
4. 添加以下环境变量：

```
NEXT_PUBLIC_API_URL=https://ebnqdnzsdhoa.sealosbja.site/api
```

5. 保存并**重启应用**

### 步骤2：验证修复

1. 访问后端健康检查：
   ```
   https://ebnqdnzsdhoa.sealosbja.site/api/health
   ```
   应该返回：
   ```json
   {
     "status": "healthy",
     "checks": {
       "database": "healthy"
     }
   }
   ```

2. 刷新前端页面：`https://klujxzactnpe.sealosbja.site`
3. 打开浏览器开发者工具（F12）
4. 检查 Network 标签，API 请求应该成功（状态码 200）

---

## 如果上述方法不工作

### 方案A：重新部署前端

1. 删除现有前端应用
2. 重新创建应用时，在"环境变量"中添加：
   ```
   NEXT_PUBLIC_API_URL=https://ebnqdnzsdhoa.sealosbja.site/api
   ```
3. 部署完成后测试

### 方案B：使用新代码重新部署

我已经修改了代码，现在支持环境变量配置。

**本地修改的文件**：
1. ✅ `frontend/lib/api.ts` - 支持环境变量配置
2. ✅ `frontend/.env.production` - 生产环境配置
3. ✅ `frontend/Dockerfile` - 前端部署文件
4. ✅ `backend/Dockerfile` - 后端部署文件

**重新部署步骤**：

```bash
# 1. 提交代码更改
git add .
git commit -m "fix: 修复 Sealos 部署 API 配置问题"
git push

# 2. 在 Sealos 上重新部署
# 方法1：从 Git 自动部署
# 方法2：手动上传代码
```

### 方案C：合并部署（最简单）

如果您想避免配置问题，可以将前后端合并部署为一个应用：

1. 在 Sealos 创建新应用
2. 使用项目根目录的 `docker-compose.yml`
3. 或使用 `entrypoint.sh` 启动脚本

---

## 检查清单

在 Sealos 上，确保：

- [ ] 后端应用已启动（访问 `/api/health` 返回 200）
- [ ] 前端应用已启动（访问首页正常显示）
- [ ] 前端环境变量 `NEXT_PUBLIC_API_URL` 已正确设置
- [ ] 前端应用已重启（环境变量才会生效）
- [ ] 数据库连接正常
- [ ] 浏览器控制台无 CORS 错误

---

## 最常见的错误

### ❌ 错误1：忘记设置环境变量

**症状**：前端正常显示，但所有 API 请求失败

**解决**：添加 `NEXT_PUBLIC_API_URL` 环境变量并重启

### ❌ 错误2：环境变量设置后未重启

**症状**：设置了环境变量但仍然报错

**解决**：**必须重启**前端应用才能生效

### ❌ 错误3：后端地址错误

**症状**：API 请求404或503

**解决**：确认后端地址拼写正确，包含 `/api` 后缀

### ❌ 错误4：后端未启动

**症状**：后端健康检查失败

**解决**：启动后端应用，检查数据库连接

---

## 验证成功的标志

当您看到以下情况，说明部署成功：

✅ 前端页面正常加载，无报错提示
✅ 浏览器控制台无 Network Error
✅ 可以在设置页面配置 API Key
✅ 可以上传图片
✅ 可以生成图像
✅ 任务队列正常显示

---

## 需要更详细的指导？

请查看完整的部署文档：`SEALOS_DEPLOYMENT.md`

## 仍然有问题？

1. 查看 Sealos 应用日志
2. 检查浏览器开发者工具的 Console 和 Network 标签
3. 确认后端 API 可以正常访问
4. 联系技术支持

---

**关键提示**：
> 环境变量 `NEXT_PUBLIC_API_URL` 必须以 `NEXT_PUBLIC_` 开头才能在浏览器中访问！
> 设置环境变量后必须重启应用才能生效！

祝部署顺利！🚀
