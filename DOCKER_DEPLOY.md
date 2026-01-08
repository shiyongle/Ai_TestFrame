# Docker 部署指南

本文档介绍如何使用 Docker 在 Linux/Ubuntu 服务器上部署投石问路。

## 系统要求

- Linux/Ubuntu 服务器
- Docker 20.10+
- Docker Compose 2.0+
- 至少 2GB RAM
- 至少 10GB 可用磁盘空间

## 快速部署

### 1. 准备服务器

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 将当前用户添加到 docker 组
sudo usermod -aG docker $USER
```

### 2. 克隆项目

```bash
git clone <repository-url>
cd ToushiWenLu
```

### 3. 部署服务

```bash
# 给部署脚本执行权限
chmod +x deploy.sh

# 部署开发环境
./deploy.sh deploy

# 或部署生产环境
./deploy.sh deploy production
```

### 4. 访问应用

- 前端界面: http://your-server-ip
- 后端API: http://your-server-ip:8000
- API文档: http://your-server-ip:8000/docs

## 配置说明

### 环境变量

项目包含三个环境配置文件：

- `.env.docker` - 开发环境配置
- `.env.production` - 生产环境配置
- `.env` - 运行时使用的配置（由部署脚本自动生成）

主要配置项：

```bash
# 数据库配置
MYSQL_ROOT_PASSWORD=your_secure_password
MYSQL_DATABASE=test_system
MYSQL_USER=testuser
MYSQL_PASSWORD=your_secure_user_password

# 应用配置
DEBUG=false
LOG_LEVEL=INFO

# CORS配置
CORS_ORIGINS=["https://your-domain.com"]

# 前端配置
REACT_APP_API_URL=http://your-server-ip:8000
```

### 数据持久化

- MySQL 数据存储在 Docker 卷 `mysql_data` 中
- 后端日志存储在 `backend/logs` 目录
- 前端日志存储在 `frontend/nginx/logs` 目录

## 常用命令

```bash
# 查看服务状态
docker-compose ps

# 查看日志
./deploy.sh logs

# 备份数据库
./deploy.sh backup

# 恢复数据库
./deploy.sh restore backup_file.sql

# 更新服务
./deploy.sh update

# 停止服务
./deploy.sh stop

# 重启服务
./deploy.sh restart

# 清理资源
./deploy.sh cleanup
```

## 生产环境部署

### 1. 域名配置

编辑 `.env.production` 文件，更新域名配置：

```bash
CORS_ORIGINS=["https://your-domain.com", "https://www.your-domain.com"]
REACT_APP_API_URL=https://api.your-domain.com
```

### 2. SSL 证书

使用 Nginx 或 Let's Encrypt 配置 SSL 证书。

### 3. 防火墙配置

```bash
# 开放必要端口
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 8000  # 如果需要直接访问后端API

# 启用防火墙
sudo ufw enable
```

## 监控和维护

### 健康检查

所有服务都配置了健康检查：

- 前端：每 30 秒检查一次
- 后端：每 30 秒检查一次
- 数据库：每 30 秒检查一次

### 日志管理

- 前端日志：`frontend/nginx/logs/`
- 后端日志：`backend/logs/`
- 容器日志：`docker-compose logs`

### 数据备份

建议定期备份数据库：

```bash
# 手动备份
./deploy.sh backup

# 设置定时备份（每天凌晨 2 点）
echo "0 2 * * * cd /path/to/ToushiWenLu && ./deploy.sh backup" | sudo crontab -
```

## 故障排除

### 常见问题

1. **端口被占用**
   ```bash
   # 查看端口占用
   sudo lsof -i :80
   sudo lsof -i :3306
   ```

2. **数据库连接失败**
   ```bash
   # 检查数据库容器状态
   docker-compose logs mysql
   
   # 检查网络连接
   docker-compose exec backend ping mysql
   ```

3. **前端无法访问后端**
   ```bash
   # 检查网络配置
   docker network ls
   docker network inspect toushiwenlu_toushiwenlu_network
   ```

### 重置部署

如果需要完全重置：

```bash
# 停止所有服务
docker-compose down

# 删除所有卷（注意：这会删除所有数据）
docker volume rm toushiwenlu_mysql_data

# 重新部署
./deploy.sh deploy
```

## 性能优化

### 生产环境建议

1. **资源限制**
   ```yaml
   # 在 docker-compose.yml 中添加资源限制
   deploy:
     resources:
       limits:
         cpus: '1.0'
         memory: 1G
       reservations:
         cpus: '0.5'
         memory: 512M
   ```

2. **数据库优化**
   ```bash
   # 调整 MySQL 配置
   innodb_buffer_pool_size = 1G
   max_connections = 200
   ```

3. **缓存配置**
   - 考虑使用 Redis 缓存
   - 配置 CDN 加速静态资源

## 安全建议

1. **定期更新**
   ```bash
   # 定期更新 Docker 镜像
   docker-compose pull
   docker-compose up -d
   ```

2. **网络安全**
   - 使用强密码
   - 配置防火墙
   - 启用 SSL/TLS

3. **访问控制**
   - 限制数据库访问
   - 配置反向代理
   - 使用 API 认证

## 支持

如有问题，请：

1. 查看日志：`./deploy.sh logs`
2. 检查配置：`.env` 文件
3. 提交 Issue：项目仓库