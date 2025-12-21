#!/bin/bash

# Rematrix Server 文档启动脚本

echo "🚀 启动 Rematrix Server 文档站点..."

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
fi

# 检查端口是否被占用
if lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  端口 5173 已被占用，正在尝试停止现有进程..."
    lsof -ti:5173 | xargs kill -9
    sleep 2
fi

# 启动 VitePress
echo "🌐 启动 VitePress 开发服务器..."
echo "📍 文档地址: http://localhost:5173"
echo "🛑 按 Ctrl+C 停止服务"
echo ""

npm run dev
