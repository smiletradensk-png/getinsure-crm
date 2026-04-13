from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, date, timedelta
from bson import ObjectId
import csv
import json
import io
from fastapi.responses import StreamingResponse
import pandas as pd
from emergentintegrations.llm.openai import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Emergent LLM Key for AI Assistant
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', 'sk-emergent-cE90dF5Cc5b089fB38')

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
    status: str  # New/Contacted/Interested/Follow-up/Pipeline/Closed/Not Interested
    source: str  # Walk-in/Reference/Online/Facebook Ads/Other
    city: Optional[str] = ""
    notes: Optional[str] = ""
    next_followup_date: Optional[str] = None
    next_followup_time: Optional[str] = None
    next_followup_type: Optional[str] = "Call"

class Lead(LeadCreate):
    id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class InteractionCreate(BaseModel):
    lead_id: str
    type: str  # Call/WhatsApp/Meeting/Note/Email/Online/Message/Other
    description: str
    location: Optional[str] = None
    interaction_date: Optional[str] = None
    interaction_time: Optional[str] = None

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
    # Optimized query with projection for better performance
    projection = {
        'name': 1, 'mobile': 1, 'product': 1, 'status': 1, 
        'source': 1, 'city': 1, 'next_followup_date': 1,
        'next_followup_time': 1, 'notes': 1, 'created_at': 1, 'updated_at': 1
    }
    leads = await db.leads.find({}, projection).sort("created_at", -1).to_list(500)
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
    # Optimized with projection and limit
    projection = {'type': 1, 'description': 1, 'lead_id': 1, 'created_at': 1, 'location': 1, 'interaction_date': 1, 'interaction_time': 1}
    interactions = await db.interactions.find({"lead_id": lead_id}, projection).sort("created_at", -1).to_list(100)
    for interaction in interactions:
        interaction['id'] = str(interaction['_id'])
        interaction['_id'] = str(interaction['_id'])
    return interactions

