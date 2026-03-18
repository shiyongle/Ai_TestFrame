from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from api.deps import get_database
from core.security import authenticate_user, create_access_token, get_user_by_token, security
from schemas.response_schemas import LoginRequest, LoginResponse, UserProfileResponse

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_database)):
    user = authenticate_user(db, payload.username, payload.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户名或密码错误")

    access_token = create_access_token(user)
    return LoginResponse(access_token=access_token, user=user)


@router.get("/me", response_model=UserProfileResponse)
def get_current_user(credentials=Depends(security), db: Session = Depends(get_database)):
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="未登录")
    return get_user_by_token(db, credentials.credentials)
