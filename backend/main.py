from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import time
import uuid
from config.settings import settings
from core.logging import setup_logging
from core.database import create_tables
from api.v1 import projects, testcases, tests, versions, requirements, rules, ai

# 设置日志
main_logger, request_logger, _, _ = setup_logging()

# 创建FastAPI应用
app = FastAPI(
    title=settings.app_name,
    description="支持多种协议的自动化测试平台",
    version=settings.app_version,
    debug=settings.debug
)

# CORS中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=settings.cors_methods,
    allow_headers=settings.cors_headers,
)

# 请求日志中间件
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """详细的请求日志记录"""
    request_id = str(uuid.uuid4())[:8]
    start = time.perf_counter()
    
    # 记录请求信息
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    
    # 记录请求体（仅对JSON请求，且限制大小）
    request_body = ""
    if request.method in ["POST", "PUT", "PATCH"]:
        try:
            body = await request.body()
            if body and len(body) < 1024:  # 限制1KB以内的请求体
                request_body = body.decode('utf-8')
        except Exception:
            request_body = "unable to read body"
    
    # 请求开始日志
    main_logger.info(f"[REQ {request_id}] {request.method} {request.url.path} - IP: {client_ip}")
    if request_body:
        main_logger.info(f"[REQ {request_id}] Body: {request_body}")
    
    # 记录到专门的请求日志文件
    request_logger.info(f"{request.method} {request.url.path} - IP: {client_ip} - {user_agent}")
    
    response = await call_next(request)
    
    duration_ms = (time.perf_counter() - start) * 1000
    
    # 记录响应信息
    main_logger.info(f"[RES {request_id}] {request.method} {request.url.path} -> {response.status_code} ({duration_ms:.1f} ms)")
    
    # 记录慢请求（超过1秒）
    if duration_ms > 1000:
        main_logger.warning(f"[SLOW {request_id}] {request.method} {request.url.path} took {duration_ms:.1f} ms")
    
    return response

# 根路径
@app.get("/")
async def root():
    return {
        "message": settings.app_name,
        "version": settings.app_version,
        "status": "running"
    }

# 健康检查
@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# 注册API路由
try:
    app.include_router(projects.router, prefix="/api/v1", tags=["projects"])
    app.include_router(testcases.router, prefix="/api/v1", tags=["testcases"])
    app.include_router(tests.router, prefix="/api/v1", tags=["tests"])
    app.include_router(versions.router, prefix="/api/v1", tags=["versions"])
    app.include_router(requirements.router, prefix="/api/v1", tags=["requirements"])
    app.include_router(rules.router, prefix="/api/v1/rules", tags=["rules"])
    app.include_router(ai.router, prefix="/api/v1/ai", tags=["ai"])
    main_logger.info("API路由注册成功")
except Exception as e:
    main_logger.error(f"API路由注册失败: {str(e)}")

# 启动时创建数据库表
@app.on_event("startup")
async def startup_event():
    """应用启动时的初始化操作"""
    try:
        create_tables()
        main_logger.info("数据库表创建/验证成功")
    except Exception as e:
        main_logger.error(f"数据库初始化失败: {str(e)}")
    
    main_logger.info(f"{settings.app_name} 启动成功")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug,
        log_level=settings.log_level.lower()
    )