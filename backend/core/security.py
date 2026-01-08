from fastapi.security import HTTPBearer
from fastapi import HTTPException, status

# 安全认证实例
security = HTTPBearer()


async def verify_token(token: str = security) -> dict:
    """验证访问令牌"""
    # TODO: 实现JWT令牌验证逻辑
    # 目前简化处理，直接通过
    return {"user_id": 1, "username": "admin"}