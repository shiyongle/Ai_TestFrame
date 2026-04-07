from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from api.deps import get_database, get_performance_service
from schemas.performance_schemas import (
    PerformanceOverviewResponse,
    PerformanceRunControlResponse,
    PerformanceRunCreate,
    PerformanceRunCreateResponse,
    PerformanceRunDetail,
    PerformanceRunSummary,
    PerformanceScenarioCreate,
    PerformanceScenarioCreateResponse,
    PerformanceScenarioDetail,
    PerformanceScenarioSummary,
    PerformanceScenarioUpdate,
    PerformanceTrendResponse,
)
from utils.activity_logger import log_activity

router = APIRouter()


@router.get("/performance/scenarios", response_model=List[PerformanceScenarioSummary])
async def list_performance_scenarios(
    project_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_database),
    service=Depends(get_performance_service),
):
    items = service.list_scenarios(db, project_id)
    return [service.serialize_scenario(item) for item in items]


@router.get("/performance/scenarios/{scenario_id}", response_model=PerformanceScenarioDetail)
async def get_performance_scenario(
    scenario_id: int,
    db: Session = Depends(get_database),
    service=Depends(get_performance_service),
):
    scenario = service.get_scenario(db, scenario_id)
    if not scenario:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="性能测试场景不存在")
    return service.serialize_scenario_detail(scenario)


@router.post("/performance/scenarios", response_model=PerformanceScenarioCreateResponse)
async def create_performance_scenario(
    payload: PerformanceScenarioCreate,
    db: Session = Depends(get_database),
    service=Depends(get_performance_service),
):
    try:
        scenario = service.create_scenario(db, payload)
        log_activity(db, action="create", module="性能测试", target_name=scenario.name, detail=f"场景ID={scenario.id}")
        return {"scenario": service.serialize_scenario(scenario)}
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"创建性能测试场景失败: {exc}")


@router.put("/performance/scenarios/{scenario_id}", response_model=PerformanceScenarioCreateResponse)
async def update_performance_scenario(
    scenario_id: int,
    payload: PerformanceScenarioUpdate,
    db: Session = Depends(get_database),
    service=Depends(get_performance_service),
):
    try:
        scenario = service.update_scenario(db, scenario_id, payload)
        if not scenario:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="性能测试场景不存在")
        log_activity(db, action="update", module="性能测试", target_name=scenario.name, detail=f"场景ID={scenario.id}")
        return {"scenario": service.serialize_scenario(scenario)}
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.delete("/performance/scenarios/{scenario_id}")
async def delete_performance_scenario(
    scenario_id: int,
    db: Session = Depends(get_database),
    service=Depends(get_performance_service),
):
    scenario = service.get_scenario(db, scenario_id)
    if not scenario:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="性能测试场景不存在")
    success = service.delete_scenario(db, scenario_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="性能测试场景不存在")
    log_activity(db, action="delete", module="性能测试", target_name=scenario.name, detail=f"场景ID={scenario_id}")
    return {"message": "性能测试场景删除成功"}


@router.get("/performance/runs", response_model=List[PerformanceRunSummary])
async def list_performance_runs(
    project_id: Optional[int] = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_database),
    service=Depends(get_performance_service),
):
    runs = service.list_runs(db, project_id, limit)
    return [service.serialize_run(item) for item in runs]


@router.get("/performance/runs/{run_id}", response_model=PerformanceRunDetail)
async def get_performance_run(
    run_id: int,
    db: Session = Depends(get_database),
    service=Depends(get_performance_service),
):
    run = service.get_run(db, run_id)
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="性能测试运行记录不存在")
    return service.build_run_detail(db, run)


@router.post("/performance/runs", response_model=PerformanceRunCreateResponse)
async def create_performance_run(
    payload: PerformanceRunCreate,
    db: Session = Depends(get_database),
    service=Depends(get_performance_service),
):
    try:
        run = service.create_run(db, payload)
        log_activity(db, action="create", module="性能测试", target_name=run.scenario_name, detail=f"运行ID={run.id}")
        return {"run": service.serialize_run(run)}
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"创建性能测试运行失败: {exc}")


@router.post("/performance/runs/{run_id}/start", response_model=PerformanceRunControlResponse)
async def start_performance_run(
    run_id: int,
    db: Session = Depends(get_database),
    service=Depends(get_performance_service),
):
    try:
        run = service.start_run(db, run_id)
        log_activity(db, action="execute", module="性能测试", target_name=run.scenario_name, detail=f"运行ID={run.id}")
        return {"run_id": run.id, "status": run.status, "stage": run.stage, "message": "性能测试已启动"}
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/performance/runs/{run_id}/stop", response_model=PerformanceRunControlResponse)
async def stop_performance_run(
    run_id: int,
    db: Session = Depends(get_database),
    service=Depends(get_performance_service),
):
    try:
        run = service.stop_run(db, run_id)
        log_activity(db, action="update", module="性能测试", target_name=run.scenario_name, detail=f"停止运行ID={run.id}")
        return {"run_id": run.id, "status": run.status, "stage": run.stage, "message": "性能测试停止指令已下发"}
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/performance/overview", response_model=PerformanceOverviewResponse)
async def get_performance_overview(
    project_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_database),
    service=Depends(get_performance_service),
):
    return service.build_overview(db, project_id)


@router.get("/performance/runs/{run_id}/trend", response_model=PerformanceTrendResponse)
async def get_performance_trend(
    run_id: int,
    db: Session = Depends(get_database),
    service=Depends(get_performance_service),
):
    run = service.get_run(db, run_id)
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="性能测试运行记录不存在")
    return service.build_trend(db, run_id)
