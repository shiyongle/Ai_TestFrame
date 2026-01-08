import logging
import colorlog
from typing import Optional
from config.settings import settings


def setup_colored_logger(name: str, log_file: Optional[str] = None, 
                        color: str = "green", prefix: str = "") -> logging.Logger:
    """设置彩色日志配置"""
    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, settings.log_level))
    
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


def setup_logging():
    """设置应用日志配置"""
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
    
    # 设置根日志器级别
    logging.getLogger().setLevel(logging.INFO)
    
    return main_logger, request_logger, sql_logger, test_logger