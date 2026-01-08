import asyncio
import time
from typing import Optional, Dict, Any
from config.settings import settings
from core.logging import setup_logging

logger = setup_logging()[0]


class TcpClient:
    """TCP请求工具类"""
    
    def __init__(self, timeout: Optional[int] = None):
        self.timeout = timeout or settings.default_tcp_timeout
    
    async def connect(
        self,
        host: str,
        port: int,
        data: str,
        encoding: str = "utf-8",
        timeout: Optional[int] = None
    ) -> Dict[str, Any]:
        """执行TCP连接和数据传输"""
        start_time = time.time()
        connection_timeout = timeout or self.timeout
        
        try:
            # 建立TCP连接
            future = asyncio.open_connection(host, port)
            reader, writer = await asyncio.wait_for(future, timeout=connection_timeout)
            
            # 发送数据
            writer.write(data.encode(encoding))
            await writer.drain()
            
            # 接收响应
            response_data = await asyncio.wait_for(reader.read(1024), timeout=connection_timeout)
            response_str = response_data.decode(encoding)
            
            # 关闭连接
            writer.close()
            await writer.wait_closed()
            
            execution_time = int((time.time() - start_time) * 1000)
            
            logger.info(f"TCP请求完成: {host}:{port} -> 成功 ({execution_time}ms)")
            
            return {
                "success": True,
                "response_data": response_str,
                "execution_time": execution_time,
                "error_message": None
            }
            
        except asyncio.TimeoutError:
            execution_time = int((time.time() - start_time) * 1000)
            logger.error(f"TCP请求超时: {host}:{port} ({execution_time}ms)")
            return {
                "success": False,
                "response_data": None,
                "execution_time": execution_time,
                "error_message": "连接超时"
            }
        except ConnectionRefusedError:
            execution_time = int((time.time() - start_time) * 1000)
            logger.error(f"TCP连接被拒绝: {host}:{port} ({execution_time}ms)")
            return {
                "success": False,
                "response_data": None,
                "execution_time": execution_time,
                "error_message": "连接被拒绝"
            }
        except Exception as e:
            execution_time = int((time.time() - start_time) * 1000)
            logger.error(f"TCP请求失败: {host}:{port} - {str(e)}")
            return {
                "success": False,
                "response_data": None,
                "execution_time": execution_time,
                "error_message": str(e)
            }
    
    async def test_connection(
        self,
        host: str,
        port: int,
        timeout: Optional[int] = None
    ) -> Dict[str, Any]:
        """测试TCP连接"""
        start_time = time.time()
        connection_timeout = timeout or self.timeout
        
        try:
            future = asyncio.open_connection(host, port)
            reader, writer = await asyncio.wait_for(future, timeout=connection_timeout)
            
            writer.close()
            await writer.wait_closed()
            
            execution_time = int((time.time() - start_time) * 1000)
            
            logger.info(f"TCP连接测试成功: {host}:{port} ({execution_time}ms)")
            
            return {
                "success": True,
                "response_data": "连接成功",
                "execution_time": execution_time,
                "error_message": None
            }
            
        except Exception as e:
            execution_time = int((time.time() - start_time) * 1000)
            logger.error(f"TCP连接测试失败: {host}:{port} - {str(e)}")
            return {
                "success": False,
                "response_data": None,
                "execution_time": execution_time,
                "error_message": str(e)
            }