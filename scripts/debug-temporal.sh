#!/bin/bash

# Temporal 调试脚本
# 用于实时监控和调试 workflow

echo "🔍 Temporal Workflow 调试工具"
echo "================================"

# 检查 Temporal 服务状态
echo "📊 检查 Temporal 服务状态..."
curl -s http://localhost:8233/api/v1/namespaces/default/workflows | jq '.' | head -20

echo ""
echo "🌐 Web UI: http://localhost:8233"
echo "📊 Metrics: http://localhost:9090"
echo ""

# 实时查看 Worker 日志
echo "📋 实时 Worker 日志 (按 Ctrl+C 停止):"
docker logs temporal-worker -f --tail=50
