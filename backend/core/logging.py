import logging
import colorlog
from typing import Optional
from config.settings import settings


def setup_colored_logger(name: str, log_file: Optional[str] = None,
                         color: str = "green", prefix: str = "") -> logging.Logger:
    """设置彩色日志配置"""
    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, settings.log_level))

    # 防止日志向上传播到 root logger（避免 uvicorn 的 handler 重复输出）
    logger.propagate = False

    # 清除现有处理器
    logger.handlers.clear()

    # 控制台处理器（彩色）
    console_handler = colorlog.StreamHandler()
    console_formatter = colorlog.ColoredFormatter(
        f'%(log_color)s{prefix}%(bold)s%(asctime)s%(reset)s%(log_color)s - %(levelname)s - %(message)s%(reset)s',
        datefmt='%H:%M:%S',
        log_colors={
            'DEBUG': 'cyan',
            'INFO': color,
            'WARNING': 'yellow',
            'ERROR': 'red',
            'CRITICAL': 'red,bg_white',
        }
    )
    console_handler.setFormatter(console_formatter)
    logger.addHandler(console_handler)

    # 文件处理器（无颜色）
    if log_file:
        file_handler = logging.FileHandler(log_file, encoding='utf-8')
        file_formatter = logging.Formatter(
            f'{prefix}%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        file_handler.setFormatter(file_formatter)
        logger.addHandler(file_handler)

    return logger


def reconfigure_uvicorn_loggers():
    """重新配置 uvicorn 的日志器，使其使用彩色格式

    uvicorn 启动时会自动配置自己的日志系统（uvicorn、uvicorn.error、uvicorn.access），
    这些默认配置会覆盖我们的 colorlog 彩色格式。此函数在 setup_logging() 中调用，
    将 uvicorn 的日志器也替换为彩色格式。
    """
    for logger_name in ["uvicorn", "uvicorn.error"]:
        uv_logger = logging.getLogger(logger_name)
        uv_logger.handlers.clear()
        uv_logger.propagate = False
        uv_logger.setLevel(logging.INFO)

        handler = colorlog.StreamHandler()
        formatter = colorlog.ColoredFormatter(
            '%(log_color)s%(bold)s%(asctime)s%(reset)s%(log_color)s - %(levelname)s - %(message)s%(reset)s',
            datefmt='%H:%M:%S',
            log_colors={
                'DEBUG': 'cyan',
                'INFO': 'cyan',
                'WARNING': 'yellow',
                'ERROR': 'red',
                'CRITICAL': 'red,bg_white',
            }
        )
        handler.setFormatter(formatter)
        uv_logger.addHandler(handler)

    # uvicorn.access 日志器 — 使用白色降低视觉噪音
    access_logger = logging.getLogger("uvicorn.access")
    access_logger.handlers.clear()
    access_logger.propagate = False
    access_logger.setLevel(logging.INFO)

    access_handler = colorlog.StreamHandler()
    access_formatter = colorlog.ColoredFormatter(
        '%(log_color)s%(bold)s%(asctime)s%(reset)s%(log_color)s - %(levelname)s - %(message)s%(reset)s',
        datefmt='%H:%M:%S',
        log_colors={
            'DEBUG': 'cyan',
            'INFO': 'white',
            'WARNING': 'yellow',
            'ERROR': 'red',
            'CRITICAL': 'red,bg_white',
        }
    )
    access_handler.setFormatter(access_formatter)
    access_logger.addHandler(access_handler)


def setup_logging():
    """设置应用日志配置"""
    # 禁用 uvicorn 默认日志配置的影响，重新配置为彩色
    reconfigure_uvicorn_loggers()

    # 主日志器
    main_logger = setup_colored_logger(
        "main",
        settings.log_file,
        color="green"
    )

    # 请求日志器
    request_logger = setup_colored_logger(
        "request",
        settings.request_log_file,
        color="blue",
        prefix="[REQUEST] "
    )

    # SQL日志器 - 设置SQLAlchemy引擎日志
    sql_logger = setup_colored_logger(
        "sqlalchemy.engine",
        settings.sql_log_file,
        color="purple",
        prefix="[SQL] "
    )

    # 确保SQL日志级别正确
    sql_logger.setLevel(logging.INFO)

    # 测试执行日志器
    test_logger = setup_colored_logger(
        "test_execution",
        color="green",
        prefix="[TEST] "
    )

    # 设置根日志器级别，并清除 root handler 避免重复输出
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    # 如果 root logger 有非 colorlog 的 handler（由 uvicorn 注入），清除它们
    root_logger.handlers = [
        h for h in root_logger.handlers
        if isinstance(h, colorlog.StreamHandler)
    ]
    # 如果 root logger 没有 handler，添加一个彩色的
    if not root_logger.handlers:
        root_handler = colorlog.StreamHandler()
        root_formatter = colorlog.ColoredFormatter(
            '%(log_color)s%(bold)s%(asctime)s%(reset)s%(log_color)s - %(levelname)s - %(name)s - %(message)s%(reset)s',
            datefmt='%H:%M:%S',
            log_colors={
                'DEBUG': 'cyan',
                'INFO': 'green',
                'WARNING': 'yellow',
                'ERROR': 'red',
                'CRITICAL': 'red,bg_white',
            }
        )
        root_handler.setFormatter(root_formatter)
        root_logger.addHandler(root_handler)

    return main_logger, request_logger, sql_logger, test_logger
