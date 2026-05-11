"""
BadCase（不良案例）与 DifyAgent 管理服务
参考 xapp 的 Agent + BadCase + BadCaseTurn 架构
"""

from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from core.database import SessionLocal
from models.database_models import BadCase, BadCaseTurn, DifyAgent
from schemas.badcase_schemas import (
    BadCaseCreate,
    BadCaseTurnInput,
    BadCaseUpdate,
    BadCaseTurnUpdate,
    DifyAgentCreate,
    DifyAgentUpdate,
)


class DifyAgentService:

    def list_agents(self, db: Session) -> List[DifyAgent]:
        return db.query(DifyAgent).order_by(DifyAgent.updated_at.desc()).all()

    def get_agent(self, db: Session, agent_id: int) -> Optional[DifyAgent]:
        return db.query(DifyAgent).filter(DifyAgent.id == agent_id).first()

    def create_agent(self, db: Session, payload: DifyAgentCreate) -> DifyAgent:
        agent = DifyAgent(
            name=payload.name.strip(),
            base_url=payload.base_url.strip(),
            app_id=payload.app_id.strip(),
            api_key=payload.api_key.strip() if payload.api_key else None,
        )
        db.add(agent)
        db.commit()
        db.refresh(agent)
        return agent

    def update_agent(self, db: Session, agent_id: int, payload: DifyAgentUpdate) -> Optional[DifyAgent]:
        agent = self.get_agent(db, agent_id)
        if not agent:
            return None
        update_data = payload.dict(exclude_unset=True)
        for key, value in update_data.items():
            if value is not None and isinstance(value, str):
                value = value.strip()
            setattr(agent, key, value)
        db.commit()
        db.refresh(agent)
        return agent

    def delete_agent(self, db: Session, agent_id: int) -> bool:
        agent = self.get_agent(db, agent_id)
        if not agent:
            return False
        db.delete(agent)
        db.commit()
        return True

    def serialize_agent(self, agent: DifyAgent) -> Dict[str, Any]:
        return {
            "id": agent.id,
            "name": agent.name,
            "base_url": agent.base_url,
            "app_id": agent.app_id,
            "api_key": agent.api_key,
            "created_at": agent.created_at,
            "updated_at": agent.updated_at,
        }


class BadCaseService:

    def list_bad_cases(self, db: Session, agent_id: Optional[int] = None, limit: int = 20, offset: int = 0) -> tuple:
        query = db.query(BadCase)
        if agent_id:
            query = query.filter(BadCase.agent_id == agent_id)
        total = query.count()
        cases = query.order_by(BadCase.updated_at.desc()).offset(offset).limit(limit).all()
        return cases, total

    def get_bad_case(self, db: Session, case_id: int) -> Optional[BadCase]:
        return db.query(BadCase).filter(BadCase.id == case_id).first()

    def get_bad_case_with_details(self, db: Session, case_id: int) -> Optional[Dict[str, Any]]:
        case = db.query(BadCase).filter(BadCase.id == case_id).first()
        if not case:
            return None
        return self.serialize_bad_case(case)

    def create_bad_case(self, db: Session, payload: BadCaseCreate) -> BadCase:
        case = BadCase(
            agent_id=payload.agent_id,
            conversation_id=payload.conversation_id,
            remark=payload.remark,
        )
        db.add(case)
        db.flush()

        for turn_input in payload.turns:
            turn = BadCaseTurn(
                bad_case_id=case.id,
                message_id=turn_input.message_id,
                query=turn_input.query,
                answer=turn_input.answer,
                expected_answer=turn_input.expected_answer,
                remark=turn_input.remark,
                turn_index=turn_input.turn_index,
            )
            db.add(turn)

        db.commit()
        db.refresh(case)
        return case

    def update_bad_case(self, db: Session, case_id: int, payload: BadCaseUpdate) -> Optional[BadCase]:
        case = self.get_bad_case(db, case_id)
        if not case:
            return None
        update_data = payload.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(case, key, value)
        db.commit()
        db.refresh(case)
        return case

    def delete_bad_case(self, db: Session, case_id: int) -> bool:
        case = self.get_bad_case(db, case_id)
        if not case:
            return False
        db.delete(case)
        db.commit()
        return True

    def update_turn(self, db: Session, turn_id: int, payload: BadCaseTurnUpdate) -> Optional[BadCaseTurn]:
        turn = db.query(BadCaseTurn).filter(BadCaseTurn.id == turn_id).first()
        if not turn:
            return None
        update_data = payload.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(turn, key, value)
        db.commit()
        db.refresh(turn)
        return turn

    def delete_turn(self, db: Session, turn_id: int) -> bool:
        turn = db.query(BadCaseTurn).filter(BadCaseTurn.id == turn_id).first()
        if not turn:
            return False
        db.delete(turn)
        db.commit()
        return True

    def serialize_bad_case(self, case: BadCase) -> Dict[str, Any]:
        agent_name = None
        if case.agent:
            agent_name = case.agent.name

        turns_data = []
        for turn in case.turns:
            turns_data.append(self.serialize_turn(turn))

        return {
            "id": case.id,
            "agent_id": case.agent_id,
            "agent_name": agent_name,
            "conversation_id": case.conversation_id,
            "remark": case.remark,
            "turns": turns_data,
            "created_at": case.created_at,
            "updated_at": case.updated_at,
        }

    def serialize_turn(self, turn: BadCaseTurn) -> Dict[str, Any]:
        return {
            "id": turn.id,
            "message_id": turn.message_id,
            "query": turn.query,
            "answer": turn.answer,
            "expected_answer": turn.expected_answer,
            "evaluation_score": turn.evaluation_score,
            "evaluation_reason": turn.evaluation_reason,
            "rerun_answer": turn.rerun_answer,
            "rerun_score": turn.rerun_score,
            "rerun_reason": turn.rerun_reason,
            "remark": turn.remark,
            "turn_index": turn.turn_index,
            "created_at": turn.created_at,
            "updated_at": turn.updated_at,
        }


dify_agent_service = DifyAgentService()
bad_case_service = BadCaseService()