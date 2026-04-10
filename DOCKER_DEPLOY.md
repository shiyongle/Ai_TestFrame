# Docker Compose 部署指南

本文档说明如何通过 [`docker-compose.yml`](docker-compose.yml) 对投石问路项目进行一体化部署。当前方案已经可以满足你“前后端都通过 Docker Compose 部署”的要求。

## 1. 当前部署能力

现在项目已经具备以下能力：

- 使用 [`docker-compose.yml`](docker-compose.yml) 同时编排 `mysql`、`backend`、`frontend`
- 后端基于 [`backend/Dockerfile`](backend/Dockerfile) 构建镜像
- 前端基于 [`frontend/Dockerfile`](frontend/Dockerfile) 构建镜像
- 使用 [`.env.docker`](.env.docker) 或 [`.env.production`](.env.production) 注入环境变量
- 使用 [`deploy.sh`](deploy.sh) 一键完成构建、启动、检查、备份、恢复和日志查看

## 2. 服务组成

[`docker-compose.yml`](docker-compose.yml) 中包含：

- `mysql`：MySQL 8.0 数据库
- `backend`：FastAPI 后端服务
- `frontend`：React + Nginx 前端服务

## 3. 已修复的问题

本次已经将原始 Compose 方案调整为可直接用于前后端一体化部署，主要修复点包括：

- 修复原网络名 `toushiwenlu_network` 与 `ai_test_network` 不一致问题
- 修复后端健康检查依赖 `curl` 但镜像中不稳定的问题，改为 Python 探活
- 修复前端构建参数未通过 `build.args` 注入的问题
- 补齐后端 AI、RAG、认证等配置变量映射
- 补齐后端数据、日志、UI 工件等卷挂载
- 将部署脚本从旧 [`docker-compose`](deploy.sh) 命令切换为 [`docker compose`](deploy.sh)

## 4. 部署步骤

### 4.1 准备环境变量

开发环境：

```bash
cp .env.docker .env
```

生产环境：

```bash
cp .env.production .env
```

然后按实际情况编辑 [`.env`](.env)：

- 数据库密码
- AI Key
- CORS 域名
- 前端 API 地址

## 5. 一键部署

Linux 服务器执行：

```bash
chmod +x deploy.sh
./deploy.sh deploy production
```

如果是开发环境：

```bash
./deploy.sh deploy
```

## 6. 手动 compose 部署

如果你不想走脚本，也可以直接执行：

```bash
docker compose --env-file .env -f docker-compose.yml build --no-cache
docker compose --env-file .env -f docker-compose.yml up -d
```

查看状态：

```bash
docker compose --env-file .env -f docker-compose.yml ps
```

查看日志：

```bash
docker compose --env-file .env -f docker-compose.yml logs -f
```

## 7. 访问地址

- 前端：`http://服务器IP/`
- 后端健康检查：`http://服务器IP:8000/health`
- 后端文档：`http://服务器IP:8000/docs`

## 8. 镜像打包方式

如果你只想先打包镜像，不立即启动：

```bash
docker compose --env-file .env -f docker-compose.yml build
```

构建完成后可查看：

```bash
docker images | grep ai-testframe
```

## 9. 生产建议

- 生产环境建议只暴露 `80`，`3306` 和 `8000` 可按需改为内网访问
- 建议配合外层 Nginx / HTTPS / 域名使用
- 建议把 [`.env.production`](.env.production) 中的密码和密钥全部替换成真实值
- 若使用 Jenkins，可继续结合 [`Jenkinsfile`](Jenkinsfile) 与 [`deploy/docker/docker-compose.prod.yml`](deploy/docker/docker-compose.prod.yml) 做镜像仓库式部署

## 10. 结论

结论是：**现在已经可以满足你“前后端项目都用 Docker Compose 方式部署”的要求**。并且我已经把主项目根目录下的 [`docker-compose.yml`](docker-compose.yml)、[`deploy.sh`](deploy.sh)、[`DOCKER_DEPLOY.md`](DOCKER_DEPLOY.md) 和 [`.env.docker`](.env.docker) 调整为围绕这一目标工作的版本。
