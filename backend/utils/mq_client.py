import time
import uuid
from typing import Optional, Dict, Any
from config.settings import settings
from core.logging import setup_logging

logger = setup_logging()[0]

try:
    import pika
    PIKA_AVAILABLE = True
except ImportError:
    PIKA_AVAILABLE = False
    logger.warning("pika库未安装，RabbitMQ功能将不可用")


class MqClient:
    """MQ请求工具类"""
    
    def __init__(self, timeout: Optional[int] = None):
        self.timeout = timeout or settings.default_mq_timeout
    
    async def send_message(
        self,
        mq_type: str,
        host: str,
        port: int,
        queue_name: str,
        message: str,
        exchange: Optional[str] = None,
        routing_key: Optional[str] = None,
        username: str = "guest",
        password: str = "guest",
        timeout: Optional[int] = None
    ) -> Dict[str, Any]:
        """发送消息到消息队列"""
        start_time = time.time()
        connection_timeout = timeout or self.timeout
        
        try:
            if mq_type.lower() == "rabbitmq":
                if not PIKA_AVAILABLE:
                    raise ImportError("pika库未安装，无法使用RabbitMQ功能")
                
                return await self._send_rabbitmq_message(
                    host, port, queue_name, message, exchange, routing_key,
                    username, password, connection_timeout, start_time
                )
            else:
                raise ValueError(f"暂不支持MQ类型: {mq_type}")
                
        except Exception as e:
            execution_time = int((time.time() - start_time) * 1000)
            logger.error(f"MQ消息发送失败: {mq_type} {host}:{port} - {str(e)}")
            return {
                "success": False,
                "message_id": None,
                "response_data": None,
                "execution_time": execution_time,
                "error_message": str(e)
            }
    
    async def _send_rabbitmq_message(
        self,
        host: str,
        port: int,
        queue_name: str,
        message: str,
        exchange: Optional[str],
        routing_key: Optional[str],
        username: str,
        password: str,
        timeout: int,
        start_time: float
    ) -> Dict[str, Any]:
        """发送RabbitMQ消息"""
        try:
            # 创建连接凭据
            credentials = pika.PlainCredentials(username, password)
            
            # 建立连接
            connection = pika.BlockingConnection(
                pika.ConnectionParameters(
                    host=host,
                    port=port,
                    credentials=credentials,
                    connection_timeout=timeout,
                    heartbeat=timeout
                )
            )
            
            # 创建通道
            channel = connection.channel()
            
            # 声明队列
            channel.queue_declare(queue=queue_name, durable=True)
            
            # 生成消息ID
            message_id = str(uuid.uuid4())
            
            # 发送消息
            channel.basic_publish(
                exchange=exchange or '',
                routing_key=routing_key or queue_name,
                body=message.encode('utf-8'),
                properties=pika.BasicProperties(
                    message_id=message_id,
                    content_type='text/plain',
                    delivery_mode=2,  # 持久化消息
                )
            )
            
            # 关闭连接
            connection.close()
            
            execution_time = int((time.time() - start_time) * 1000)
            
            logger.info(f"RabbitMQ消息发送成功: {queue_name} -> {message_id} ({execution_time}ms)")
            
            return {
                "success": True,
                "message_id": message_id,
                "response_data": f"消息已发送到队列: {queue_name}",
                "execution_time": execution_time,
                "error_message": None
            }
            
        except Exception as e:
            execution_time = int((time.time() - start_time) * 1000)
            raise e
    
    async def test_connection(
        self,
        mq_type: str,
        host: str,
        port: int,
        username: str = "guest",
        password: str = "guest",
        timeout: Optional[int] = None
    ) -> Dict[str, Any]:
        """测试MQ连接"""
        start_time = time.time()
        connection_timeout = timeout or self.timeout
        
        try:
            if mq_type.lower() == "rabbitmq":
                if not PIKA_AVAILABLE:
                    raise ImportError("pika库未安装，无法使用RabbitMQ功能")
                
                # 创建连接凭据
                credentials = pika.PlainCredentials(username, password)
                
                # 建立连接
                connection = pika.BlockingConnection(
                    pika.ConnectionParameters(
                        host=host,
                        port=port,
                        credentials=credentials,
                        connection_timeout=connection_timeout
                    )
                )
                
                # 关闭连接
                connection.close()
                
                execution_time = int((time.time() - start_time) * 1000)
                
                logger.info(f"RabbitMQ连接测试成功: {host}:{port} ({execution_time}ms)")
                
                return {
                    "success": True,
                    "response_data": "连接成功",
                    "execution_time": execution_time,
                    "error_message": None
                }
            else:
                raise ValueError(f"暂不支持MQ类型: {mq_type}")
                
        except Exception as e:
            execution_time = int((time.time() - start_time) * 1000)
            logger.error(f"MQ连接测试失败: {mq_type} {host}:{port} - {str(e)}")
            return {
                "success": False,
                "response_data": None,
                "execution_time": execution_time,
                "error_message": str(e)
            }