@api_router.delete("/interactions/{interaction_id}")
async def delete_interaction(interaction_id: str):
    if not ObjectId.is_valid(interaction_id):
        raise HTTPException(status_code=400, detail="Invalid interaction ID")
    result = await db.interactions.delete_one({"_id": ObjectId(interaction_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Interaction not found")
    return {"message": "Interaction deleted successfully"}

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
    
    # Optimized with projection and limit
    projection = {
        'name': 1, 'mobile': 1, 'product': 1, 'status': 1,
        'next_followup_date': 1, 'next_followup_time': 1, 'notes': 1
    }
    leads = await db.leads.find(query, projection).sort("next_followup_date", 1).to_list(200)
    for lead in leads:
        lead['id'] = str(lead['_id'])
        lead['_id'] = str(lead['_id'])
    return leads

# Reports
@api_router.get("/reports")
async def get_reports():
    # Optimized with projection - only fetch required fields
    projection = {'status': 1, 'source': 1}
    all_leads = await db.leads.find({}, projection).to_list(1000)
    
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
    # Optimized with projection and limit
    projection = {
        'name': 1, 'mobile': 1, 'product': 1, 'status': 1, 
        'city': 1, 'source': 1, 'next_followup_date': 1
    }
    leads = await db.leads.find(query, projection).limit(100).to_list(100)
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
                         'notes', 'next_followup_date', 'next_followup_time', 'next_followup_type',
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

# Facebook Lead Ads Webhook
@api_router.get("/facebook/webhook")
async def facebook_webhook_verify(
    mode: str = None,
    verify_token: str = None,
    challenge: str = None
):
    """Facebook webhook verification"""
    # Read token from environment variable
    VERIFY_TOKEN = os.environ.get('FACEBOOK_VERIFY_TOKEN', 'GETINSURE_CRM_TOKEN_2025')
    
    if mode == "subscribe" and verify_token == VERIFY_TOKEN:
        logger.info("Facebook webhook verified successfully")
        return int(challenge)
    else:
        raise HTTPException(status_code=403, detail="Verification failed")

@api_router.post("/facebook/webhook")
async def facebook_webhook_receive(request: dict):
    """Receive Facebook lead ads data"""
    try:
        logger.info(f"Facebook webhook received: {request}")
        
        # Extract lead data from Facebook payload
        if request.get('object') == 'page':
            for entry in request.get('entry', []):
                for change in entry.get('changes', []):
                    if change.get('field') == 'leadgen':
                        leadgen_data = change.get('value', {})
                        leadgen_id = leadgen_data.get('leadgen_id')
                        
                        # In production, fetch lead details from Facebook Graph API
                        # For now, create lead from webhook data
                        form_data = leadgen_data.get('form', {})
                        
                        # Create lead in database
                        lead_dict = {
                            'name': form_data.get('full_name', 'Facebook Lead'),
                            'mobile': form_data.get('phone_number', ''),
                            'product': 'Life',  # Default
                            'status': 'New',
                            'source': 'Facebook Ads',
                            'city': form_data.get('city', ''),
                            'notes': f'Lead from Facebook Ads. Lead ID: {leadgen_id}',
                            'created_at': datetime.utcnow(),
                            'updated_at': datetime.utcnow()
                        }
                        
                        result = await db.leads.insert_one(lead_dict)
                        logger.info(f"Facebook lead created: {result.inserted_id}")
                        
        return {"status": "success"}
        
    except Exception as e:
        logger.error(f"Error processing Facebook webhook: {str(e)}")
        return {"status": "error", "message": str(e)}

# Excel Import
@api_router.post("/import/excel")
async def import_excel(file: UploadFile):
    """Import leads from Excel file"""
    try:
        # Read Excel file
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        
        # Column mapping (flexible)
        column_map = {
            'name': ['name', 'Name', 'NAME', 'Client Name', 'Customer Name', 'Full Name'],
            'mobile': ['mobile', 'Mobile', 'MOBILE', 'Phone', 'Ph No', 'Contact', 'Phone Number'],
            'product': ['product', 'Product', 'PRODUCT', 'Insurance Type', 'Policy Type'],
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
                lead_data.setdefault('status', 'New')
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

# AI Assistant endpoint
class AIAssistantRequest(BaseModel):
    message: str
    context: Optional[dict] = None

class AIAssistantResponse(BaseModel):
    response: str
    action: Optional[dict] = None
    data: Optional[dict] = None

ASSISTANT_SYSTEM_PROMPT = """You are GETINSURE AI, a powerful and precise personal assistant for an Insurance CRM app. 
You have FULL ACCESS to manage leads and can perform any action the user requests.

YOUR CAPABILITIES:
1. ADD LEAD - Create new leads with name, mobile, product, status, source, city
2. SEARCH LEADS - Find leads by name, mobile, city, status, or product
3. UPDATE LEAD - Modify any lead's information (status, follow-up date, notes, etc.)
4. DELETE LEAD - Remove leads when requested
5. GET LEAD DETAILS - Show complete information about a specific lead
6. SCHEDULE FOLLOW-UP - Set follow-up dates and times for leads
7. ADD INTERACTION - Log calls, meetings, emails, notes for leads
8. GET STATISTICS - Show dashboard stats, pipeline counts, conversion rates
9. LIST LEADS - Show leads filtered by status, source, or date
10. BULK OPERATIONS - Update multiple leads at once

WHEN USER REQUESTS AN ACTION, RESPOND WITH JSON:
For adding a lead:
{"action": "add_lead", "data": {"name": "John", "mobile": "9876543210", "product": "Health Insurance", "status": "New", "source": "Walk-in", "city": "Mumbai"}}

For searching leads:
{"action": "search_leads", "query": "search term"}

For updating a lead:
{"action": "update_lead", "lead_id": "xxx", "data": {"status": "Interested", "next_followup_date": "2024-03-20"}}

For deleting a lead:
{"action": "delete_lead", "lead_id": "xxx"}

For getting lead details:
{"action": "get_lead", "lead_id": "xxx"}

For listing leads by status:
{"action": "list_leads", "filter": {"status": "Interested"}}

For scheduling follow-up:
{"action": "schedule_followup", "lead_id": "xxx", "date": "2024-03-20", "time": "10:00 AM"}

For navigation:
{"action": "navigate", "screen": "leads/followups/dashboard/settings/add-lead"}

IMPORTANT RULES:
- Be professional, precise, and helpful
- Never make spelling mistakes
- Confirm actions before executing when dealing with delete operations
- Provide clear, actionable responses
- When listing leads, show name, mobile, status, and product
- For dates, use YYYY-MM-DD format internally

Current date: """ + datetime.utcnow().strftime("%Y-%m-%d")

@api_router.post("/assistant/chat")
async def chat_with_assistant(request: AIAssistantRequest):
    try:
        # Get comprehensive context about leads
        leads_count = await db.leads.count_documents({})
        today = datetime.utcnow().date().isoformat()
        today_followups = await db.leads.count_documents({"next_followup_date": today})
        
        # Get status breakdown
        status_counts = {}
        for status in ["New", "Contacted", "Interested", "Proposal", "Closed", "Not Interested"]:
            count = await db.leads.count_documents({"status": status})
            status_counts[status] = count
        
        # Get recent leads for context
        recent_leads = await db.leads.find().sort("created_at", -1).limit(5).to_list(5)
        recent_leads_info = []
        for lead in recent_leads:
            recent_leads_info.append({
                "id": str(lead["_id"]),
                "name": lead.get("name", ""),
                "mobile": lead.get("mobile", ""),
                "status": lead.get("status", ""),
                "product": lead.get("product", "")
            })
        
        context_info = f"""
Current CRM Status:
- Total Leads: {leads_count}
- Today's Follow-ups: {today_followups}
- Status Breakdown: {json.dumps(status_counts)}
- Recent Leads: {json.dumps(recent_leads_info)}
"""
        
        if request.context:
            context_info += f"\nUser context: {json.dumps(request.context)}"
        
        full_system_prompt = ASSISTANT_SYSTEM_PROMPT + context_info
        
        # Use LlmChat for the AI response
        llm = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id="crm_assistant",
            system_message=full_system_prompt
        )
        
        response = await llm.send_message(UserMessage(text=request.message))
        response_text = response if isinstance(response, str) else str(response)
        
        # Check if response contains an action
        action = None
        action_result = None
        
        if '{"action"' in response_text:
            try:
                import re
                action_match = re.search(r'\{["\']action["\'][^}]+\}', response_text, re.DOTALL)
                if action_match:
                    action_str = action_match.group()
                    # Fix common JSON issues
                    action_str = action_str.replace("'", '"')
                    action = json.loads(action_str)
                    
                    # Execute the action
                    action_result = await execute_ai_action(action)
            except Exception as e:
                logger.error(f"Error parsing action: {e}")
        
        return AIAssistantResponse(
            response=response_text, 
            action=action,
            data=action_result
        )
        
    except Exception as e:
        logger.error(f"AI Assistant error: {str(e)}")
        return AIAssistantResponse(
            response="I apologize, but I encountered an error processing your request. Please try again.",
            action=None,
            data=None
        )

async def execute_ai_action(action: dict):
    """Execute AI-requested actions on leads"""
    action_type = action.get("action")
    
    try:
        if action_type == "add_lead":
            data = action.get("data", {})
            lead_data = {
                "name": data.get("name", ""),
                "mobile": data.get("mobile", ""),
                "product": data.get("product", ""),
                "status": data.get("status", "New"),
                "source": data.get("source", "AI Assistant"),
                "city": data.get("city", ""),
                "notes": data.get("notes", "Added via AI Assistant"),
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            result = await db.leads.insert_one(lead_data)
            return {"success": True, "lead_id": str(result.inserted_id), "message": "Lead added successfully"}
        
        elif action_type == "search_leads":
            query = action.get("query", "")
            search_query = {
                "$or": [
                    {"name": {"$regex": query, "$options": "i"}},
                    {"mobile": {"$regex": query, "$options": "i"}},
                    {"city": {"$regex": query, "$options": "i"}},
                    {"product": {"$regex": query, "$options": "i"}}
                ]
            }
            leads = await db.leads.find(search_query).limit(10).to_list(10)
            results = []
            for lead in leads:
                results.append({
                    "id": str(lead["_id"]),
                    "name": lead.get("name"),
                    "mobile": lead.get("mobile"),
                    "status": lead.get("status"),
                    "product": lead.get("product"),
                    "city": lead.get("city")
                })
            return {"success": True, "leads": results, "count": len(results)}
        
        elif action_type == "update_lead":
            lead_id = action.get("lead_id")
            data = action.get("data", {})
            if lead_id and ObjectId.is_valid(lead_id):
                data["updated_at"] = datetime.utcnow()
                await db.leads.update_one({"_id": ObjectId(lead_id)}, {"$set": data})
                return {"success": True, "message": "Lead updated successfully"}
            return {"success": False, "message": "Invalid lead ID"}
        
        elif action_type == "delete_lead":
            lead_id = action.get("lead_id")
            if lead_id and ObjectId.is_valid(lead_id):
                await db.leads.delete_one({"_id": ObjectId(lead_id)})
                return {"success": True, "message": "Lead deleted successfully"}
            return {"success": False, "message": "Invalid lead ID"}
        
        elif action_type == "get_lead":
            lead_id = action.get("lead_id")
            if lead_id and ObjectId.is_valid(lead_id):
                lead = await db.leads.find_one({"_id": ObjectId(lead_id)})
                if lead:
                    lead["id"] = str(lead["_id"])
                    del lead["_id"]
                    return {"success": True, "lead": lead}
            return {"success": False, "message": "Lead not found"}
        
        elif action_type == "list_leads":
            filter_data = action.get("filter", {})
            leads = await db.leads.find(filter_data).limit(20).to_list(20)
            results = []
            for lead in leads:
                results.append({
                    "id": str(lead["_id"]),
                    "name": lead.get("name"),
                    "mobile": lead.get("mobile"),
                    "status": lead.get("status"),
                    "product": lead.get("product")
                })
            return {"success": True, "leads": results, "count": len(results)}
        
        elif action_type == "schedule_followup":
            lead_id = action.get("lead_id")
            date = action.get("date")
            time = action.get("time")
            if lead_id and ObjectId.is_valid(lead_id):
                update_data = {"updated_at": datetime.utcnow()}
                if date:
                    update_data["next_followup_date"] = date
                if time:
                    update_data["next_followup_time"] = time
                await db.leads.update_one({"_id": ObjectId(lead_id)}, {"$set": update_data})
                return {"success": True, "message": "Follow-up scheduled successfully"}
            return {"success": False, "message": "Invalid lead ID"}
        
        return {"success": False, "message": "Unknown action"}
        
    except Exception as e:
        logger.error(f"Error executing AI action: {e}")
        return {"success": False, "message": str(e)}

# User Settings endpoints
class UserSettings(BaseModel):
    font_size: str = "medium"  # small, medium, large, extra-large
    custom_products: List[str] = []
    custom_statuses: List[str] = []
    custom_sources: List[str] = []
    custom_cities: List[str] = []

@api_router.get("/settings/user")
async def get_user_settings():
    settings = await db.user_settings.find_one({"user_id": "default"})
    if not settings:
        default_settings = {
            "user_id": "default",
            "font_size": "medium",
            "custom_products": ["Term Insurance", "Health Insurance", "Motor Insurance", "Life Insurance", "Travel Insurance"],
            "custom_statuses": ["New", "Contacted", "Interested", "Proposal", "Closed", "Not Interested", "Follow-up", "Pipeline"],
            "custom_sources": ["Walk-in", "Reference", "Online", "Facebook Ads", "Google Ads", "WhatsApp", "Other"],
            "custom_cities": []
        }
        await db.user_settings.insert_one(default_settings)
        return default_settings
    settings['id'] = str(settings['_id'])
    del settings['_id']
    return settings

@api_router.put("/settings/user")
async def update_user_settings(settings: UserSettings):
    result = await db.user_settings.update_one(
        {"user_id": "default"},
        {"$set": settings.dict()},
        upsert=True
    )
    return {"message": "Settings updated successfully"}

@api_router.post("/settings/dropdown/{dropdown_type}")
async def add_dropdown_item(dropdown_type: str, item: dict):
    """Add a new item to a dropdown list"""
    valid_types = ["custom_products", "custom_statuses", "custom_sources", "custom_cities"]
    if dropdown_type not in valid_types:
        raise HTTPException(status_code=400, detail="Invalid dropdown type")
    
    await db.user_settings.update_one(
        {"user_id": "default"},
        {"$addToSet": {dropdown_type: item.get("value")}},
        upsert=True
    )
    return {"message": f"Added to {dropdown_type}"}

@api_router.delete("/settings/dropdown/{dropdown_type}/{item}")
async def delete_dropdown_item(dropdown_type: str, item: str):
    """Delete an item from a dropdown list"""
    valid_types = ["custom_products", "custom_statuses", "custom_sources", "custom_cities"]
    if dropdown_type not in valid_types:
        raise HTTPException(status_code=400, detail="Invalid dropdown type")
    
    await db.user_settings.update_one(
        {"user_id": "default"},
        {"$pull": {dropdown_type: item}}
    )
    return {"message": f"Removed from {dropdown_type}"}

# Include the router in the main app - MUST BE AFTER ALL ROUTE DEFINITIONS
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
