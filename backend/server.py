from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, date
from bson import ObjectId
import csv
import json
import io
from fastapi.responses import StreamingResponse

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Helper to convert ObjectId to string
class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid objectid")
        return ObjectId(v)

    @classmethod
    def __get_pydantic_json_schema__(cls, field_schema):
        field_schema.update(type="string")

# Define Models
class LeadCreate(BaseModel):
    name: str
    mobile: str
    product: str  # Life/Health/Motor/Investment
    status: str  # Lead/Quote/Policy Issued/Renewal/Closed/Not Interested
    source: str  # Walk-in/Reference/Online/Other
    city: Optional[str] = ""
    notes: Optional[str] = ""
    next_followup_date: Optional[str] = None
    next_followup_time: Optional[str] = None
    next_followup_type: Optional[str] = "Call"
    
    # Policy Lifecycle Fields
    policy_number: Optional[str] = None
    policy_start_date: Optional[str] = None
    policy_end_date: Optional[str] = None
    policy_amount: Optional[float] = 0.0
    renewal_status: Optional[str] = "Active"  # Active/Expiring Soon/Expired
    
    # Family Grouping
    family_head_id: Optional[str] = None
    is_family_head: Optional[bool] = False
    relationship: Optional[str] = "Self"  # Self/Spouse/Child/Parent/Sibling

class Lead(LeadCreate):
    id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class InteractionCreate(BaseModel):
    lead_id: str
    type: str  # Call/WhatsApp/Meeting/Note
    description: str

class Interaction(InteractionCreate):
    id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class DashboardStats(BaseModel):
    total_leads: int
    today_followups: int
    overdue_followups: int
    interested_leads: int
    closed_leads: int
    monthly_business_count: int
    monthly_closing_ratio: float

class ReportData(BaseModel):
    total_business_premium: float
    monthly_business: float
    closing_ratio: float
    lead_conversion: float
    source_performance: dict

# Routes
@api_router.get("/")
async def root():
    return {"message": "GETINSURE CRM API"}

# Lead Management
@api_router.post("/leads")
async def create_lead(lead: LeadCreate):
    lead_dict = lead.dict()
    lead_dict['created_at'] = datetime.utcnow()
    lead_dict['updated_at'] = datetime.utcnow()
    result = await db.leads.insert_one(lead_dict)
    lead_dict['id'] = str(result.inserted_id)
    lead_dict['_id'] = str(result.inserted_id)
    return lead_dict

@api_router.get("/leads")
async def get_leads():
    leads = await db.leads.find().sort("created_at", -1).to_list(1000)
    for lead in leads:
        lead['id'] = str(lead['_id'])
        lead['_id'] = str(lead['_id'])
    return leads

@api_router.get("/leads/{lead_id}")
async def get_lead(lead_id: str):
    if not ObjectId.is_valid(lead_id):
        raise HTTPException(status_code=400, detail="Invalid lead ID")
    lead = await db.leads.find_one({"_id": ObjectId(lead_id)})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    lead['id'] = str(lead['_id'])
    lead['_id'] = str(lead['_id'])
    return lead

