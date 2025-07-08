# Tale Draw Functions 测试 Makefile
# 提供便捷的测试命令

# 颜色定义
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

.PHONY: help install test test-unit test-integration test-performance test-ci test-all test-watch test-coverage clean lint emulator-start emulator-stop

# 默认目标
help:
	@echo "$(GREEN)Tale Draw Functions 测试命令$(NC)"
	@echo "=================================="
	@echo ""
	@echo "$(YELLOW)安装和设置:$(NC)"
	@echo "  make install          - 安装测试依赖"
	@echo "  make clean            - 清理依赖和缓存"
	@echo ""
	@echo "$(YELLOW)测试命令:$(NC)"
	@echo "  make test             - 运行所有测试"
	@echo "  make test-unit        - 运行单元测试 (~30秒)"
	@echo "  make test-integration - 运行集成测试 (~2分钟)"
	@echo "  make test-performance - 运行性能测试 (~5分钟)"
	@echo "  make test-ci          - 运行CI测试 (单元+集成)"
	@echo "  make test-all         - 运行完整测试套件"
	@echo "  make test-watch       - 监视模式运行测试"
	@echo "  make test-coverage    - 运行覆盖率测试"
	@echo ""
	@echo "$(YELLOW)工具命令:$(NC)"
	@echo "  make lint             - 代码风格检查"
	@echo "  make emulator-start   - 启动Firebase模拟器"
	@echo "  make emulator-stop    - 停止Firebase模拟器"
	@echo ""

# 安装依赖
install:
	@echo "$(YELLOW)📥 安装测试依赖...$(NC)"
	npm install
	@echo "$(GREEN)✅ 依赖安装完成$(NC)"

# 清理
clean:
	@echo "$(YELLOW)🧹 清理依赖和缓存...$(NC)"
	rm -rf node_modules package-lock.json
	npm cache clean --force
	@echo "$(GREEN)✅ 清理完成$(NC)"

# 运行所有测试
test:
	@echo "$(YELLOW)🧪 运行所有测试...$(NC)"
	npm test

# 单元测试
test-unit:
	@echo "$(YELLOW)🏃‍♂️ 运行单元测试...$(NC)"
	npm run test:unit
	@echo "$(GREEN)✅ 单元测试完成$(NC)"

# 集成测试
test-integration:
	@echo "$(YELLOW)🔗 运行集成测试...$(NC)"
	@echo "$(YELLOW)⚠️ 确保Firebase模拟器正在运行$(NC)"
	npm run test:integration
	@echo "$(GREEN)✅ 集成测试完成$(NC)"

# 性能测试
test-performance:
	@echo "$(YELLOW)⚡ 运行性能测试...$(NC)"
	npm run test:performance
	@echo "$(GREEN)✅ 性能测试完成$(NC)"

# CI测试
test-ci:
	@echo "$(YELLOW)🚀 运行CI测试 (单元+集成)...$(NC)"
	npm run test:ci
	@echo "$(GREEN)✅ CI测试完成$(NC)"

# 完整测试
test-all:
	@echo "$(YELLOW)🌟 运行完整测试套件...$(NC)"
	npm run test:all
	@echo "$(GREEN)✅ 完整测试完成$(NC)"

# 监视模式
test-watch:
	@echo "$(YELLOW)👀 启动监视模式...$(NC)"
	npm run test:watch

# 覆盖率测试
test-coverage:
	@echo "$(YELLOW)📊 运行覆盖率测试...$(NC)"
	npm run test:coverage
	@echo "$(GREEN)✅ 覆盖率测试完成$(NC)"

# 代码检查
lint:
	@echo "$(YELLOW)🔍 检查代码风格...$(NC)"
	npm run lint
	@echo "$(GREEN)✅ 代码检查完成$(NC)"

# 启动模拟器
emulator-start:
	@echo "$(YELLOW)🚀 启动Firebase模拟器...$(NC)"
	cd .. && firebase emulators:start --only functions,firestore,storage

# 停止模拟器
emulator-stop:
	@echo "$(YELLOW)🛑 停止Firebase模拟器...$(NC)"
	cd .. && firebase emulators:exec --only functions 'exit 0'

# 快速开始（安装+单元测试）
quick-start: install test-unit
	@echo "$(GREEN)🎉 快速开始完成！$(NC)"

# 完整设置（安装+完整测试）
full-setup: install test-all
	@echo "$(GREEN)🎉 完整设置完成！$(NC)" 