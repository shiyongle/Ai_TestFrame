#!/bin/bash

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
COMPOSE_CMD='docker compose'
COMPOSE_FILE='docker-compose.yml'
ENV_FILE='.env'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_requirements() {
    log_info "检查系统要求..."

    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装，请先安装 Docker"
        exit 1
    fi

    if ! docker compose version &> /dev/null; then
        log_error "Docker Compose v2 未安装，请先安装 docker compose 插件"
        exit 1
    fi

    log_info "系统要求检查完成"
}

create_directories() {
    log_info "创建必要目录..."
    mkdir -p backups
    log_info "目录创建完成"
}

setup_environment() {
    log_info "准备环境变量文件..."

    if [ ! -f ${ENV_FILE} ]; then
        if [ "$1" = "production" ]; then
            cp .env.production ${ENV_FILE}
            log_info "已基于 .env.production 生成 ${ENV_FILE}"
        else
            cp .env.docker ${ENV_FILE}
            log_info "已基于 .env.docker 生成 ${ENV_FILE}"
        fi
    else
        log_warn "${ENV_FILE} 已存在，跳过覆盖"
    fi
}

compose() {
    ${COMPOSE_CMD} --env-file ${ENV_FILE} -f ${COMPOSE_FILE} "$@"
}

deploy_services() {
    log_info "开始构建并启动服务..."
    compose down --remove-orphans
    compose build --no-cache
    compose up -d
    log_info "服务已启动，开始检查状态..."
    check_services
}

check_services() {
    log_info "当前容器状态："
    compose ps

    log_info "等待服务初始化..."
    sleep 20

    if curl -f http://localhost:8000/health >/dev/null 2>&1; then
        log_info "后端健康检查通过"
    else
        log_warn "后端健康检查未通过，请执行 docker compose logs backend 查看日志"
    fi

    if curl -f http://localhost >/dev/null 2>&1; then
        log_info "前端健康检查通过"
    else
        log_warn "前端健康检查未通过，请执行 docker compose logs frontend 查看日志"
    fi
}

backup_database() {
    log_info "备份数据库..."
    BACKUP_FILE="backups/mysql_backup_$(date +%Y%m%d_%H%M%S).sql"
    compose exec -T mysql mysqldump -u root -p${MYSQL_ROOT_PASSWORD:-s3cr3t} ${MYSQL_DATABASE:-test_system} > ${BACKUP_FILE}
    log_info "数据库备份完成: ${BACKUP_FILE}"
}

restore_database() {
    if [ -z "$1" ]; then
        log_error "请指定备份文件"
        exit 1
    fi

    log_info "恢复数据库..."
    compose exec -T mysql mysql -u root -p${MYSQL_ROOT_PASSWORD:-s3cr3t} ${MYSQL_DATABASE:-test_system} < "$1"
    log_info "数据库恢复完成"
}

update_services() {
    log_info "更新服务..."
    git pull
    compose down --remove-orphans
    compose build --no-cache
    compose up -d
    check_services
}

stop_services() {
    log_info "停止服务..."
    compose down
}

restart_services() {
    log_info "重启服务..."
    compose restart
    check_services
}

show_logs() {
    compose logs -f
}

cleanup() {
    log_info "清理 Docker 资源..."
    compose down --remove-orphans
    docker image prune -f
    log_info "清理完成"
}

show_help() {
    echo "智能化测试系统 Docker Compose 部署脚本"
    echo ""
    echo "用法: $0 [命令] [选项]"
    echo ""
    echo "命令:"
    echo "  deploy [production]     使用 docker compose 构建并部署服务"
    echo "  update                  拉取最新代码后重新构建并部署"
    echo "  stop                    停止服务"
    echo "  restart                 重启服务"
    echo "  backup                  备份数据库"
    echo "  restore <backup_file>   恢复数据库"
    echo "  logs                    查看日志"
    echo "  cleanup                 清理未使用镜像"
    echo "  help                    显示帮助信息"
}

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
            restart_services
            ;;
        backup)
            backup_database
            ;;
        restore)
            restore_database "$2"
            ;;
        logs)
            show_logs
            ;;
        cleanup)
            cleanup
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            show_help
            exit 1
            ;;
    esac
}

main "$@"
