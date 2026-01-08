import aiohttp
import asyncio
import time
from typing import Dict, Any, Optional, Union
from config.settings import settings
from core.logging import setup_logging

logger = setup_logging()[0]


class HttpClient:
    """HTTP请求工具类"""
    
    def __init__(self, timeout: Optional[int] = None):
        self.timeout = timeout or settings.default_http_timeout
        self.session = None
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=self.timeout)
        )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def request(
        self,
        method: str,
        url: str,
        headers: Optional[Dict[str, str]] = None,
        params: Optional[Dict[str, Any]] = None,
        data: Optional[Union[str, Dict[str, Any]]] = None,
        json: Optional[Dict[str, Any]] = None,
        verify_ssl: bool = True,
        follow_redirects: bool = True,
        timeout: Optional[int] = None
    ) -> Dict[str, Any]:
        """执行HTTP请求"""
        start_time = time.time()
        request_timeout = timeout or self.timeout
        
        try:
            async with self.session.request(
                method=method,
                url=url,
                headers=headers,
                params=params,
                data=data if not isinstance(data, dict) else None,
                json=data if isinstance(data, dict) else None,
                timeout=aiohttp.ClientTimeout(total=request_timeout),
                ssl=verify_ssl,
                allow_redirects=follow_redirects
            ) as response:
                execution_time = int((time.time() - start_time) * 1000)
                
                # 尝试解析JSON响应
                try:
                    body = await response.json()
                except:
                    body = await response.text()
                
                result = {
                    "status_code": response.status,
                    "headers": dict(response.headers),
                    "body": body,
                    "execution_time": execution_time,
                    "success": 200 <= response.status < 400,
                    "error_message": None if 200 <= response.status < 400 else f"HTTP状态码: {response.status}"
                }
                
                logger.info(f"HTTP请求完成: {method} {url} -> {response.status} ({execution_time}ms)")
                return result
                
        except asyncio.TimeoutError:
            execution_time = int((time.time() - start_time) * 1000)
            logger.error(f"HTTP请求超时: {method} {url} ({execution_time}ms)")
            return {
                "status_code": 0,
                "headers": {},
                "body": None,
                "execution_time": execution_time,
                "success": False,
                "error_message": "请求超时"
            }
        except Exception as e:
            execution_time = int((time.time() - start_time) * 1000)
            logger.error(f"HTTP请求失败: {method} {url} - {str(e)}")
            return {
                "status_code": 0,
                "headers": {},
                "body": None,
                "execution_time": execution_time,
                "success": False,
                "error_message": str(e)
            }
    
    async def get(self, url: str, **kwargs) -> Dict[str, Any]:
        """GET请求"""
        return await self.request("GET", url, **kwargs)
    
    async def post(self, url: str, **kwargs) -> Dict[str, Any]:
        """POST请求"""
        return await self.request("POST", url, **kwargs)
    
    async def put(self, url: str, **kwargs) -> Dict[str, Any]:
        """PUT请求"""
        return await self.request("PUT", url, **kwargs)
    
    async def delete(self, url: str, **kwargs) -> Dict[str, Any]:
        """DELETE请求"""
        return await self.request("DELETE", url, **kwargs)
    
    async def patch(self, url: str, **kwargs) -> Dict[str, Any]:
        """PATCH请求"""
        return await self.request("PATCH", url, **kwargs)
    
    async def head(self, url: str, **kwargs) -> Dict[str, Any]:
        """HEAD请求"""
        return await self.request("HEAD", url, **kwargs)
    
    async def options(self, url: str, **kwargs) -> Dict[str, Any]:
        """OPTIONS请求"""
        return await self.request("OPTIONS", url, **kwargs)