@api_router.put("/leads/{lead_id}")
async def update_lead(lead_id: str, lead: LeadCreate):
    if not ObjectId.is_valid(lead_id):
        raise HTTPException(status_code=400, detail="Invalid lead ID")
    lead_dict = lead.dict()
    lead_dict['updated_at'] = datetime.utcnow()
    result = await db.leads.update_one(
        {"_id": ObjectId(lead_id)},
        {"$set": lead_dict}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
    updated_lead = await db.leads.find_one({"_id": ObjectId(lead_id)})
    updated_lead['id'] = str(updated_lead['_id'])
    updated_lead['_id'] = str(updated_lead['_id'])
    return updated_lead

@api_router.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str):
    if not ObjectId.is_valid(lead_id):
        raise HTTPException(status_code=400, detail="Invalid lead ID")
    result = await db.leads.delete_one({"_id": ObjectId(lead_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
    # Also delete interactions
    await db.interactions.delete_many({"lead_id": lead_id})
    return {"message": "Lead deleted successfully"}

# Interactions
@api_router.post("/interactions")
async def create_interaction(interaction: InteractionCreate):
    interaction_dict = interaction.dict()
    interaction_dict['created_at'] = datetime.utcnow()
    result = await db.interactions.insert_one(interaction_dict)
    interaction_dict['id'] = str(result.inserted_id)
    interaction_dict['_id'] = str(result.inserted_id)
    return interaction_dict

@api_router.get("/interactions/{lead_id}")
async def get_interactions(lead_id: str):
    interactions = await db.interactions.find({"lead_id": lead_id}).sort("created_at", -1).to_list(1000)
    for interaction in interactions:
        interaction['id'] = str(interaction['_id'])
        interaction['_id'] = str(interaction['_id'])
    return interactions

# Dashboard Stats
@api_router.get("/dashboard/stats")
async def get_dashboard_stats():
    total_leads = await db.leads.count_documents({})
    
    # Today's follow-ups
    today = datetime.utcnow().date().isoformat()
    today_followups = await db.leads.count_documents({"next_followup_date": today})
    
    # Overdue follow-ups
    overdue_followups = await db.leads.count_documents({
        "next_followup_date": {"$lt": today},
        "status": {"$nin": ["Closed", "Not Interested"]}
    })
    
    interested_leads = await db.leads.count_documents({"status": "Interested"})
    closed_leads = await db.leads.count_documents({"status": "Closed"})
    
    # Monthly business count (closed this month)
    current_month = datetime.utcnow().strftime("%Y-%m")
    monthly_business_count = await db.leads.count_documents({
        "status": "Closed",
        "expected_closing_month": {"$regex": current_month}
    })
    
    # Calculate closing ratio
    monthly_closing_ratio = 0.0
    if total_leads > 0:
        monthly_closing_ratio = round((closed_leads / total_leads) * 100, 2)
    
    return {
        "total_leads": total_leads,
        "today_followups": today_followups,
        "overdue_followups": overdue_followups,
        "interested_leads": interested_leads,
        "closed_leads": closed_leads,
        "monthly_business_count": monthly_business_count,
        "monthly_closing_ratio": monthly_closing_ratio
    }

# Follow-ups
@api_router.get("/followups")
async def get_followups(filter: Optional[str] = None):
    today = datetime.utcnow().date().isoformat()
    
    query = {"status": {"$nin": ["Closed", "Not Interested"]}}
    
    if filter == "today":
        query["next_followup_date"] = today
    elif filter == "overdue":
        query["next_followup_date"] = {"$lt": today}
    elif filter == "upcoming":
        query["next_followup_date"] = {"$gt": today}
    
    leads = await db.leads.find(query).sort("next_followup_date", 1).to_list(1000)
    for lead in leads:
        lead['id'] = str(lead['_id'])
        lead['_id'] = str(lead['_id'])
    return leads

# Reports
@api_router.get("/reports")
async def get_reports():
    all_leads = await db.leads.find().to_list(1000)
    
    total_leads = len(all_leads)
    closed_leads = len([l for l in all_leads if l.get('status') == 'Closed'])
    
    closing_ratio = 0.0
    lead_conversion = 0.0
    if total_leads > 0:
        closing_ratio = round((closed_leads / total_leads) * 100, 2)
        lead_conversion = round((closed_leads / total_leads) * 100, 2)
    
    # Source performance
    source_performance = {}
    for lead in all_leads:
        source = lead.get('source', 'Unknown')
        if source not in source_performance:
            source_performance[source] = {'total': 0, 'closed': 0}
        source_performance[source]['total'] += 1
        if lead.get('status') == 'Closed':
            source_performance[source]['closed'] += 1
    
    return {
        "closing_ratio": closing_ratio,
        "lead_conversion": lead_conversion,
        "source_performance": source_performance
    }

# Search
@api_router.get("/search")
async def search_leads(q: str):
    query = {
        "$or": [
            {"name": {"$regex": q, "$options": "i"}},
            {"mobile": {"$regex": q, "$options": "i"}},
            {"city": {"$regex": q, "$options": "i"}}
        ]
    }
    leads = await db.leads.find(query).to_list(1000)
    for lead in leads:
        lead['id'] = str(lead['_id'])
        lead['_id'] = str(lead['_id'])
    return leads

# Export
@api_router.get("/export/{format}")
async def export_data(format: str):
    leads = await db.leads.find().to_list(1000)
    
    # Convert ObjectId to string for serialization
    for lead in leads:
        lead['id'] = str(lead['_id'])
        del lead['_id']
        # Convert datetime to string
        if 'created_at' in lead:
            lead['created_at'] = lead['created_at'].isoformat()
        if 'updated_at' in lead:
            lead['updated_at'] = lead['updated_at'].isoformat()
    
    if format == "json":
        json_str = json.dumps(leads, indent=2, default=str)
        return StreamingResponse(
            io.StringIO(json_str),
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=getinsure_export.json"}
        )
    
    elif format == "csv":
        output = io.StringIO()
        if leads:
            fieldnames = ['id', 'name', 'mobile', 'product', 'status', 'source', 'city', 
                         'notes', 'next_followup_date', 'next_followup_type',
                         'created_at', 'updated_at']
            writer = csv.DictWriter(output, fieldnames=fieldnames)
            writer.writeheader()
            for lead in leads:
                writer.writerow({k: lead.get(k, '') for k in fieldnames})
        
        output.seek(0)
        return StreamingResponse(
            output,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=getinsure_export.csv"}
        )
    
    else:
        raise HTTPException(status_code=400, detail="Invalid format. Use 'json' or 'csv'")

# Renewal Calendar
@api_router.get("/renewals/{days}")
async def get_renewals(days: int):
    """Get policies expiring in next X days"""
    today = datetime.utcnow().date()
    target_date = today + timedelta(days=days)
    
    leads = await db.leads.find({
        "policy_end_date": {
            "$gte": today.isoformat(),
            "$lte": target_date.isoformat()
        },
        "status": {"$in": ["Policy Issued", "Renewal"]}
    }).to_list(1000)
    
    for lead in leads:
        lead['id'] = str(lead['_id'])
        lead['_id'] = str(lead['_id'])
    
    return leads

# Family Members
@api_router.get("/family/{family_head_id}")
async def get_family_members(family_head_id: str):
    """Get all family members for a family head"""
    if not ObjectId.is_valid(family_head_id):
        raise HTTPException(status_code=400, detail="Invalid family head ID")
    
    family_members = await db.leads.find({
        "$or": [
            {"_id": ObjectId(family_head_id)},
            {"family_head_id": family_head_id}
        ]
    }).to_list(100)
    
    for member in family_members:
        member['id'] = str(member['_id'])
        member['_id'] = str(member['_id'])
    
    return family_members

# Excel Import
@api_router.post("/import/excel")
async def import_excel(file: UploadFile = File(...)):
    """Import leads from Excel file"""
    try:
        # Read Excel file
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        
        # Column mapping (flexible)
        column_map = {
            'name': ['name', 'Name', 'NAME', 'Client Name', 'Customer Name'],
            'mobile': ['mobile', 'Mobile', 'MOBILE', 'Phone', 'Ph No', 'Contact'],
            'product': ['product', 'Product', 'PRODUCT', 'Insurance Type'],
            'city': ['city', 'City', 'CITY', 'Location'],
            'status': ['status', 'Status', 'STATUS'],
            'source': ['source', 'Source', 'SOURCE'],
        }
        
        imported_count = 0
        errors = []
        
        for index, row in df.iterrows():
            try:
                # Map columns
                lead_data = {}
                for field, possible_names in column_map.items():
                    for col_name in possible_names:
                        if col_name in df.columns and pd.notna(row[col_name]):
                            lead_data[field] = str(row[col_name])
                            break
                
                # Validate required fields
                if 'name' not in lead_data or 'mobile' not in lead_data:
                    errors.append(f"Row {index + 2}: Missing name or mobile")
                    continue
                
                # Set defaults
                lead_data.setdefault('product', 'Life')
                lead_data.setdefault('status', 'Lead')
                lead_data.setdefault('source', 'Import')
                lead_data.setdefault('city', '')
                lead_data['created_at'] = datetime.utcnow()
                lead_data['updated_at'] = datetime.utcnow()
                
                # Insert
                await db.leads.insert_one(lead_data)
                imported_count += 1
                
            except Exception as e:
                errors.append(f"Row {index + 2}: {str(e)}")
        
        return {
            "success": True,
            "imported": imported_count,
            "errors": errors
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to import: {str(e)}")

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
