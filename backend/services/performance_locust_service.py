from services.performance_service import PerformanceService


class PerformanceLocustService(PerformanceService):
    """Locust 执行引擎适配层。

    当前先复用 [`services.performance_service.PerformanceService`](backend/services/performance_service.py:1)
    的运行编排与模拟指标能力，后续可在此替换为真实 Locust 进程编排。
    """

    pass


def get_performance_service() -> PerformanceLocustService:
    """获取性能测试服务实例"""
    return PerformanceLocustService()
