@echo off
echo 后端服务启动脚本
echo ========================

cd /d "%~dp0"

echo 检查虚拟环境...
if not exist .venv (
    echo 创建虚拟环境...
    python -m venv .venv
)

echo 激活虚拟环境...
call .venv\Scripts\activate.bat

echo 升级pip...
python -m pip install --upgrade pip

echo 安装核心依赖...
python -m pip install fastapi uvicorn sqlalchemy pydantic pymysql python-dotenv

echo 启动FastAPI服务...
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

pause