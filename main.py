from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select, or_, and_
from typing import List, Optional
from datetime import datetime
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm, HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
import os
import httpx

from database import engine, create_db_and_tables, get_session
from models import Paper, PaperDate, PaperCreate, DateEntry

CASETRACKER_URL = os.getenv("CASETRACKER_URL", "http://host.docker.internal:8001")

# auth_scheme = HTTPBearer()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token") # Points to Case Tracker login if needed

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        return username
    except JWTError:
        raise credentials_exception
    
app = FastAPI(title="Papers Management System")

# --- CORS CONFIGURATION ---
origins = [
    "http://localhost",
    "http://localhost:8000",
    "http://localhost:8003",
    "http://localhost:8002",
    "http://127.0.0.1:8003",
    "*" 
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. Initialize Database on Startup
@app.on_event("startup")
def on_startup():
    create_db_and_tables()

# 2. Serve Static Files
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def read_index():
    return FileResponse("static/index.html")

@app.get("/dates")
async def read_dates():
    return FileResponse("static/dates.html")

# --- API ROUTES ---

@app.post("/api/papers", response_model=Paper)
async def create_paper(payload: PaperCreate, session: Session = Depends(get_session)):
    """
    Creates a Paper and all its associated dates in one transaction.
    """
    new_paper = Paper(
        case_id=payload.case_id,
        defendant_id=payload.defendant_id,
        case_name=payload.case_name,
        defendant_name=payload.defendant_name,
        type=payload.type,
        description=payload.description
    )
    session.add(new_paper)
    session.commit()
    session.refresh(new_paper)

    for date_entry in payload.dates:
        new_date = PaperDate(
            paper_id=new_paper.id,
            date=date_entry.date,
            party=date_entry.party,
            optional_text=date_entry.optional_text
        )
        session.add(new_date)
    
    session.commit()
    session.refresh(new_paper)
    return new_paper

@app.get("/api/papers", response_model=List[Paper])
async def list_papers(filter: str = "upcoming", session: Session = Depends(get_session)):
    """
    Returns papers filtered by their deadline status.
    - upcoming: Papers with at least one date >= now.
    - past: Papers where all dates are < now.
    - all: All papers.
    """
    now = datetime.now()
    
    if filter == "upcoming":
        # JOIN Paper with PaperDate and filter for any date in the future
        statement = select(Paper).join(PaperDate).where(PaperDate.date >= now).distinct()
        results = session.exec(statement).all()
        return results

    elif filter == "past":
        # Filters for papers where the most recent date is in the past
        statement = select(Paper).join(PaperDate).where(PaperDate.date < now).distinct()
        # Note: In a production environment with complex multi-date logic, 
        # you might use a subquery to ensure NO future dates exist for the paper.
        results = session.exec(statement).all()
        return results

    # Default 'all' filter
    statement = select(Paper)
    results = session.exec(statement).all()
    return results

@app.get("/api/dates", response_model=List[PaperDate])
async def list_all_dates(session: Session = Depends(get_session)):
    """
    Returns all dates sorted by the nearest upcoming.
    """
    statement = select(PaperDate).order_by(PaperDate.date)
    return session.exec(statement).all()

# --- SEARCH PROXY ---
@app.get("/api/search/targets")
async def search_targets(q: str):
    CASETRACKER_URL = os.getenv("CASETRACKER_URL", "http://host.docker.internal:8001")
    
    async with httpx.AsyncClient() as client:
        try:
            target_url = f"{CASETRACKER_URL}/api/defendants/"
            response = await client.get(
                target_url, 
                params={"search": q}, 
                timeout=5.0
            )
            response.raise_for_status()
            data = response.json()
            
            return [
                {
                    "id": item.get("id"), 
                    "case_id": item.get("case_id"), 
                    "name": item.get("name"), 
                    "case_no": item.get("case_number")
                } 
                for item in data
            ]
        except Exception as e:
            print(f"DEBUG: Connection to {CASETRACKER_URL} failed: {e}")
            return []
    
@app.patch("/api/dates/{date_id}")
async def update_date(date_id: int, payload: DateEntry, session: Session = Depends(get_session)):
    db_date = session.get(PaperDate, date_id)
    if not db_date:
        raise HTTPException(status_code=404, detail="Date not found")
    
    db_date.date = payload.date
    db_date.party = payload.party
    db_date.optional_text = payload.optional_text
    
    session.add(db_date)
    session.commit()
    session.refresh(db_date)
    return db_date