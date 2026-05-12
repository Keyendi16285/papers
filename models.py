from sqlmodel import Enum, SQLModel, Field, Relationship
from typing import List, Optional
from datetime import datetime, date, time

# --- DATABASE MODELS ---

class CourtLocationType(str, Enum):
    IN_PERSON = "In Person"
    ZOOM = "Zoom"
    HYBRID = "Hybrid"
    CLERK = "Clerk"
    UNKNOWN = "Unknown"

class Paper(SQLModel, table=True):
    """Represents a legal filing (e.g., Motion, Pleading)"""
    id: Optional[int] = Field(default=None, primary_key=True)
    
    # IDs from CaseTracker/Returnalyzer
    case_id: Optional[int] = Field(default=None, index=True)
    defendant_id: Optional[int] = Field(default=None, index=True)
    
    # Metadata for quick display
    case_name: Optional[str] = None
    case_title: Optional[str] = None
    defendant_name: Optional[str] = None
    is_casewide: bool = Field(default=False)
    location_name: Optional[str] = Field(default="Unknown") # For State/County
    total_defendants: int = Field(default=1)
    
    type: Optional[str] = None  # Motion, Pleading, MSJ, etc.
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    source_review_id: Optional[int] = Field(default=None, foreign_key="paper_review.id")

    # One Paper has Many Dates
    dates: List["PaperDate"] = Relationship(
        back_populates="paper", 
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )

class PaperDate(SQLModel, table=True):
    """Represents a single deadline associated with a Paper"""
    id: Optional[int] = Field(default=None, primary_key=True)
    paper_id: int = Field(foreign_key="paper.id")
    
    date: Optional[datetime] = None
    party: Optional[str] = Field(default=None) # "P" or "D"
    optional_text: Optional[str] = None
    is_completed: bool = Field(default=False)
    court_type: Optional[str] = Field(default=None)
    event_link: Optional[str] = None

    paper: Optional[Paper] = Relationship(back_populates="dates")
    source_review_id: Optional[int] = Field(default=None, foreign_key="paper_review.id")

# --- SCHEMAS (For API Data Exchange) ---

class DateEntry(SQLModel):
    date: Optional[datetime] = None
    party: Optional[str] = None
    optional_text: Optional[str] = None
    court_type: Optional[str] = None
    event_link: Optional[str] = None
    
class PaperCreate(SQLModel):
    case_id: Optional[int] = None
    defendant_id: Optional[int] = None
    case_name: Optional[str] = None
    case_title: Optional[str] = None
    defendant_name: Optional[str] = None
    type: Optional[str] = None
    is_casewide: bool = False
    description: Optional[str] = None
    dates: List[DateEntry]
    total_defendants: int = 1
    
# Define the "Schema" versions so FastAPI knows how to serialize the relationship
class PaperDateRead(SQLModel):
    id: Optional[int]
    paper_id: Optional[int]
    date: Optional[datetime]
    party: Optional[str]
    optional_text: Optional[str] = None
    is_completed: bool
    event_link: Optional[str] = None

class PaperRead(SQLModel):
    id: Optional[int]
    case_id: Optional[int]
    defendant_id: Optional[int]
    case_name: Optional[str] = None
    case_title: Optional[str] = None
    defendant_name: Optional[str] = None
    is_casewide: bool
    location_name: Optional[str] = None
    type: Optional[str] = None
    description: Optional[str] = None
    created_at: datetime
    # This is the line that tells FastAPI to look for the "dates" relationship
    dates: List[PaperDateRead] = []
    
class PaperDateUpdate(SQLModel):
    date: Optional[datetime]
    party: Optional[str]
    optional_text: Optional[str] = None
    court_type: Optional[str] = None
    event_link: Optional[str] = None
    
class PaperDateReadWithPaper(SQLModel):
    id: Optional[int]
    paper_id: Optional[int]
    date: Optional[datetime]
    party: Optional[str]
    optional_text: Optional[str] = None
    is_completed: bool
    court_type: Optional[str] = None
    event_link: Optional[str] = None
    # Add this line to include the parent details in the JSON
    paper: Optional[PaperRead] = None
    
class PaperReview(SQLModel, table=True):
    __tablename__ = "paper_review"

    id: Optional[int] = Field(default=None, primary_key=True)
    paper_id: Optional[int] = Field(default=None, foreign_key="paper.id")
    paper_date_id: Optional[int] = Field(default=None, foreign_key="paperdate.id")
    
    # Ensure every Optional field has a type like [str] or [datetime]
    case_number: Optional[str] = None
    case_name: Optional[str] = None
    defendant_name: Optional[str] = None
    state: Optional[str] = None
    county: Optional[str] = None
    date: Optional[datetime] = None
    time: Optional[str] = None
    type: Optional[str] = None
    format: Optional[str] = None
    source: Optional[str] = None
    judge: Optional[str] = None
    event_link: Optional[str] = None # Default status
    timestamp: Optional[datetime] = Field(default_factory=datetime.utcnow)
    status: Optional[str] = Field(default="pending")
    
    
# class PaperReview(SQLModel, table=True):
#     __tablename__ = "paper_review"

#     # Always include the specific type (int) inside Optional[...]
#     id: Optional[int] = Field(default=None, primary_key=True)
#     paper_id: Optional[int] = Field(default=None, foreign_key="paper.id")
#     paper_date_id: Optional[int] = Field(default=None, foreign_key="paperdate.id")
    
#     # Explicitly hint these as Optional[str] so SQLModel knows they are VARCHAR columns
#     case_number: Optional[str] = None
#     case_name: Optional[str] = None
#     defendant_name: Optional[str] = None
#     state: Optional[str] = None
#     county: Optional[str] = None
    
#     # Use specific date and time types
#     date: Optional[date] = None
#     time: Optional[time] = None
    
#     # Use str for the 'type' field
#     type: Optional[str] = None
    
#     judge: Optional[str] = None
#     format: Optional[str] = None
#     source: Optional[str] = None
#     event_link: Optional[str] = None
    
#     # Use datetime for the timestamp column
#     timestamp: Optional[datetime] = Field(default_factory=datetime.utcnow)