#!/bin/bash

# Tale Draw Functions 测试运行脚本
# 自动化设置环境并运行测试

set -e  # 遇到错误立即退出

echo "🧪 Tale Draw Functions 测试启动器"
echo "=================================="

# 检查Node.js版本
NODE_VERSION=$(node --version)
echo "📦 Node.js 版本: $NODE_VERSION"

# 检查是否在正确目录
if [[ ! -f "package.json" ]]; then
    echo "❌ 错误: 请在 functions/test 目录下运行此脚本"
    exit 1
fi

echo ""

# 安装依赖（如果需要）
if [[ ! -d "node_modules" ]]; then
    echo "📥 安装测试依赖..."
    npm install
    echo "✅ 依赖安装完成"
else
    echo "✅ 依赖已存在"
fi

echo ""

# 检查Firebase CLI
if ! command -v firebase &> /dev/null; then
    echo "❌ 错误: 未找到 Firebase CLI，请先安装："
    echo "   npm install -g firebase-tools"
    exit 1
fi

echo "🔥 Firebase CLI 已安装"

# 检查是否已登录Firebase
if ! firebase projects:list &> /dev/null; then
    echo "❌ 错误: 请先登录 Firebase："
    echo "   firebase login"
    exit 1
fi

echo "✅ Firebase 已登录"
echo ""

# 显示菜单
echo "请选择要运行的测试类型："
echo "1. 单元测试 (快速, ~30秒)"
echo "2. 集成测试 (中等, ~2分钟)"  
echo "3. 性能测试 (较慢, ~5分钟)"
echo "4. CI测试 (单元+集成, ~3分钟)"
echo "5. 完整测试 (全部, ~8分钟)"
echo "6. 监视模式 (持续运行)"
echo "7. 覆盖率测试"
echo "8. 启动模拟器并等待"
echo "9. 退出"
echo ""

read -p "请输入选择 (1-9): " choice

case $choice in
    1)
        echo "🏃‍♂️ 运行单元测试..."
        npm run test:unit
        ;;
    2)
        echo "🔗 运行集成测试..."
        echo "⚠️ 需要启动 Firebase 模拟器..."
        
        # 检查模拟器是否运行
        if ! curl -s http://localhost:5001 > /dev/null 2>&1; then
            echo "🚀 启动 Firebase 模拟器..."
            cd ..
            firebase emulators:start --only functions,firestore,storage &
            EMULATOR_PID=$!
            cd test
            
            # 等待模拟器启动
            echo "⏳ 等待模拟器启动 (30秒)..."
            sleep 30
            
            # 运行测试
            npm run test:integration
            
            # 停止模拟器
            echo "🛑 停止模拟器..."
            kill $EMULATOR_PID 2>/dev/null || true
        else
            echo "✅ 模拟器已运行，直接测试"
            npm run test:integration
        fi
        ;;
    3)
        echo "⚡ 运行性能测试..."
        npm run test:performance
        ;;
    4)
        echo "🚀 运行CI测试 (单元+集成)..."
        npm run test:ci
        ;;
    5)
        echo "🌟 运行完整测试套件..."
        npm run test:all
        ;;
    6)
        echo "👀 启动监视模式..."
        npm run test:watch
        ;;
    7)
        echo "📊 运行覆盖率测试..."
        npm run test:coverage
        ;;
    8)
        echo "🔧 启动模拟器..."
        cd ..
        echo "💡 模拟器启动后，在另一个终端运行测试："
        echo "   cd functions/test && npm test"
        firebase emulators:start --only functions,firestore,storage
        ;;
    9)
        echo "👋 退出"
        exit 0
        ;;
    *)
        echo "❌ 无效选择，请重新运行脚本"
        exit 1
        ;;
esac

echo ""
echo "🎉 测试完成！"
echo ""
echo "💡 提示："
echo "- 如果测试失败，检查 Firebase 模拟器是否正常运行"
echo "- 某些测试需要 Google Cloud 凭证，没有时会跳过"
echo "- 详细文档请查看 README.md" 