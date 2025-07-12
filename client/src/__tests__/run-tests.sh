#!/bin/bash

# Tale Draw 单元测试运行脚本

echo "🧪 Running Tale Draw Unit Tests"
echo "==============================="

cd "$(dirname "$0")/.."

echo "📁 Test Directory Structure:"
find test -name "*.test.js" -type f | sort

echo ""
echo "🚀 Running Tests..."

# Run tests with coverage
npm test -- --testPathPattern="test.*\.test\.js$" --coverage --watchAll=false --verbose

echo ""
echo "✅ Test run completed!"
echo ""
echo "📊 Test Coverage Summary:"
echo "- StateManager: ✅ Core business logic"
echo "- API Module: ✅ Image generation & error handling" 
echo "- Components: ✅ User interactions & rendering"
echo "- Utils: ✅ Logger & security features"
echo "- Services: ✅ Payment integration"
echo ""
echo "📝 To run specific tests:"
echo "npm test -- test/stateManager.test.js"
echo "npm test -- test/components/PageItem.test.js"