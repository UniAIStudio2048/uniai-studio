#!/bin/bash

# UniAI Studio 开机自启动脚本
# 前端端口: 3000 | 后端端口: 4001

set -e

PROJECT_ROOT="/home/devbox/project"
LOG_DIR="$PROJECT_ROOT/logs"
PID_DIR="$PROJECT_ROOT/pids"

# 创建日志和PID目录
mkdir -p "$LOG_DIR"
mkdir -p "$PID_DIR"

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARN:${NC} $1"
}

# 停止已存在的进程
stop_services() {
    log "正在停止已存在的服务..."

    if [ -f "$PID_DIR/backend.pid" ]; then
        BACKEND_PID=$(cat "$PID_DIR/backend.pid")
        if kill -0 "$BACKEND_PID" 2>/dev/null; then
            kill "$BACKEND_PID"
            log "已停止后端进程 (PID: $BACKEND_PID)"
        fi
        rm -f "$PID_DIR/backend.pid"
    fi

    if [ -f "$PID_DIR/frontend.pid" ]; then
        FRONTEND_PID=$(cat "$PID_DIR/frontend.pid")
        if kill -0 "$FRONTEND_PID" 2>/dev/null; then
            kill "$FRONTEND_PID"
            log "已停止前端进程 (PID: $FRONTEND_PID)"
        fi
        rm -f "$PID_DIR/frontend.pid"
    fi
}

# 启动后端服务
start_backend() {
    log "正在启动后端服务 (端口 4001)..."
    cd "$PROJECT_ROOT/backend"

    # 检查依赖
    if [ ! -d "node_modules" ]; then
        warn "后端依赖未安装，正在安装..."
        npm install
    fi

    # 启动后端（监听所有网卡 0.0.0.0）
    nohup npm run dev -- -H 0.0.0.0 > "$LOG_DIR/backend.log" 2>&1 &
    BACKEND_PID=$!
    echo $BACKEND_PID > "$PID_DIR/backend.pid"

    log "后端服务已启动 (PID: $BACKEND_PID, 端口: 4001)"
}

# 启动前端服务
start_frontend() {
    log "正在启动前端服务 (端口 3000)..."
    cd "$PROJECT_ROOT/frontend"

    # 检查依赖
    if [ ! -d "node_modules" ]; then
        warn "前端依赖未安装，正在安装..."
        npm install
    fi

    # 设置生产环境变量
    export NODE_ENV="production"

    # 优先加载 .env.production 文件（必须在构建前加载）
    if [ -f ".env.production" ]; then
        log "正在加载 .env.production 文件..."
        set -a  # 自动导出所有变量
        source .env.production
        set +a
    elif [ -f ".env" ]; then
        log "正在加载 .env 文件..."
        set -a
        source .env
        set +a
    fi

    log "前端 API URL: $NEXT_PUBLIC_API_URL"

    # 每次启动都重新构建前端，确保环境变量被正确注入
    # （Next.js 的 NEXT_PUBLIC_* 变量是构建时注入的）
    log "正在清理旧的构建文件..."
    rm -rf .next
    
    log "正在重新构建前端（加载 .env.production 配置）..."
    npm run build

    # 启动前端（生产模式，监听所有网卡）
    nohup npm start -- -H 0.0.0.0 > "$LOG_DIR/frontend.log" 2>&1 &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > "$PID_DIR/frontend.pid"

    log "前端服务已启动 (PID: $FRONTEND_PID, 端口: 3000)"
}

# 健康检查
health_check() {
    log "等待服务启动..."
    sleep 5

    # 检查后端
    if curl -f http://localhost:4001/api/settings?key=test >/dev/null 2>&1; then
        log "后端服务健康检查通过 ✓"
    else
        warn "后端服务可能未完全启动，请查看日志: $LOG_DIR/backend.log"
    fi

    # 检查前端
    if curl -f http://localhost:3000 >/dev/null 2>&1; then
        log "前端服务健康检查通过 ✓"
    else
        warn "前端服务可能未完全启动，请查看日志: $LOG_DIR/frontend.log"
    fi
}

# 主流程
main() {
    log "========================================="
    log "UniAI Studio 启动中..."
    log "========================================="

    stop_services
    start_backend
    start_frontend
    health_check

    log "========================================="
    log "服务启动完成！"
    log "前端地址: http://0.0.0.0:3000"
    log "后端地址: http://0.0.0.0:4001"
    log "日志目录: $LOG_DIR"
    log "========================================="
    log "实时日志查看:"
    log "  后端: tail -f $LOG_DIR/backend.log"
    log "  前端: tail -f $LOG_DIR/frontend.log"
    log "========================================="

    # 保持脚本运行，监控子进程
    wait
}

# 捕获退出信号，优雅关闭
trap 'log "收到停止信号，正在关闭服务..."; stop_services; exit 0' SIGTERM SIGINT

main
