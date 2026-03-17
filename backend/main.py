from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import asyncio
from starlette.responses import Response
from fastapi.middleware.cors import CORSMiddleware
import time
import uuid
from config.settings import settings
from core.logging import setup_logging
from core.database import create_tables
from api.v1 import projects, testcases, interface_testcases, tests, versions, requirements, rules, ai, system, test_suites, dashboard, reports, test_plans

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
            
            # 修复：Starlette 中间件中读取 body 后，会消耗掉 stream
            # 必须重置 _receive 使得后续路由可以继续读取
            async def receive():
                return {"type": "http.request", "body": body}
            request._receive = receive
            
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
    
    try:
        response = await asyncio.wait_for(call_next(request), timeout=15)
    except asyncio.TimeoutError:
        main_logger.error(f"[RES {request_id}] {request.method} {request.url.path} -> 504 (timeout)")
        request_logger.error(f"{request.method} {request.url.path} -> 504 (timeout)")
        return JSONResponse(
            status_code=504,
            content={"success": False, "message": "request timeout", "error": "gateway timeout"}
        )
    
    duration_ms = (time.perf_counter() - start) * 1000
    
    # 记录响应信息
    main_logger.info(f"[RES {request_id}] {request.method} {request.url.path} -> {response.status_code} ({duration_ms:.1f} ms)")
    request_logger.info(f"{request.method} {request.url.path} -> {response.status_code} ({duration_ms:.1f} ms)")
    
    # 记录慢请求（超过1秒）
    if duration_ms > 1000:
        main_logger.warning(f"[SLOW {request_id}] {request.method} {request.url.path} took {duration_ms:.1f} ms")
    
    # 记录错误响应体（仅限较小的响应）
    if response.status_code >= 400:
        try:
            body = b""
            async for chunk in response.body_iterator:
                body += chunk
            if body:
                body_text = body.decode("utf-8", errors="replace")
                if len(body_text) > 2000:
                    body_text = body_text[:2000] + "...(truncated)"
                main_logger.warning(f"[RES {request_id}] Body: {body_text}")
                request_logger.warning(f"{request.method} {request.url.path} Body: {body_text}")
            response = Response(
                content=body,
                status_code=response.status_code,
                headers=dict(response.headers),
                media_type=response.media_type
            )
        except Exception as e:
            main_logger.error(f"[RES {request_id}] Failed to read error body: {e}")

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
    app.include_router(interface_testcases.router, prefix="/api/v1", tags=["interface_testcases"])
    app.include_router(tests.router, prefix="/api/v1", tags=["tests"])
    app.include_router(versions.router, prefix="/api/v1", tags=["versions"])
    app.include_router(requirements.router, prefix="/api/v1", tags=["requirements"])
    app.include_router(rules.router, prefix="/api/v1/rules", tags=["rules"])
    app.include_router(ai.router, prefix="/api/v1/ai", tags=["ai"])
    app.include_router(system.router, prefix="/api/v1/system", tags=["system"])
    app.include_router(test_suites.router, prefix="/api/v1", tags=["test_suites"])
    app.include_router(test_plans.router, prefix="/api/v1", tags=["test_plans"])
    app.include_router(dashboard.router, prefix="/api/v1", tags=["dashboard"])
    app.include_router(reports.router, prefix="/api/v1", tags=["reports"])
    main_logger.info("API路由注册成功")
except Exception as e:
    main_logger.error(f"API路由注册失败: {str(e)}")

# 启动时创建数据库表
@app.on_event("startup")
async def startup_event():
    """应用启动时的初始化操作"""
    try:
        main_logger.info(f"正在检查数据库连接... URL: {settings.database_url.replace(settings.mysql_password, '******')}")
        from sqlalchemy import text
        from core.database import engine
        with engine.connect() as connection:
            result = connection.execute(text("SELECT 1"))
            main_logger.info(f"数据库连接测试成功! Result: {result.scalar()}")
            
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

