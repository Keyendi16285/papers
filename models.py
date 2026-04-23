from sqlmodel import Enum, SQLModel, Field, Relationship
from typing import List, Optional
from datetime import datetime

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
    case_id: int = Field(index=True)
    defendant_id: int = Field(index=True)
    
    # Metadata for quick display
    case_name: str
    defendant_name: str
    is_casewide: bool = Field(default=False)
    location_name: Optional[str] = Field(default="Unknown") # For State/County
    
    type: str  # Motion, Pleading, MSJ, etc.
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # One Paper has Many Dates
    dates: List["PaperDate"] = Relationship(
        back_populates="paper", 
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )

class PaperDate(SQLModel, table=True):
    """Represents a single deadline associated with a Paper"""
    id: Optional[int] = Field(default=None, primary_key=True)
    paper_id: int = Field(foreign_key="paper.id")
    
    date: datetime
    party: str = Field(nullable=False) # "P" or "D"
    optional_text: Optional[str] = None
    is_completed: bool = Field(default=False)
    court_type: Optional[str] = Field(default=None)

    paper: Optional[Paper] = Relationship(back_populates="dates")

# --- SCHEMAS (For API Data Exchange) ---

class DateEntry(SQLModel):
    date: datetime
    party: str
    optional_text: Optional[str] = None
    court_type: Optional[str] = None

class PaperCreate(SQLModel):
    case_id: int
    defendant_id: int
    case_name: str
    defendant_name: str
    type: str
    is_casewide: bool = False
    description: Optional[str] = None
    dates: List[DateEntry]
    
# Define the "Schema" versions so FastAPI knows how to serialize the relationship
class PaperDateRead(SQLModel):
    id: int
    paper_id: int
    date: datetime
    party: str
    optional_text: Optional[str] = None
    is_completed: bool

class PaperRead(SQLModel):
    id: int
    case_id: int
    defendant_id: int
    case_name: str
    defendant_name: str
    is_casewide: bool
    location_name: Optional[str] = None
    type: str
    description: Optional[str] = None
    created_at: datetime
    # This is the line that tells FastAPI to look for the "dates" relationship
    dates: List[PaperDateRead] = []
    
class PaperDateUpdate(SQLModel):
    date: datetime
    party: str
    optional_text: Optional[str] = None
    court_type: Optional[str] = None
    
class PaperDateReadWithPaper(SQLModel):
    id: int
    paper_id: int
    date: datetime
    party: str
    optional_text: Optional[str] = None
    is_completed: bool
    court_type: Optional[str] = None
    # Add this line to include the parent details in the JSON
    paper: Optional[PaperRead] = None