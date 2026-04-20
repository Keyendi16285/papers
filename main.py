from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select, or_, and_, SQLModel, Field, Relationship
from typing import List, Optional
from datetime import datetime
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm, HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy.orm import selectinload
import os
import httpx

from database import engine, create_db_and_tables, get_session
from models import Paper, PaperDate, PaperCreate, DateEntry, PaperDateUpdate, PaperRead

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
    session.flush()  # Flush to get the new paper ID for foreign key references

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

@app.get("/api/papers", response_model=List[PaperRead])
async def list_papers(filter: str = "upcoming", session: Session = Depends(get_session)):
    now = datetime.now()
    
    # Base query: Always use selectinload to ensure dates are included in the JSON
    statement = select(Paper).options(selectinload(Paper.dates))

    if filter == "upcoming":
        # Filters papers that have AT LEAST ONE date >= now
        statement = statement.where(Paper.dates.any(PaperDate.date >= now))
    elif filter == "past":
        # Filters papers that have AT LEAST ONE date < now
        statement = statement.where(Paper.dates.any(PaperDate.date < now))

    # results.all() will now contain the papers AND their nested dates array
    results = session.exec(statement).all()
    return results

@app.get("/api/dates", response_model=List[PaperDate])
async def list_all_dates(session: Session = Depends(get_session)):
    # Add .options(selectinload(PaperDate.paper)) to include the parent Paper info
    statement = select(PaperDate).options(selectinload(PaperDate.paper)).order_by(PaperDate.date)
    return session.exec(statement).all()

@app.get("/api/papers/{paper_id}", response_model=PaperRead)
async def get_paper(paper_id: int, session: Session = Depends(get_session), user = Depends(get_current_user)):
    # Ensure selectinload is used here too for the Edit button
    statement = select(Paper).where(Paper.id == paper_id).options(selectinload(Paper.dates))
    paper = session.exec(statement).first()
    
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    return paper

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
    
@app.patch("/api/papers/{paper_id}", response_model=Paper)
async def update_paper(
    paper_id: int, 
    payload: PaperCreate, 
    session: Session = Depends(get_session),
    user = Depends(get_current_user)
):
    # 1. Fetch with dates eagerly loaded
    db_paper = session.exec(
        select(Paper).where(Paper.id == paper_id).options(selectinload(Paper.dates))
    ).first()
    
    if not db_paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    # 2. Update basic fields
    db_paper.type = payload.type
    db_paper.description = payload.description
    db_paper.case_id = payload.case_id
    db_paper.defendant_id = payload.defendant_id
    db_paper.case_name = payload.case_name
    db_paper.defendant_name = payload.defendant_name

    # 3. Clear old dates
    for old_date in db_paper.dates:
        session.delete(old_date)
    
    # 4. Add new dates
    new_dates = []
    for date_entry in payload.dates:
        new_date = PaperDate(
            paper_id=db_paper.id,
            date=date_entry.date,
            party=date_entry.party,
            optional_text=date_entry.optional_text
        )
        session.add(new_date)
        new_dates.append(new_date)

    session.add(db_paper)
    session.commit()
    
    # Explicitly refresh to get the new dates back into the object
    session.refresh(db_paper)
    return db_paper

@app.patch("/api/papers/dates/{date_id}", response_model=PaperDate)
async def update_paper_date(
    date_id: int, 
    date_update: PaperDateUpdate, 
    session: Session = Depends(get_session)
):
    # 1. Fetch the specific date record
    db_date = session.get(PaperDate, date_id)
    if not db_date:
        raise HTTPException(status_code=404, detail="Deadline not found")
    
    # 2. Update only the fields provided in the modal
    db_date.date = date_update.date
    db_date.party = date_update.party
    db_date.optional_text = date_update.optional_text
    
    # 3. Save to database
    session.add(db_date)
    session.commit()
    session.refresh(db_date)
    
    return db_date