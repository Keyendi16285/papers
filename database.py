import os
from sqlmodel import SQLModel, create_engine, Session
from dotenv import load_dotenv

# 1. Load environment variables
load_dotenv()

# 2. Get Database URL from .env or default to local sqlite
# The 'check_same_thread=False' is required for SQLite + FastAPI
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./papers.db")

engine = create_engine(
    DATABASE_URL, 
    echo=True, 
)

# 3. Create the tables based on your models
def create_db_and_tables():
    # We import the models here to ensure they are registered before creation
    from models import Paper, PaperDate
    SQLModel.metadata.create_all(engine)

# 4. Dependency to get a database session for routes
def get_session():
    with Session(engine) as session:
        yield session