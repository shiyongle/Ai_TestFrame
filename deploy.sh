#!/bin/bash

# 智能化测试系统 Docker 部署脚本
# 适用于 Linux/Ubuntu 服务器

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查系统要求
check_requirements() {
    log_info "检查系统要求..."
    
    # 检查Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装，请先安装 Docker"
        exit 1
    fi
    
    # 检查Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose 未安装，请先安装 Docker Compose"
        exit 1
    fi
    
    # 检查端口占用
    if lsof -Pi :80 -sTCP:LISTEN -t >/dev/null ; then
        log_warn "端口 80 已被占用，请检查"
    fi
    
    if lsof -Pi :3306 -sTCP:LISTEN -t >/dev/null ; then
        log_warn "端口 3306 已被占用，请检查"
    fi
    
    log_info "系统要求检查完成"
}

# 创建必要的目录
create_directories() {
    log_info "创建必要的目录..."
    
    mkdir -p backend/logs
    mkdir -p frontend/nginx/logs
    mkdir -p backups
    
    log_info "目录创建完成"
}

# 设置环境变量
setup_environment() {
    log_info "设置环境变量..."
    
    if [ ! -f .env ]; then
        if [ "$1" = "production" ]; then
            cp .env.production .env
            log_info "使用生产环境配置"
        else
            cp .env.docker .env
            log_info "使用开发环境配置"
        fi
    else
        log_warn ".env 文件已存在，跳过复制"
    fi
}

# 构建和启动服务
deploy_services() {
    log_info "构建和启动服务..."
    
    # 停止现有服务
    docker-compose down
    
    # 构建镜像
    log_info "构建 Docker 镜像..."
    docker-compose build --no-cache
    
    # 启动服务
    log_info "启动服务..."
    docker-compose up -d
    
    # 等待服务启动
    log_info "等待服务启动..."
    sleep 30
    
    # 检查服务状态
    check_services
}

# 检查服务状态
check_services() {
    log_info "检查服务状态..."
    
    # 检查容器状态
    if docker-compose ps | grep -q "Up"; then
        log_info "服务启动成功"
        docker-compose ps
    else
        log_error "服务启动失败"
        docker-compose logs
        exit 1
    fi
    
    # 检查健康状态
    log_info "等待健康检查完成..."
    sleep 60
    
    if curl -f http://localhost/health &> /dev/null; then
        log_info "前端服务健康检查通过"
    else
        log_warn "前端服务健康检查失败"
    fi
    
    if curl -f http://localhost:8000/health &> /dev/null; then
        log_info "后端服务健康检查通过"
    else
        log_warn "后端服务健康检查失败"
    fi
}

# 备份数据库
backup_database() {
    log_info "备份数据库..."
    
    BACKUP_FILE="backups/mysql_backup_$(date +%Y%m%d_%H%M%S).sql"
    
    docker-compose exec mysql mysqldump -u root -p${MYSQL_ROOT_PASSWORD:-s3cr3t} ${MYSQL_DATABASE:-test_system} > $BACKUP_FILE
    
    log_info "数据库备份完成: $BACKUP_FILE"
}

# 恢复数据库
restore_database() {
    if [ -z "$1" ]; then
        log_error "请指定备份文件"
        exit 1
    fi
    
    log_info "恢复数据库..."
    
    docker-compose exec -T mysql mysql -u root -p${MYSQL_ROOT_PASSWORD:-s3cr3t} ${MYSQL_DATABASE:-test_system} < $1
    
    log_info "数据库恢复完成"
}

# 更新服务
update_services() {
    log_info "更新服务..."
    
    # 备份数据库
    backup_database
    
    # 拉取最新代码
    git pull
    
    # 重新构建和部署
    deploy_services
    
    log_info "服务更新完成"
}

# 停止服务
stop_services() {
    log_info "停止服务..."
    docker-compose down
    log_info "服务已停止"
}

# 清理资源
cleanup() {
    log_info "清理 Docker 资源..."
    
    # 停止服务
    docker-compose down
    
    # 删除未使用的镜像
    docker image prune -f
    
    # 删除未使用的卷（谨慎使用）
    # docker volume prune -f
    
    log_info "清理完成"
}

# 显示帮助信息
show_help() {
    echo "智能化测试系统 Docker 部署脚本"
    echo ""
    echo "用法: $0 [命令] [选项]"
    echo ""
    echo "命令:"
    echo "  deploy [production]     部署服务（默认开发环境）"
    echo "  update                  更新服务"
    echo "  stop                    停止服务"
    echo "  restart                 重启服务"
    echo "  backup                  备份数据库"
    echo "  restore <backup_file>   恢复数据库"
    echo "  logs                    查看日志"
    echo "  cleanup                 清理资源"
    echo "  help                    显示帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 deploy               # 部署开发环境"
    echo "  $0 deploy production    # 部署生产环境"
    echo "  $0 update               # 更新服务"
    echo "  $0 backup               # 备份数据库"
    echo "  $0 restore backup.sql   # 恢复数据库"
}

# 主函数
main() {
    case "$1" in
        deploy)
            check_requirements
            create_directories
            setup_environment "$2"
            deploy_services
            ;;
        update)
            check_requirements
            update_services
            ;;
        stop)
            stop_services
            ;;
        restart)
            stop_services
            deploy_services
            ;;
        backup)
            backup_database
            ;;
        restore)
            restore_database "$2"
            ;;
        logs)
            docker-compose logs -f
            ;;
        cleanup)
            cleanup
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "未知命令: $1"
            show_help
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@"