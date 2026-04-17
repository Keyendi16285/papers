from sqlmodel import SQLModel, Field, Relationship
from typing import List, Optional
from datetime import datetime

# --- DATABASE MODELS ---

class Paper(SQLModel, table=True):
    """Represents a legal filing (e.g., Motion, Pleading)"""
    id: Optional[int] = Field(default=None, primary_key=True)
    
    # IDs from CaseTracker/Returnalyzer
    case_id: int = Field(index=True)
    defendant_id: int = Field(index=True)
    
    # Metadata for quick display
    case_name: str
    defendant_name: str
    
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
    party: str = Field(max_length=1)  # "P" or "D"
    optional_text: Optional[str] = None
    is_completed: bool = Field(default=False)

    paper: Optional[Paper] = Relationship(back_populates="dates")

# --- SCHEMAS (For API Data Exchange) ---

class DateEntry(SQLModel):
    date: datetime
    party: str
    optional_text: Optional[str] = None

class PaperCreate(SQLModel):
    case_id: int
    defendant_id: int
    case_name: str
    defendant_name: str
    type: str
    description: Optional[str] = None
    dates: List[DateEntry]