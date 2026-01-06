# Frontend Dockerfile for Sealos Deployment
FROM node:20-alpine

WORKDIR /app

# 复制 package.json 和 lock 文件
COPY package*.json ./

# 安装依赖
RUN npm install

# 复制源代码
COPY . .

# 接收构建参数
ARG NEXT_PUBLIC_API_URL=/api

# 设置构建时环境变量（Next.js 会在构建时读取）
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# 构建应用
RUN npm run build

# 暴露端口
EXPOSE 3000

# 设置运行时环境变量
ENV NODE_ENV=production

# 启动应用
CMD ["npm", "start"]
