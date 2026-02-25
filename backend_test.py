#!/usr/bin/env python3
"""
GETINSURE CRM Backend API Testing Suite
Tests all backend endpoints comprehensively
"""

import requests
import json
from datetime import datetime, date, timedelta
import sys
import os

# Backend URL from environment
BACKEND_URL = "https://getinsure-preview.preview.emergentagent.com/api"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def print_success(message):
    print(f"{Colors.GREEN}✓ {message}{Colors.ENDC}")

def print_error(message):
    print(f"{Colors.RED}✗ {message}{Colors.ENDC}")

def print_warning(message):
    print(f"{Colors.YELLOW}⚠ {message}{Colors.ENDC}")

def print_info(message):
    print(f"{Colors.BLUE}ℹ {message}{Colors.ENDC}")

class GetInsureAPITester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.session = requests.Session()
        self.created_leads = []
        self.test_results = {
            'passed': 0,
            'failed': 0,
            'errors': []
        }
    
    def log_result(self, test_name, success, message="", error_details=""):
        if success:
            self.test_results['passed'] += 1
            print_success(f"{test_name}: {message}")
        else:
            self.test_results['failed'] += 1
            error_msg = f"{test_name}: {message}"
            if error_details:
                error_msg += f" - {error_details}"
            self.test_results['errors'].append(error_msg)
            print_error(error_msg)
    
    def test_api_root(self):
        """Test API root endpoint"""
        print_info("Testing API Root...")
        try:
            response = self.session.get(f"{self.base_url}/")
            if response.status_code == 200:
                data = response.json()
                if "GETINSURE CRM API" in data.get("message", ""):
                    self.log_result("API Root", True, "API is accessible")
                    return True
                else:
                    self.log_result("API Root", False, "Unexpected response message", str(data))
            else:
                self.log_result("API Root", False, f"HTTP {response.status_code}", response.text)
        except Exception as e:
            self.log_result("API Root", False, "Connection failed", str(e))
        return False
    
    def test_create_leads(self):
        """Test creating leads with different scenarios"""
        print_info("Testing Lead Creation...")
        
        # Test data for different lead scenarios
        test_leads = [
            {
                "name": "Rajesh Kumar",
                "mobile": "9876543210",
                "product": "Life",
                "status": "New",
                "source": "Walk-in",
                "city": "Mumbai",
                "premium_amount": 50000.0,
                "expected_closing_month": "2024-12",
                "notes": "Interested in term insurance",
                "next_followup_date": (datetime.now() + timedelta(days=1)).date().isoformat()
            },
            {
                "name": "Priya Sharma",
                "mobile": "9876543211",
                "product": "Health",
                "status": "Contacted",
                "source": "Reference",
                "city": "Delhi",
                "premium_amount": 25000.0,
                "expected_closing_month": "2024-11",
                "notes": "Family health insurance needed"
            },
            {
                "name": "Amit Patel",
                "mobile": "9876543212",
                "product": "Motor",
                "status": "Interested",
                "source": "Online",
                "city": "Bangalore",
                "premium_amount": 15000.0,
                "expected_closing_month": "2024-10",
                "notes": "Car insurance renewal",
                "next_followup_date": datetime.now().date().isoformat()
            },
            {
                "name": "Sunita Gupta",
                "mobile": "9876543213",
                "product": "Investment",
                "status": "Proposal",
                "source": "Other",
                "city": "Chennai",
                "premium_amount": 100000.0,
                "expected_closing_month": "2024-09",
                "notes": "ULIP investment plan"
            },
            {
                "name": "Vikram Singh",
                "mobile": "9876543214",
                "product": "Life",
                "status": "Closed",
                "source": "Walk-in",
                "city": "Pune",
                "premium_amount": 75000.0,
                "expected_closing_month": "2024-08",
                "notes": "Policy issued successfully"
            },
            {
                "name": "Neha Agarwal",
                "mobile": "9876543215",
                "product": "Health",
                "status": "Not Interested",
                "source": "Reference",
                "city": "Hyderabad",
                "premium_amount": 0.0,
                "expected_closing_month": "",
                "notes": "Not interested in current offerings"
            }
        ]
        
        for i, lead_data in enumerate(test_leads):
            try:
                response = self.session.post(f"{self.base_url}/leads", json=lead_data)
                if response.status_code == 200:
                    created_lead = response.json()
                    if 'id' in created_lead and created_lead['name'] == lead_data['name']:
                        self.created_leads.append(created_lead)
                        self.log_result(f"Create Lead {i+1}", True, f"Created lead: {lead_data['name']}")
                    else:
                        self.log_result(f"Create Lead {i+1}", False, "Invalid response structure", str(created_lead))
                else:
                    self.log_result(f"Create Lead {i+1}", False, f"HTTP {response.status_code}", response.text)
            except Exception as e:
                self.log_result(f"Create Lead {i+1}", False, "Request failed", str(e))
    
    def test_get_all_leads(self):
        """Test getting all leads"""
        print_info("Testing Get All Leads...")
        try:
            response = self.session.get(f"{self.base_url}/leads")
            if response.status_code == 200:
                leads = response.json()
                if isinstance(leads, list) and len(leads) >= len(self.created_leads):
                    self.log_result("Get All Leads", True, f"Retrieved {len(leads)} leads")
                    return leads
                else:
                    self.log_result("Get All Leads", False, "Unexpected response format or count", str(leads))
            else:
                self.log_result("Get All Leads", False, f"HTTP {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Get All Leads", False, "Request failed", str(e))
        return []
    
    def test_get_specific_lead(self):
        """Test getting specific leads by ID"""
        print_info("Testing Get Specific Lead...")
        if not self.created_leads:
            self.log_result("Get Specific Lead", False, "No leads available to test")
            return
        
        for i, lead in enumerate(self.created_leads[:3]):  # Test first 3 leads
            try:
                lead_id = lead['id']
                response = self.session.get(f"{self.base_url}/leads/{lead_id}")
                if response.status_code == 200:
                    retrieved_lead = response.json()
                    if retrieved_lead['id'] == lead_id and retrieved_lead['name'] == lead['name']:
                        self.log_result(f"Get Lead {i+1}", True, f"Retrieved lead: {lead['name']}")
                    else:
                        self.log_result(f"Get Lead {i+1}", False, "Data mismatch", str(retrieved_lead))
                else:
                    self.log_result(f"Get Lead {i+1}", False, f"HTTP {response.status_code}", response.text)
            except Exception as e:
                self.log_result(f"Get Lead {i+1}", False, "Request failed", str(e))
    
    def test_update_lead(self):
        """Test updating leads"""
        print_info("Testing Lead Updates...")
        if not self.created_leads:
            self.log_result("Update Lead", False, "No leads available to test")
            return
        
        # Update first lead
        lead_to_update = self.created_leads[0]
        updated_data = {
            "name": lead_to_update['name'],
            "mobile": lead_to_update['mobile'],
            "product": lead_to_update['product'],
            "status": "Contacted",  # Change status
            "source": lead_to_update['source'],
            "city": lead_to_update['city'],
            "premium_amount": 60000.0,  # Change premium
            "expected_closing_month": "2024-12",
            "notes": "Updated notes - Follow up completed",
            "next_followup_date": (datetime.now() + timedelta(days=3)).date().isoformat()
        }
        
        try:
            response = self.session.put(f"{self.base_url}/leads/{lead_to_update['id']}", json=updated_data)
            if response.status_code == 200:
                updated_lead = response.json()
                if (updated_lead['status'] == "Contacted" and 
                    updated_lead['premium_amount'] == 60000.0):
                    self.log_result("Update Lead", True, f"Updated lead: {updated_lead['name']}")
                    # Update our local copy
                    self.created_leads[0] = updated_lead
                else:
                    self.log_result("Update Lead", False, "Update not reflected", str(updated_lead))
            else:
                self.log_result("Update Lead", False, f"HTTP {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Update Lead", False, "Request failed", str(e))
    
    def test_create_interactions(self):
        """Test creating interactions for leads"""
        print_info("Testing Interaction Creation...")
        if not self.created_leads:
            self.log_result("Create Interactions", False, "No leads available to test")
            return
        
        # Create interactions for first 3 leads
        interaction_types = ["Call", "WhatsApp", "Meeting", "Note"]
        
        for i, lead in enumerate(self.created_leads[:3]):
            interaction_data = {
                "lead_id": lead['id'],
                "type": interaction_types[i % len(interaction_types)],
                "description": f"Test interaction {i+1} - Discussed {lead['product']} insurance options"
            }
            
            try:
                response = self.session.post(f"{self.base_url}/interactions", json=interaction_data)
                if response.status_code == 200:
                    interaction = response.json()
                    if (interaction['lead_id'] == lead['id'] and 
                        interaction['type'] == interaction_data['type']):
                        self.log_result(f"Create Interaction {i+1}", True, f"Created {interaction_data['type']} interaction")
                    else:
                        self.log_result(f"Create Interaction {i+1}", False, "Invalid response", str(interaction))
                else:
                    self.log_result(f"Create Interaction {i+1}", False, f"HTTP {response.status_code}", response.text)
            except Exception as e:
                self.log_result(f"Create Interaction {i+1}", False, "Request failed", str(e))
    
    def test_get_interactions(self):
        """Test getting interactions for leads"""
        print_info("Testing Get Interactions...")
        if not self.created_leads:
            self.log_result("Get Interactions", False, "No leads available to test")
            return
        
        # Test interactions for first lead
        lead = self.created_leads[0]
        try:
            response = self.session.get(f"{self.base_url}/interactions/{lead['id']}")
            if response.status_code == 200:
                interactions = response.json()
                if isinstance(interactions, list):
                    self.log_result("Get Interactions", True, f"Retrieved {len(interactions)} interactions for lead")
                else:
                    self.log_result("Get Interactions", False, "Invalid response format", str(interactions))
            else:
                self.log_result("Get Interactions", False, f"HTTP {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Get Interactions", False, "Request failed", str(e))
    
    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        print_info("Testing Dashboard Stats...")
        try:
            response = self.session.get(f"{self.base_url}/dashboard/stats")
            if response.status_code == 200:
                stats = response.json()
                required_fields = ['total_leads', 'today_followups', 'overdue_followups', 
                                 'interested_leads', 'closed_leads', 'monthly_business_count', 
                                 'monthly_closing_ratio']
                
                if all(field in stats for field in required_fields):
                    self.log_result("Dashboard Stats", True, f"Stats: {stats['total_leads']} total leads, {stats['closed_leads']} closed")
                else:
                    missing_fields = [f for f in required_fields if f not in stats]
                    self.log_result("Dashboard Stats", False, f"Missing fields: {missing_fields}", str(stats))
            else:
                self.log_result("Dashboard Stats", False, f"HTTP {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Dashboard Stats", False, "Request failed", str(e))
    
    def test_followups(self):
        """Test follow-up filtering"""
        print_info("Testing Follow-ups...")
        
        filters = ["today", "overdue", "upcoming"]
        for filter_type in filters:
            try:
                response = self.session.get(f"{self.base_url}/followups?filter={filter_type}")
                if response.status_code == 200:
                    followups = response.json()
                    if isinstance(followups, list):
                        self.log_result(f"Followups ({filter_type})", True, f"Retrieved {len(followups)} {filter_type} follow-ups")
                    else:
                        self.log_result(f"Followups ({filter_type})", False, "Invalid response format", str(followups))
                else:
                    self.log_result(f"Followups ({filter_type})", False, f"HTTP {response.status_code}", response.text)
            except Exception as e:
                self.log_result(f"Followups ({filter_type})", False, "Request failed", str(e))
    
    def test_reports(self):
        """Test analytics reports"""
        print_info("Testing Reports...")
        try:
            response = self.session.get(f"{self.base_url}/reports")
            if response.status_code == 200:
                report = response.json()
                required_fields = ['total_business_premium', 'monthly_business', 'closing_ratio', 
                                 'lead_conversion', 'source_performance']
                
                if all(field in report for field in required_fields):
                    self.log_result("Reports", True, f"Premium: ₹{report['total_business_premium']}, Ratio: {report['closing_ratio']}%")
                else:
                    missing_fields = [f for f in required_fields if f not in report]
                    self.log_result("Reports", False, f"Missing fields: {missing_fields}", str(report))
            else:
                self.log_result("Reports", False, f"HTTP {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Reports", False, "Request failed", str(e))
    
    def test_search(self):
        """Test search functionality"""
        print_info("Testing Search...")
        if not self.created_leads:
            self.log_result("Search", False, "No leads available to test")
            return
        
        # Search by name
        search_name = self.created_leads[0]['name'].split()[0]  # First name
        try:
            response = self.session.get(f"{self.base_url}/search?q={search_name}")
            if response.status_code == 200:
                results = response.json()
                if isinstance(results, list) and len(results) > 0:
                    found = any(search_name.lower() in result['name'].lower() for result in results)
                    if found:
                        self.log_result("Search (Name)", True, f"Found {len(results)} results for '{search_name}'")
                    else:
                        self.log_result("Search (Name)", False, "Search results don't match query", str(results))
                else:
                    self.log_result("Search (Name)", False, "No results found", str(results))
            else:
                self.log_result("Search (Name)", False, f"HTTP {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Search (Name)", False, "Request failed", str(e))
        
        # Search by mobile
        search_mobile = self.created_leads[0]['mobile'][:4]  # First 4 digits
        try:
            response = self.session.get(f"{self.base_url}/search?q={search_mobile}")
            if response.status_code == 200:
                results = response.json()
                if isinstance(results, list):
                    self.log_result("Search (Mobile)", True, f"Found {len(results)} results for mobile '{search_mobile}'")
                else:
                    self.log_result("Search (Mobile)", False, "Invalid response format", str(results))
            else:
                self.log_result("Search (Mobile)", False, f"HTTP {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Search (Mobile)", False, "Request failed", str(e))
    
    def test_export(self):
        """Test export functionality"""
        print_info("Testing Export...")
        
        formats = ["json", "csv"]
        for format_type in formats:
            try:
                response = self.session.get(f"{self.base_url}/export/{format_type}")
                if response.status_code == 200:
                    content_type = response.headers.get('content-type', '')
                    if format_type == "json" and "application/json" in content_type:
                        self.log_result(f"Export ({format_type.upper()})", True, "JSON export successful")
                    elif format_type == "csv" and "text/csv" in content_type:
                        self.log_result(f"Export ({format_type.upper()})", True, "CSV export successful")
                    else:
                        self.log_result(f"Export ({format_type.upper()})", False, f"Wrong content type: {content_type}")
                else:
                    self.log_result(f"Export ({format_type.upper()})", False, f"HTTP {response.status_code}", response.text)
            except Exception as e:
                self.log_result(f"Export ({format_type.upper()})", False, "Request failed", str(e))
    
    def test_delete_lead(self):
        """Test deleting leads (cleanup)"""
        print_info("Testing Lead Deletion...")
        if not self.created_leads:
            self.log_result("Delete Lead", False, "No leads available to test")
            return
        
        # Delete last created lead
        lead_to_delete = self.created_leads[-1]
        try:
            response = self.session.delete(f"{self.base_url}/leads/{lead_to_delete['id']}")
            if response.status_code == 200:
                result = response.json()
                if "deleted successfully" in result.get('message', ''):
                    self.log_result("Delete Lead", True, f"Deleted lead: {lead_to_delete['name']}")
                    self.created_leads.pop()  # Remove from our list
                else:
                    self.log_result("Delete Lead", False, "Unexpected response", str(result))
            else:
                self.log_result("Delete Lead", False, f"HTTP {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Delete Lead", False, "Request failed", str(e))
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print(f"{Colors.BOLD}=== GETINSURE CRM Backend API Testing ==={Colors.ENDC}")
        print(f"Backend URL: {self.base_url}")
        print()
        
        # Test API connectivity first
        if not self.test_api_root():
            print_error("API is not accessible. Stopping tests.")
            return self.get_summary()
        
        # Run all tests
        self.test_create_leads()
        self.test_get_all_leads()
        self.test_get_specific_lead()
        self.test_update_lead()
        self.test_create_interactions()
        self.test_get_interactions()
        self.test_dashboard_stats()
        self.test_followups()
        self.test_reports()
        self.test_search()
        self.test_export()
        self.test_delete_lead()
        
        return self.get_summary()
    
    def get_summary(self):
        """Get test summary"""
        total_tests = self.test_results['passed'] + self.test_results['failed']
        success_rate = (self.test_results['passed'] / total_tests * 100) if total_tests > 0 else 0
        
        print()
        print(f"{Colors.BOLD}=== TEST SUMMARY ==={Colors.ENDC}")
        print(f"Total Tests: {total_tests}")
        print(f"{Colors.GREEN}Passed: {self.test_results['passed']}{Colors.ENDC}")
        print(f"{Colors.RED}Failed: {self.test_results['failed']}{Colors.ENDC}")
        print(f"Success Rate: {success_rate:.1f}%")
        
        if self.test_results['errors']:
            print(f"\n{Colors.RED}FAILED TESTS:{Colors.ENDC}")
            for error in self.test_results['errors']:
                print(f"  • {error}")
        
        return {
            'total_tests': total_tests,
            'passed': self.test_results['passed'],
            'failed': self.test_results['failed'],
            'success_rate': success_rate,
            'errors': self.test_results['errors']
        }

if __name__ == "__main__":
    tester = GetInsureAPITester()
    summary = tester.run_all_tests()
    
    # Exit with error code if tests failed
    if summary['failed'] > 0:
        sys.exit(1)
    else:
        sys.exit(0)