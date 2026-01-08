"""
大模型API统一客户端
支持多种AI模型的统一调用接口
"""

import json
import asyncio
import aiohttp
from typing import Dict, Any, List, Optional
from abc import ABC, abstractmethod
import logging
from config.settings import settings

logger = logging.getLogger(__name__)

class BaseLLMProvider(ABC):
    """大模型提供商基类"""
    
    @abstractmethod
    async def chat_completion(self, messages: List[Dict], **kwargs) -> Dict[str, Any]:
        """聊天完成接口"""
        pass
    
    @abstractmethod
    async def text_completion(self, prompt: str, **kwargs) -> Dict[str, Any]:
        """文本完成接口"""
        pass

class OpenAIProvider(BaseLLMProvider):
    """OpenAI模型提供商"""
    
    def __init__(self, api_key: str, base_url: str = "https://api.openai.com/v1"):
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
    
    async def chat_completion(self, messages: List[Dict], **kwargs) -> Dict[str, Any]:
        """OpenAI聊天完成"""
        url = f"{self.base_url}/chat/completions"
        data = {
            "model": kwargs.get("model", "gpt-3.5-turbo"),
            "messages": messages,
            "temperature": kwargs.get("temperature", 0.7),
            "max_tokens": kwargs.get("max_tokens", 2000)
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=data, headers=self.headers) as response:
                if response.status == 200:
                    result = await response.json()
                    return {
                        "success": True,
                        "content": result["choices"][0]["message"]["content"],
                        "usage": result.get("usage", {}),
                        "model": result["model"]
                    }
                else:
                    error_text = await response.text()
                    logger.error(f"OpenAI API调用失败: {error_text}")
                    return {"success": False, "error": error_text}
    
    async def text_completion(self, prompt: str, **kwargs) -> Dict[str, Any]:
        """OpenAI文本完成"""
        url = f"{self.base_url}/completions"
        data = {
            "model": kwargs.get("model", "text-davinci-003"),
            "prompt": prompt,
            "temperature": kwargs.get("temperature", 0.7),
            "max_tokens": kwargs.get("max_tokens", 2000)
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=data, headers=self.headers) as response:
                if response.status == 200:
                    result = await response.json()
                    return {
                        "success": True,
                        "content": result["choices"][0]["text"],
                        "usage": result.get("usage", {}),
                        "model": result["model"]
                    }
                else:
                    error_text = await response.text()
                    logger.error(f"OpenAI API调用失败: {error_text}")
                    return {"success": False, "error": error_text}

class GLMProvider(BaseLLMProvider):
    """智谱GLM模型提供商"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://open.bigmodel.cn/api/paas/v4"
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
    
    async def chat_completion(self, messages: List[Dict], **kwargs) -> Dict[str, Any]:
        """GLM聊天完成"""
        url = f"{self.base_url}/chat/completions"
        data = {
            "model": kwargs.get("model", "glm-4"),
            "messages": messages,
            "temperature": kwargs.get("temperature", 0.7),
            "max_tokens": kwargs.get("max_tokens", 2000)
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=data, headers=self.headers) as response:
                if response.status == 200:
                    result = await response.json()
                    return {
                        "success": True,
                        "content": result["choices"][0]["message"]["content"],
                        "usage": result.get("usage", {}),
                        "model": result["model"]
                    }
                else:
                    error_text = await response.text()
                    logger.error(f"GLM API调用失败: {error_text}")
                    return {"success": False, "error": error_text}
    
    async def text_completion(self, prompt: str, **kwargs) -> Dict[str, Any]:
        """GLM文本完成"""
        messages = [{"role": "user", "content": prompt}]
        return await self.chat_completion(messages, **kwargs)

class TongyiProvider(BaseLLMProvider):
    """阿里云通义千问模型提供商"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation"
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
    
    async def chat_completion(self, messages: List[Dict], **kwargs) -> Dict[str, Any]:
        """通义千问聊天完成"""
        data = {
            "model": kwargs.get("model", "qwen-turbo"),
            "input": {
                "messages": messages
            },
            "parameters": {
                "temperature": kwargs.get("temperature", 0.7),
                "max_tokens": kwargs.get("max_tokens", 2000)
            }
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(self.base_url, json=data, headers=self.headers) as response:
                if response.status == 200:
                    result = await response.json()
                    return {
                        "success": True,
                        "content": result["output"]["choices"][0]["message"]["content"],
                        "usage": result.get("usage", {}),
                        "model": result["output"]["model"]
                    }
                else:
                    error_text = await response.text()
                    logger.error(f"通义千问API调用失败: {error_text}")
                    return {"success": False, "error": error_text}
    
    async def text_completion(self, prompt: str, **kwargs) -> Dict[str, Any]:
        """通义千问文本完成"""
        messages = [{"role": "user", "content": prompt}]
        return await self.chat_completion(messages, **kwargs)

class LLMClient:
    """大模型统一客户端"""
    
    def __init__(self):
        self.providers = {}
        self._init_providers()
    
    def _init_providers(self):
        """初始化模型提供商"""
        # OpenAI
        if hasattr(settings, 'OPENAI_API_KEY') and settings.OPENAI_API_KEY:
            self.providers['openai'] = OpenAIProvider(
                api_key=settings.OPENAI_API_KEY,
                base_url=getattr(settings, 'OPENAI_BASE_URL', "https://api.openai.com/v1")
            )
        
        # 智谱GLM
        if hasattr(settings, 'GLM_API_KEY') and settings.GLM_API_KEY:
            self.providers['glm'] = GLMProvider(api_key=settings.GLM_API_KEY)
        
        # 通义千问
        if hasattr(settings, 'TONGYI_API_KEY') and settings.TONGYI_API_KEY:
            self.providers['tongyi'] = TongyiProvider(api_key=settings.TONGYI_API_KEY)
        
        logger.info(f"已初始化的大模型提供商: {list(self.providers.keys())}")
    
    async def chat_completion(
        self, 
        messages: List[Dict], 
        provider: str = "glm",
        **kwargs
    ) -> Dict[str, Any]:
        """统一聊天完成接口"""
        if provider not in self.providers:
            return {
                "success": False, 
                "error": f"不支持的模型提供商: {provider}，可用提供商: {list(self.providers.keys())}"
            }
        
        try:
            return await self.providers[provider].chat_completion(messages, **kwargs)
        except Exception as e:
            logger.error(f"聊天完成调用失败: {e}")
            return {"success": False, "error": str(e)}
    
    async def text_completion(
        self, 
        prompt: str, 
        provider: str = "glm",
        **kwargs
    ) -> Dict[str, Any]:
        """统一文本完成接口"""
        if provider not in self.providers:
            return {
                "success": False, 
                "error": f"不支持的模型提供商: {provider}，可用提供商: {list(self.providers.keys())}"
            }
        
        try:
            return await self.providers[provider].text_completion(prompt, **kwargs)
        except Exception as e:
            logger.error(f"文本完成调用失败: {e}")
            return {"success": False, "error": str(e)}
    
    def get_available_providers(self) -> List[str]:
        """获取可用的模型提供商列表"""
        return list(self.providers.keys())
    
    async def test_connection(self, provider: str) -> bool:
        """测试模型提供商连接"""
        if provider not in self.providers:
            return False
        
        try:
            result = await self.text_completion("测试连接", provider=provider, max_tokens=10)
            return result.get("success", False)
        except Exception as e:
            logger.error(f"测试连接失败: {e}")
            return False

# 全局实例
llm_client = LLMClient()