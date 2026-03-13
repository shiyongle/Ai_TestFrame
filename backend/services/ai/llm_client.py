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
from core.database import SessionLocal
from models.database_models import SystemSetting

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

    @abstractmethod
    async def create_embedding(self, text: str, **kwargs) -> Dict[str, Any]:
        """生成文本的Embedding向量"""
        pass

class OpenAIProvider(BaseLLMProvider):
    """大模型OpenAI兼容接口提供商"""
    
    def __init__(self, api_key: str, base_url: str = "https://api.openai.com/v1", default_model: str = "gpt-3.5-turbo", default_embedding_model: str = "text-embedding-3-small"):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.default_model = default_model
        self.default_embedding_model = default_embedding_model
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
    
    async def chat_completion(self, messages: List[Dict], **kwargs) -> Dict[str, Any]:
        """OpenAI聘天完成"""
        url = f"{self.base_url}/chat/completions"
        data = {
            "model": kwargs.get("model", self.default_model),
            "messages": messages,
            "temperature": kwargs.get("temperature", 0.7),
            "max_tokens": kwargs.get("max_tokens", 4096)
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
                    logger.error(f"调用 {self.default_model} API失败: {error_text}")
                    return {"success": False, "error": error_text}
    
    async def text_completion(self, prompt: str, **kwargs) -> Dict[str, Any]:
        """文本完成（复用chat接口实现，兼容DeepSeek等不支持旧式/completions的模型"""
        messages = [{"role": "user", "content": prompt}]
        return await self.chat_completion(messages, **kwargs)

    async def create_embedding(self, text: str, **kwargs) -> Dict[str, Any]:
        """OpenAI生成Embedding"""
        url = f"{self.base_url}/embeddings"
        data = {
            "model": kwargs.get("model", self.default_embedding_model),
            "input": text
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=data, headers=self.headers) as response:
                if response.status == 200:
                    result = await response.json()
                    return {
                        "success": True,
                        "embedding": result["data"][0]["embedding"],
                        "usage": result.get("usage", {}),
                        "model": result["model"]
                    }
                else:
                    error_text = await response.text()
                    logger.error(f"调用 {data['model']} Embedding API失败: {error_text}")
                    return {"success": False, "error": error_text}

class GLMProvider(BaseLLMProvider):
    """智谱GLM模型提供商"""
    
    def __init__(self, api_key: str, base_url: str = "https://open.bigmodel.cn/api/paas/v4"):
        self.api_key = api_key
        self.base_url = base_url
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
            "max_tokens": kwargs.get("max_tokens", 4096)
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

    async def create_embedding(self, text: str, **kwargs) -> Dict[str, Any]:
        """GLM生成Embedding"""
        url = f"{self.base_url}/embeddings"
        data = {
            "model": kwargs.get("model", "embedding-3"),
            "input": text
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=data, headers=self.headers) as response:
                if response.status == 200:
                    result = await response.json()
                    return {
                        "success": True,
                        "embedding": result["data"][0]["embedding"],
                        "usage": result.get("usage", {}),
                        "model": result.get("model", "embedding-3")
                    }
                else:
                    error_text = await response.text()
                    logger.error(f"GLM Embedding API调用失败: {error_text}")
                    return {"success": False, "error": error_text}

class TongyiProvider(BaseLLMProvider):
    """阿里云通义千问模型提供商"""
    
    def __init__(self, api_key: str, base_url: str = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation"):
        self.api_key = api_key
        self.base_url = base_url
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
                "max_tokens": kwargs.get("max_tokens", 4096)
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

    async def create_embedding(self, text: str, **kwargs) -> Dict[str, Any]:
        """通义千问生成Embedding"""
        url = "https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding"
        data = {
            "model": kwargs.get("model", "text-embedding-v3"),
            "input": {
                "texts": [text]
            }
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=data, headers=self.headers) as response:
                if response.status == 200:
                    result = await response.json()
                    return {
                        "success": True,
                        "embedding": result["output"]["embeddings"][0]["embedding"],
                        "usage": result.get("usage", {}),
                        "model": data["model"]
                    }
                else:
                    error_text = await response.text()
                    logger.error(f"通义千问Embedding API调用失败: {error_text}")
                    return {"success": False, "error": error_text}

class LLMClient:
    """大模型统一客户端"""
    
    def __init__(self):
        self.providers = {}
        self._init_providers()
    
    def _init_providers(self):
        """初始化模型提供商"""
        db_settings = {}
        try:
            # Create a short-lived session to read db configs
            with SessionLocal() as db:
                records = db.query(SystemSetting).filter(SystemSetting.category == 'llm').all()
                for rec in records:
                    db_settings[rec.setting_key] = rec.setting_value
        except Exception as e:
            logger.error(f"Failed to load LLM settings from DB: {e}")

        # OpenAI
        openai_key = db_settings.get('OPENAI_API_KEY') or getattr(settings, 'OPENAI_API_KEY', None)
        openai_base_url = db_settings.get('OPENAI_BASE_URL') or getattr(settings, 'OPENAI_BASE_URL', "https://api.openai.com/v1")
        if openai_key and str(openai_key).strip():
            self.providers['openai'] = OpenAIProvider(api_key=str(openai_key).strip(), base_url=openai_base_url)
        
        # 智谱GLM
        glm_key = db_settings.get('GLM_API_KEY') or getattr(settings, 'GLM_API_KEY', None)
        glm_base_url = db_settings.get('GLM_BASE_URL') or getattr(settings, 'GLM_BASE_URL', "https://open.bigmodel.cn/api/paas/v4")
        if glm_key and str(glm_key).strip():
            self.providers['glm'] = GLMProvider(api_key=str(glm_key).strip(), base_url=glm_base_url)
        
        # 通义千问
        tongyi_key = db_settings.get('TONGYI_API_KEY') or getattr(settings, 'TONGYI_API_KEY', None)
        tongyi_base_url = db_settings.get('TONGYI_BASE_URL') or getattr(settings, 'TONGYI_BASE_URL', "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation")
        if tongyi_key and str(tongyi_key).strip():
            self.providers['tongyi'] = TongyiProvider(api_key=str(tongyi_key).strip(), base_url=tongyi_base_url)
            
        # DeepSeek
        deepseek_key = db_settings.get('DEEPSEEK_API_KEY') or getattr(settings, 'DEEPSEEK_API_KEY', None)
        deepseek_base_url = db_settings.get('DEEPSEEK_BASE_URL') or getattr(settings, 'DEEPSEEK_BASE_URL', "https://api.deepseek.com/v1")
        # DeepSeek 兼容OpenAI接口，但需要指定默认模型名 deepseek-chat
        if deepseek_key and str(deepseek_key).strip():
            self.providers['deepseek'] = OpenAIProvider(api_key=str(deepseek_key).strip(), base_url=deepseek_base_url, default_model='deepseek-chat')
            
        # 硅基流动 (Siliconflow)
        siliconflow_key = db_settings.get('SILICONFLOW_API_KEY') or getattr(settings, 'SILICONFLOW_API_KEY', None)
        siliconflow_base_url = db_settings.get('SILICONFLOW_BASE_URL') or getattr(settings, 'SILICONFLOW_BASE_URL', "https://api.siliconflow.cn/v1")
        siliconflow_chat_model = db_settings.get('SILICONFLOW_CHAT_MODEL') or getattr(settings, 'SILICONFLOW_CHAT_MODEL', 'Qwen/Qwen2.5-7B-Instruct')
        # Siliconflow 兼容 OpenAI 接口，但 Embedding 模型名与 OpenAI 不同
        if siliconflow_key and str(siliconflow_key).strip():
            self.providers['siliconflow'] = OpenAIProvider(
                api_key=str(siliconflow_key).strip(),
                base_url=siliconflow_base_url,
                default_model=str(siliconflow_chat_model).strip() if siliconflow_chat_model else 'Qwen/Qwen2.5-7B-Instruct',
                default_embedding_model='Qwen/Qwen3-Embedding-8B'
            )
        
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
    
    async def create_embedding(
        self, 
        text: str, 
        provider: str = "glm",
        **kwargs
    ) -> Dict[str, Any]:
        """统一Embedding接口"""
        # 检查提供商是否存在或是否为 deepseek (deepseek 不支持 embedding)
        if provider not in self.providers or provider == "deepseek":
            # 优雅降级：如果请求的 provider 不支持/不存在，尝试使用配置中默认的 Embedding Provider
            fallback_provider = getattr(settings, 'EMBEDDING_PROVIDER', 'glm')
            
            # 如果默认的 fallback provider 可用，则使用它
            if fallback_provider in self.providers and fallback_provider != "deepseek":
                logger.info(f"模型 {provider} 不支持/未配置 Embedding，自动回退到: {fallback_provider}")
                provider = fallback_provider
            else:
                # 否则，尝试寻找任何一个非 deepseek 且已配置的提供商
                available_embedding_providers = [p for p in self.providers.keys() if p != "deepseek"]
                if available_embedding_providers:
                    fallback_provider = available_embedding_providers[0]
                    logger.info(f"模型 {provider} 不支持/未配置 Embedding，自动回退到已配置的可用模型: {fallback_provider}")
                    provider = fallback_provider
                else:
                    return {
                        "success": False, 
                        "error": f"不支持的模型提供商: {provider} 且系统内没有可用的 Embedding 替代提供商 (如 GLM, OpenAI 等)。请配置 EMBEDDING_PROVIDER 对应的 API KEY。"
                    }
        
        try:
            return await self.providers[provider].create_embedding(text, **kwargs)
        except Exception as e:
            logger.error(f"Embedding调用失败: {e}")
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

    def refresh_providers(self):
        """重新初始化底层库(当用户修改配置后调用)"""
        self.providers.clear()
        self._init_providers()

# 全局实例
llm_client = LLMClient()