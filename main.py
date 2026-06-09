from fastapi import BackgroundTasks, FastAPI, Depends, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlmodel import Session, select, or_, and_, SQLModel, Field, Relationship
from typing import List, Optional
from datetime import datetime
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm, HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy.orm import selectinload
from sqlalchemy import asc
import os
import httpx

from database import engine, create_db_and_tables, get_session, get_db
from models import CaseEntry, Paper, PaperDate, PaperCreate, DateEntry, PaperDateReadWithPaper, PaperDateUpdate, PaperRead, PaperReview, TrackerMatchResponse

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

class ReviewApprovalRequest(BaseModel):
    case_number: str
    review_ids: List[int]

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

@app.get("/travel")
async def read_travel():
    return FileResponse("static/travel.html")

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
        case_title=payload.case_title,
        defendant_name=payload.defendant_name,
        type=payload.type,
        description=payload.description,
        is_casewide=payload.is_casewide
    )
        
    session.add(new_paper)
    session.flush()  # Flush to get the new paper ID for foreign key references

    for date_entry in payload.dates:
        new_date = PaperDate(
            paper_id=new_paper.id,
            date=date_entry.date,
            party=date_entry.party,
            optional_text=date_entry.optional_text,
            court_type=getattr(date_entry, "court_type", None),
            event_link=date_entry.event_link
        )
        session.add(new_date)
    
    session.commit()
    session.refresh(new_paper)
    return new_paper

@app.get("/api/papers", response_model=List[PaperRead])
async def list_papers(filter: str = "upcoming", q: str = None, session: Session = Depends(get_session)):
    now = datetime.now()
    
    # Base query: Always use selectinload to ensure dates are included in the JSON
    statement = select(Paper).options(selectinload(Paper.dates))

    if filter == "upcoming":
        # Filters papers that have AT LEAST ONE date >= now
        statement = statement.where(Paper.dates.any(PaperDate.date >= now))
    elif filter == "past":
        # Filters papers that have AT LEAST ONE date < now
        statement = statement.where(Paper.dates.any(PaperDate.date < now))
        
    # Search Logic (Check case name OR defendant name)
    if q:
        search_term = f"%{q}%"
        statement = statement.where(
            or_(
                Paper.case_name.ilike(search_term),
                Paper.defendant_name.ilike(search_term)
            )
        )

    # results.all() will now contain the papers AND their nested dates array
    results = session.exec(statement).all()
    return results

@app.get("/api/dates", response_model=List[PaperDateReadWithPaper])
async def list_all_dates(
    q: str = None,
    session: Session = Depends(get_session),
    user = Depends(get_current_user)
):
    # Select PaperDate objects and eagerly load the associated Paper
    # This automatically includes event_link because it's part of the PaperDate model
    statement = select(PaperDate).options(selectinload(PaperDate.paper)).order_by(PaperDate.date)
    
    # Filter by Case or Defendant name if search is active
    if q:
        search_term = f"%{q}%"
        statement = statement.join(Paper).where(
            or_(
                Paper.case_name.ilike(search_term),
                Paper.defendant_name.ilike(search_term)
            )
        )
        
    dates = session.exec(statement).all()

    async with httpx.AsyncClient() as client:
        for d in dates:
            # We use d.paper.case_name because that is where the Case Number is stored
            if d.paper and d.paper.case_name:
                try:
                    # Search Case Tracker for location metadata (State/County)
                    search_url = f"{CASETRACKER_URL}/api/defendants/"
                    response = await client.get(
                        search_url, 
                        params={"search": d.paper.case_name}, 
                        timeout=3.0
                    )
                    
                    if response.status_code == 200:
                        results = response.json()
                        if results and len(results) > 0:
                            # Use the first match found in Case Tracker to populate location
                            match = results[0]
                            st = match.get("state", "")
                            co = match.get("county", "")
                            
                            if st and co:
                                d.paper.location_name = f"{st} / {co}"
                            else:
                                d.paper.location_name = st or co or "Unknown"
                        else:
                            d.paper.location_name = "No Case Match"
                    else:
                        d.paper.location_name = d.paper.location_name
                except Exception as e:
                    print(f"Lookup failed for {d.paper.case_name}: {e}")
                    d.paper.location_name = d.paper.location_name 
            
    return dates

