# Backend Dockerfile for Sealos Deployment
FROM node:20-alpine

WORKDIR /app

# 复制 package.json 和 lock 文件
COPY package*.json ./

# 安装依赖
RUN npm install

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 暴露端口
EXPOSE 4001

# 设置环境变量
ENV NODE_ENV=production

# 启动应用
CMD ["npm", "start"]