@app.get("/api/papers/{paper_id}", response_model=PaperRead)
async def get_paper(paper_id: int, session: Session = Depends(get_session), user = Depends(get_current_user)):
    # Ensure selectinload is used here too for the Edit button
    statement = select(Paper).where(Paper.id == paper_id).options(selectinload(Paper.dates))
    paper = session.exec(statement).first()
    
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    return paper

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

            # 1. Create a frequency map using Case Number (e.g., "2026CH3")
            # We use case_number because it identifies the case globally in your records
            case_counts = {}
            for item in data:
                # 'case_number' comes from the CaseTracker response
                cnum = item.get("case_number")
                if cnum:
                    case_counts[cnum] = case_counts.get(cnum, 0) + 1
            
            # 2. Return the data with the count based on the Case Number
            return [
                {
                    "id": item.get("id"), 
                    "case_id": item.get("case_id"), 
                    "name": item.get("name"), 
                    "case_no": item.get("case_number"), # This is our grouping key
                    "case_name": item.get("case_name"),   # This is the title for Rule 1
                    "total_defendants": case_counts.get(item.get("case_number"), 1)
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
    db_paper.case_title = payload.case_title
    db_paper.defendant_name = payload.defendant_name
    db_paper.is_casewide = payload.is_casewide
    
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
            optional_text=date_entry.optional_text,
            court_type=getattr(date_entry, "court_type", None),
            event_link=date_entry.event_link,
            source_link=date_entry.source_link
        )
        session.add(new_date)
        new_dates.append(new_date)

    session.add(db_paper)
    session.commit()
    
    # Explicitly refresh to get the new dates back into the object
    session.refresh(db_paper)
    return db_paper

@app.get("/api/papers/dates/upcoming", response_model=List[PaperDateReadWithPaper])
async def get_upcoming_dates(session: Session = Depends(get_session)):
    # 1. Fetch upcoming dates
    statement = (
        select(PaperDate)
        .where(PaperDate.date >= datetime.now())
        .order_by(PaperDate.date)
        .options(selectinload(PaperDate.paper))
    )
    dates = session.exec(statement).all()

    # 2. Perform external lookup for State/County (Added logic)
    async with httpx.AsyncClient() as client:
        for d in dates:
            if d.paper and d.paper.case_name:
                try:
                    search_url = f"{CASETRACKER_URL}/api/defendants/"
                    response = await client.get(
                        search_url, 
                        params={"search": d.paper.case_name}, 
                        timeout=3.0
                    )
                    
                    if response.status_code == 200:
                        results = response.json()
                        if results and len(results) > 0:
                            match = results[0]
                            st = match.get("state", "")
                            co = match.get("county", "")
                            
                            if st and co:
                                d.paper.location_name = f"{st} / {co}"
                            else:
                                d.paper.location_name = st or co or "Unknown"
                        else:
                            # d.paper.location_name = "No Case Match"
                            statement = select(Paper).where(Paper.case_name == d.paper.case_name)
                            paperResult = session.exec(statement).first()
                            if paperResult and paperResult.location_name:
                                d.paper.location_name = paperResult.location_name
                            else:
                                d.paper.location_name = "No Case Match"
                    else:
                        d.paper.location_name = d.paper.location_name
                except Exception as e:
                    print(f"Lookup failed for {d.paper.case_name}: {e}")
                    d.paper.location_name = d.paper.location_name
            
    return dates

@app.get("/api/papers/dates/{date_id}")
async def get_single_date_details(date_id: int, db: Session = Depends(get_session)):
    # Fetch the explicit date record
    db_date = db.get(PaperDate, date_id)
    if not db_date:
        raise HTTPException(status_code=404, detail="Date record not found")
        
    # Fetch parent context details so the frontend receives the fallback paper details
    parent_paper = db.get(Paper, db_date.paper_id)
    
    # Merge both structures into a single response payload
    return {
        "id": db_date.id,
        "date": db_date.date,
        "event_link": getattr(db_date, "event_link", ""),
        "source_link": getattr(db_date, "source_link", ""),
        "court_type": getattr(db_date, "court_type", ""),
        "optional_text": getattr(db_date, "optional_text", ""),
        "case_name": getattr(parent_paper, "case_name", "") if parent_paper else "",
        "case_title": getattr(parent_paper, "case_title", "") if parent_paper else "",
        "defendant_name": getattr(parent_paper, "defendant_name", "") if parent_paper else "",
        "location_name": getattr(parent_paper, "location_name", "") if parent_paper else "",
        "type": getattr(parent_paper, "type", "") if parent_paper else "",
        "description": getattr(parent_paper, "description", "") if parent_paper else "",
        "party": getattr(db_date, "party", "D")  # Default to "D" if not specified
    }

@app.get("/api/papers/dates/{date_id}/tracker-check", response_model=TrackerMatchResponse)
async def check_case_tracker_match(date_id: int, db: Session = Depends(get_session)):
    # 1. Locate the active date/event record
    db_date = db.get(PaperDate, date_id)
    if not db_date:
        raise HTTPException(status_with_code=404, detail="Target date record not found")
        
    # 2. Extract the parent record reference to acquire tracking criteria
    parent_paper = db.get(Paper, db_date.paper_id)
    if not parent_paper:
        raise HTTPException(status_code=404, detail="Associated parent paper file not found")
    
    # Extract identifiers (checking fallback parameters: case_id or case_number)
    case_number_query = getattr(parent_paper, "case_name", None)
    case_id_query = getattr(parent_paper, "case_id", None)
    
    tracker_record = None
    
    # 3. Query the casetracker table explicitly using unique identifiers
    if case_id_query:
        tracker_record = db.exec(CaseEntry).filter(CaseEntry.id == case_id_query).first()
    
    if not tracker_record and case_number_query:
        tracker_record = db.exec(CaseEntry).filter(CaseEntry.case_number == case_number_query).first()
        
    # 4. Evaluate findings and respond with clean mapping data parameters
    if tracker_record:
        return TrackerMatchResponse(
            matched=True,
            case_name=getattr(tracker_record, "case_name", None) or getattr(tracker_record, "case_title", ""),
            defendant_name=getattr(tracker_record, "defendant_name", ""),
            location_name=getattr(tracker_record, "location_name", "")  # Corresponds to "State / County"
        )
        
    # Fallback response state if no identifiers provide an explicit production record match
    return TrackerMatchResponse(matched=False)    
    
@app.patch("/api/papers/dates/{date_id}", response_model=PaperDate)
async def update_paper_date(
    date_id: int,
    update_data: PaperDateUpdate,
    db: Session = Depends(get_session)
):
    """
    Updates a specific upcoming date execution item, while safely synchronizing
    parent relational profile information (location_name, defendant_name, case_title, etc.)
    """
    logger.info(f"Received PATCH request for PaperDate ID: {date_id}")
    logger.info(f"Payload update data details: {update_data.dict(exclude_unset=True)}")

    # 1. Retrieve the target date record
    db_date = db.get(PaperDate, date_id)
    if not db_date:
        raise HTTPException(status_code=404, detail="PaperDate record not found")

    # 2. Extract parent tracking configuration
    parent = getattr(db_date, 'paper', None)
    if not parent and hasattr(db_date, 'paper_id') and db_date.paper_id:
        parent = db.get(Paper, db_date.paper_id)

    if not parent:
        logger.warning(f"Orphaned PaperDate record detected (ID {date_id}). Missing parent configuration context.")
        raise HTTPException(status_code=422, detail="Parent Paper configuration record missing.")

    # 3. Process fields intended for the relational parent 'Paper' model
    parent_fields = ["defendant_name", "case_title", "type", "description", "location_name"]
    parent_updated = False

    for field in parent_fields:
        value = getattr(update_data, field, None)
        if value is not None:
            # Prevent blank inputs from bypassing or corrupting string entries
            cleaned_value = str(value).strip()
            setattr(parent, field, cleaned_value if cleaned_value != "" else None)
            parent_updated = True

    # Defensive check: Only apply fallback default if the location field is truly missing/null
    if parent.location_name is None or str(parent.location_name).strip() == "":
        parent.location_name = "Offline"

    if parent_updated:
        db.add(parent)
        logger.info(f"Parent Paper ID {parent.id} attributes successfully synchronized.")

    # 4. Process fields intended for the localized 'PaperDate' execution record
    date_fields = ["date", "optional_text", "court_type", "event_link", "source_link", "is_completed", "party"]
    for field in date_fields:
        value = getattr(update_data, field, None)
        if value is not None:
            setattr(db_date, field, value)

    # Save updates across both tables
    db.add(db_date)
    db.commit()
    db.refresh(db_date)

    logger.info(f"PaperDate ID {date_id} saved successfully.")
    return db_date

@app.get("/review.html", response_class=HTMLResponse)
async def read_review():
    with open("static/review.html") as f:
        return f.read()

@app.get("/api/review/suggestions")
async def get_review_suggestions(status: str = "pending", db: Session = Depends(get_db)):
    # 1. Fetch only 'pending' items from the staging table
    query = select(PaperReview).where(PaperReview.status == status)
    items = db.exec(query).all()
    
    # 2. Group them by case_number
    suggestions = {}
    for item in items:
        case_num = item.case_number
        if case_num not in suggestions:
            # Check if this case number ALREADY exists in production
            existing_case = db.exec(select(CaseEntry).where(CaseEntry.case_number == case_num)).first()
            
            suggestions[case_num] = {
                "case_number": case_num,
                "case_name": item.case_name,
                "county": item.county,
                "state": item.state,
                "exists_in_production": True if existing_case else False,
                "production_id": existing_case.id if existing_case else None,
                "events": []
            }
        
        # Add the specific event data to this group
        suggestions[case_num]["events"].append({
            "defendant_name": item.defendant_name,
            "review_id": item.id,
            "date": item.date,
            "type": item.type,
            "court": item.format,
            "judge": item.judge,
            "time": item.time,
            "source": item.source,
            "event_link": item.event_link,
            "source_link": item.source_link
        })
    
    # Convert dict to list for easier frontend mapping
    return list(suggestions.values())

# 1. Define a request model for the approval
class ApprovalRequest(BaseModel):
    review_ids: List[int]

@app.post("/api/review/approve")
async def approve_reviews(data: ApprovalRequest, db: Session = Depends(get_session)):
    for rid in data.review_ids:
        review_item = db.get(PaperReview, rid)
        if not review_item:
            continue
            
        # Check if production paper exists
        paper = db.exec(select(Paper).where(Paper.case_name == review_item.case_number)).first()
        
        if not paper:
            paper = Paper(
                case_name=review_item.case_number,
                case_title=review_item.case_name,
                defendant_name=review_item.defendant_name,
                source_review_id=review_item.id,
                location_name= f"{review_item.state if review_item.state else ''} / {review_item.county if review_item.county else ''}",
                
            )
            db.add(paper)
            db.commit() 
            db.refresh(paper)

        new_date = PaperDate(
            paper_id=paper.id,
            date=review_item.date,
            optional_text=review_item.type,
            court_type=review_item.format, # Ensure this matches your model
            source_review_id=review_item.id, 
            event_link=review_item.event_link,
            source_link=review_item.source_link
        )
        db.add(new_date)
        
        review_item.status = "approved"
        db.add(review_item)
    
    db.commit()
    return {"status": "success", "message": f"Approved {len(data.review_ids)} items"}

@app.post("/api/review/reject")
async def reject_reviews(data: ApprovalRequest, db: Session = Depends(get_session)):
    rejected_count = 0
    
    for rid in data.review_ids:
        review_item = db.get(PaperReview, rid)
        if not review_item:
            continue
            
        # Change status to rejected so they fall out of pending queue 
        # and display under the newly added "Archived Records" button
        review_item.status = "rejected"
        db.add(review_item)
        rejected_count += 1
    
    db.commit()
    return {"status": "success", "message": f"Archived/Rejected {rejected_count} items"}

@app.post("/api/review/unarchive")
async def unarchive_reviews(data: ApprovalRequest, db: Session = Depends(get_session)):
    unarchived_count = 0
    
    for rid in data.review_ids:
        review_item = db.get(PaperReview, rid)
        if not review_item:
            continue
            
        # Change status back to pending so they reappear in the active review queue
        review_item.status = "pending"
        db.add(review_item)
        unarchived_count += 1
    
    db.commit()
    return {"status": "success", "message": f"Moved {unarchived_count} items back to pending queue"}

import logging

# Initialize a standard logger to catch internal database errors
logger = logging.getLogger("uvicorn.error")

@app.get("/api/travel")
async def get_travel_docket(q: Optional[str] = None, db: Session = Depends(get_session)):
    """
    Fetches only UPCOMING 'In-person' court events, sorted chronologically
    from nearest to farthest date, and maps them to their parent case profiles.
    """
    try:
        current_time = datetime.now()
        print(f"DEBUG: Fetching travel docket with search query: '{q}' at {current_time.isoformat()}")
        
        # 1. Base Query: Filter for 'In-Person' AND only look at future dates
        # 2. Sorting Logic: Order by date from nearest to farthest (ASC)
        query = (
            select(PaperDate)
            .where(PaperDate.court_type == "In-Person")
            .where(PaperDate.date >= current_time)
            .order_by(asc(PaperDate.date))
        )
        
        # Apply dashboard search filtering if a query is present
        if q:
            query = query.join(Paper).where(
                (Paper.case_name.contains(q)) | 
                (Paper.defendant_name.contains(q))
            )
            
        date_records = db.exec(query).all()
        print(f"DEBUG: Retrieved {len(date_records)} 'In-Person' events from the database.")
        results = []
        
        for d_record in date_records:
            parent = getattr(d_record, 'paper', None)
            if not parent and hasattr(d_record, 'paper_id'):
                parent = db.get(Paper, d_record.paper_id)
                
            if not parent:
                logger.warning(f"Skipping PaperDate ID {d_record.id}: No parent Paper profile found.")
                continue
                
            results.append({
                "id": int(parent.id),
                "case_name": str(parent.case_name) if parent.case_name else "--",
                "case_title": str(parent.case_title) if parent.case_title else "",
                "defendant_name": str(parent.defendant_name) if parent.defendant_name else "N/A",
                "type": str(parent.type) if parent.type else "Filing / Event",
                "party": str(d_record.party) if hasattr(d_record, 'party') and d_record.party else 'D',
                "nearest_date": d_record.date.isoformat() if d_record.date else None,
                "date_count": 1,
                "location_name": str(parent.location_name) if hasattr(parent, 'location_name') and parent.location_name else None
            })
            
        return results

    except Exception as e:
        logger.error(f"Travel Route Engine Exception Raised: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal database processing error: {str(e)}")
    
def sync_historical_papers(db: Session):
    """
    Background worker function that finds historical papers with missing 
    metadata fields and populates them using data from paper_review.
    """
    # 1. Fetch papers that have placeholder or null indicators
    # Adapt filters if your database uses empty strings "" instead of None/Null
    statement = select(Paper).where(
        (Paper.case_title == None) | (Paper.case_title == "N/A") | 
        (Paper.location_name == None) | (Paper.location_name == "Unknown")
    )
    historical_papers = db.exec(statement).all()
    
    updated_count = 0
    
    for paper in historical_papers:
        # Check if we have a valid reference to the source review table
        if not getattr(paper, "source_review_id", None):
            continue
            
        # 2. Find the corresponding row in paper_review
        review_item = db.get(PaperReview, paper.source_review_id)
        if not review_item:
            continue
            
        # 3. Synchronize missing values down to the paper entry
        is_mutated = False
        
        if not paper.case_title or paper.case_title == "N/A":
            paper.case_title = review_item.case_name
            is_mutated = True
            
        # Construct location format to match your new implementation pattern
        formatted_location = f"{review_item.state if review_item.state else ''} / {review_item.county if review_item.county else ''}".strip(" / ")
        if not formatted_location:
            formatted_location = "Unknown"
            
        if not paper.location_name or paper.location_name == "Unknown":
            paper.location_name = formatted_location
            is_mutated = True
            
        if is_mutated:
            db.add(paper)
            updated_count += 1
            
    # 4. Commit all structural changes to the database
    if updated_count > 0:
        db.commit()
    
    print(f"Successfully synchronized {updated_count} historical paper records.")


@app.post("/api/admin/maintenance/backfill-metadata")
async def trigger_metadata_backfill(background_tasks: BackgroundTasks, db: Session = Depends(get_session)):
    """
    Triggers an asynchronous background process to fix missing 
    case names and locations for historical papers.
    """
    background_tasks.add_task(sync_historical_papers, db)
    return {
        "status": "success",
        "message": "Background sync routine initiated. Historical records are being updated."
    }

