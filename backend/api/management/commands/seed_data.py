from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from datetime import date, timedelta
from decimal import Decimal
from django.contrib.auth import get_user_model
from api.models import (
    Tenant, PlantCode, AirportCode, DataSource, 
    UploadBatch, RawRecord, NormalizedRecord, ReviewRecord, AuditLog
)

User = get_user_model()

class Command(BaseCommand):
    help = "Seed database with realistic multi-tenant data for Carbon Data Review Platform"

    def handle(self, *args, **options):
        self.stdout.write("Starting database seeding...")
        
        with transaction.atomic():
            # 1. Clear existing data
            self.stdout.write("Clearing old records...")
            AuditLog.objects.all().delete()
            ReviewRecord.all_objects.all().delete()
            NormalizedRecord.all_objects.all().delete()
            RawRecord.objects.all().delete()
            UploadBatch.objects.all().delete()
            DataSource.objects.all().delete()
            PlantCode.objects.all().delete()
            AirportCode.objects.all().delete()
            User.objects.all().delete()
            Tenant.objects.all().delete()

            # 2. Create Tenants
            self.stdout.write("Creating tenants...")
            eco_corp = Tenant.objects.create(name="EcoCorp Industries")
            green_log = Tenant.objects.create(name="Green Logistics SA")

            # 3. Create Users
            self.stdout.write("Creating users...")
            # EcoCorp Users
            ec_analyst = User.objects.create_user(
                username="analyst@ecocorp.com",
                email="analyst@ecocorp.com",
                password="password123",
                tenant=eco_corp,
                role="ANALYST",
                first_name="Alice",
                last_name="Analyst"
            )
            ec_admin = User.objects.create_user(
                username="admin@ecocorp.com",
                email="admin@ecocorp.com",
                password="password123",
                tenant=eco_corp,
                role="ADMIN",
                first_name="Bob",
                last_name="Admin"
            )
            
            # Green Logistics Users
            gl_analyst = User.objects.create_user(
                username="analyst@greenlog.com",
                email="analyst@greenlog.com",
                password="password123",
                tenant=green_log,
                role="ANALYST",
                first_name="Charlie",
                last_name="Analyst"
            )

            # Create standard superuser
            superuser = User.objects.create_superuser(
                username="admin",
                email="admin@platform.com",
                password="adminpassword",
                role="ADMIN"
            )

            # 4. Create Airports (Global lookup table)
            self.stdout.write("Seeding global Airport lookup table...")
            airports = [
                {"code": "JFK", "name": "John F. Kennedy International Airport", "city": "New York", "country": "USA", "latitude": Decimal("40.6413"), "longitude": Decimal("-73.7781")},
                {"code": "LHR", "name": "London Heathrow Airport", "city": "London", "country": "UK", "latitude": Decimal("51.4700"), "longitude": Decimal("-0.4543")},
                {"code": "FRA", "name": "Frankfurt Airport", "city": "Frankfurt", "country": "Germany", "latitude": Decimal("50.0379"), "longitude": Decimal("8.5622")},
                {"code": "CDG", "name": "Charles de Gaulle Airport", "city": "Paris", "country": "France", "latitude": Decimal("49.0097"), "longitude": Decimal("2.5479")},
                {"code": "HND", "name": "Tokyo Haneda Airport", "city": "Tokyo", "country": "Japan", "latitude": Decimal("35.5494"), "longitude": Decimal("139.7798")},
                {"code": "DXB", "name": "Dubai International Airport", "city": "Dubai", "country": "UAE", "latitude": Decimal("25.2532"), "longitude": Decimal("55.3657")},
                {"code": "AMS", "name": "Amsterdam Airport Schiphol", "city": "Amsterdam", "country": "Netherlands", "latitude": Decimal("52.3105"), "longitude": Decimal("4.7683")},
                {"code": "ORD", "name": "O'Hare International Airport", "city": "Chicago", "country": "USA", "latitude": Decimal("41.9742"), "longitude": Decimal("-87.9073")},
            ]
            for ap in airports:
                AirportCode.objects.create(**ap)

            # 5. Create PlantCodes
            self.stdout.write("Seeding Plant codes...")
            # EcoCorp Plants
            PlantCode.objects.create(tenant=eco_corp, code="PL01", name="Berlin Production Hub", location="Berlin, Germany")
            PlantCode.objects.create(tenant=eco_corp, code="PL02", name="Munich R&D Facility", location="Munich, Germany")
            PlantCode.objects.create(tenant=eco_corp, code="PL03", name="Stuttgart Assembly Line", location="Stuttgart, Germany")
            
            # GreenLog Plants
            PlantCode.objects.create(tenant=green_log, code="LOG-DE", name="Frankfurt Depot", location="Frankfurt, Germany")
            PlantCode.objects.create(tenant=green_log, code="LOG-NL", name="Rotterdam Port Depot", location="Rotterdam, Netherlands")

            # 6. Create Data Sources
            self.stdout.write("Creating Data Sources...")
            eco_sap = DataSource.objects.create(tenant=eco_corp, name="SAP ERP Fuel Tracker", source_type="SAP")
            eco_utility = DataSource.objects.create(tenant=eco_corp, name="Stadtwerke Utility Portal", source_type="UTILITY")
            eco_travel = DataSource.objects.create(tenant=eco_corp, name="Concur Corporate Travel", source_type="TRAVEL")

            gl_sap = DataSource.objects.create(tenant=green_log, name="SAP Logistics Fuels", source_type="SAP")
            gl_utility = DataSource.objects.create(tenant=green_log, name="Rotterdam Power Net", source_type="UTILITY")

            # 7. Create Seed Batches and Records for EcoCorp (Alice analyst)
            self.stdout.write("Seeding batches and review records...")
            
            # --- BATCH 1: SAP FUEL DATA (Scope 1) ---
            sap_batch = UploadBatch.objects.create(
                tenant=eco_corp,
                source_type="SAP",
                uploaded_by=ec_analyst,
                file_name="SAP_FUELS_MAY2026.csv",
                status="SUCCESS"
            )
            
            # SAP Row 1: Valid Diesel
            raw_sap_1 = RawRecord.objects.create(
                tenant=eco_corp, upload_batch=sap_batch, row_index=1,
                row_data={"WERK": "PL01", "KRAFTSTOFF": "Diesel", "MENGE": "850.5", "EINHEIT": "L", "DATUM": "15.05.2026"},
                status="PROCESSED"
            )
            ns1 = NormalizedRecord.objects.create(
                tenant=eco_corp, raw_record=raw_sap_1, upload_batch=sap_batch,
                source_type="SAP", scope="Scope 1", record_date=date(2026, 5, 15),
                plant_code="PL01", fuel_type="Diesel", fuel_qty=Decimal("850.5000"), fuel_unit="L",
                calculated_emissions_co2e=Decimal("2279.3400"), # 850.5 * 2.68
                calculation_details={"formula": "Quantity (L) * Emission Factor (kg CO2e/L)", "quantity": 850.5, "factor": 2.68, "factor_name": "Diesel Ingestion Factor (2.68 kg CO2e/L)"}
            )
            ReviewRecord.objects.create(
                tenant=eco_corp, normalized_record=ns1, validation_status="VALID",
                validation_errors=[], review_status="APPROVED", approved_by=ec_admin, approved_at=timezone.now() - timedelta(days=1)
            )

            # SAP Row 2: Valid Petrol in Gallons (Requires normalization)
            raw_sap_2 = RawRecord.objects.create(
                tenant=eco_corp, upload_batch=sap_batch, row_index=2,
                row_data={"WERK": "PL02", "KRAFTSTOFF": "Petrol", "MENGE": "100.0", "EINHEIT": "gal", "DATUM": "18.05.2026"},
                status="PROCESSED"
            )
            # 100 gallons = 378.541 liters -> 378.541 * 2.31 = 874.43 kg CO2e
            ns2 = NormalizedRecord.objects.create(
                tenant=eco_corp, raw_record=raw_sap_2, upload_batch=sap_batch,
                source_type="SAP", scope="Scope 1", record_date=date(2026, 5, 18),
                plant_code="PL02", fuel_type="Petrol", fuel_qty=Decimal("378.5410"), fuel_unit="L",
                calculated_emissions_co2e=Decimal("874.4297"),
                calculation_details={"formula": "Quantity (L) * Emission Factor (kg CO2e/L)", "quantity": 378.541, "factor": 2.31, "original_quantity": 100.0, "original_unit": "gal"}
            )
            ReviewRecord.objects.create(
                tenant=eco_corp, normalized_record=ns2, validation_status="VALID",
                validation_errors=[], review_status="PENDING"
            )

            # SAP Row 3: Suspicious Unknown Plant Code
            raw_sap_3 = RawRecord.objects.create(
                tenant=eco_corp, upload_batch=sap_batch, row_index=3,
                row_data={"WERK": "PL99", "KRAFTSTOFF": "Diesel", "MENGE": "500", "EINHEIT": "L", "DATUM": "20.05.2026"},
                status="PROCESSED"
            )
            ns3 = NormalizedRecord.objects.create(
                tenant=eco_corp, raw_record=raw_sap_3, upload_batch=sap_batch,
                source_type="SAP", scope="Scope 1", record_date=date(2026, 5, 20),
                plant_code="PL99", fuel_type="Diesel", fuel_qty=Decimal("500.0000"), fuel_unit="L",
                calculated_emissions_co2e=Decimal("1340.0000"), # 500 * 2.68
                calculation_details={"formula": "Quantity (L) * Emission Factor (kg CO2e/L)", "quantity": 500, "factor": 2.68}
            )
            ReviewRecord.objects.create(
                tenant=eco_corp, normalized_record=ns3, validation_status="SUSPICIOUS",
                validation_errors=["Unknown plant code 'PL99' (Not found in lookup table)"], review_status="PENDING"
            )

            # SAP Row 4: Suspicious Abnormally Large Quantity
            raw_sap_4 = RawRecord.objects.create(
                tenant=eco_corp, upload_batch=sap_batch, row_index=4,
                row_data={"WERK": "PL01", "KRAFTSTOFF": "Diesel", "MENGE": "125000", "EINHEIT": "L", "DATUM": "22.05.2026"},
                status="PROCESSED"
            )
            ns4 = NormalizedRecord.objects.create(
                tenant=eco_corp, raw_record=raw_sap_4, upload_batch=sap_batch,
                source_type="SAP", scope="Scope 1", record_date=date(2026, 5, 22),
                plant_code="PL01", fuel_type="Diesel", fuel_qty=Decimal("125000.0000"), fuel_unit="L",
                calculated_emissions_co2e=Decimal("335000.0000"), # 125000 * 2.68
                calculation_details={"formula": "Quantity (L) * Emission Factor (kg CO2e/L)", "quantity": 125000, "factor": 2.68}
            )
            ReviewRecord.objects.create(
                tenant=eco_corp, normalized_record=ns4, validation_status="SUSPICIOUS",
                validation_errors=["Abnormally large fuel quantity detected: 125000.0 L"], review_status="PENDING"
            )


            # --- BATCH 2: UTILITY ELECTRICITY DATA (Scope 2) ---
            utility_batch = UploadBatch.objects.create(
                tenant=eco_corp,
                source_type="UTILITY",
                uploaded_by=ec_analyst,
                file_name="UTILITY_PORTAL_Q1.csv",
                status="SUCCESS"
            )

            # Utility Row 1: Valid Electricity
            raw_ut_1 = RawRecord.objects.create(
                tenant=eco_corp, upload_batch=utility_batch, row_index=1,
                row_data={"meter_id": "MTR-10029", "kwh": "12450", "billing_start": "01.04.2026", "billing_end": "30.04.2026", "tariff": "Commercial Industrial"},
                status="PROCESSED"
            )
            nu1 = NormalizedRecord.objects.create(
                tenant=eco_corp, raw_record=raw_ut_1, upload_batch=utility_batch,
                source_type="UTILITY", scope="Scope 2", record_date=date(2026, 4, 30),
                meter_id="MTR-10029", electricity_kwh=Decimal("12450.0000"),
                billing_start=date(2026, 4, 1), billing_end=date(2026, 4, 30), tariff="Commercial Industrial",
                calculated_emissions_co2e=Decimal("10209.0000"), # 12450 * 0.82
                calculation_details={"formula": "Electricity Consumption (kWh) * Emission Factor (kg CO2e/kWh)", "kwh": 12450.0, "factor": 0.82}
            )
            ReviewRecord.objects.create(
                tenant=eco_corp, normalized_record=nu1, validation_status="VALID",
                validation_errors=[], review_status="APPROVED", approved_by=ec_admin, approved_at=timezone.now() - timedelta(days=2), is_locked=True
            )

            # Utility Row 2: Failed Negative Electricity
            raw_ut_2 = RawRecord.objects.create(
                tenant=eco_corp, upload_batch=utility_batch, row_index=2,
                row_data={"meter_id": "MTR-10029", "kwh": "-230", "billing_start": "01.05.2026", "billing_end": "20.05.2026", "tariff": "Commercial Industrial"},
                status="PROCESSED"
            )
            nu2 = NormalizedRecord.objects.create(
                tenant=eco_corp, raw_record=raw_ut_2, upload_batch=utility_batch,
                source_type="UTILITY", scope="Scope 2", record_date=date(2026, 5, 20),
                meter_id="MTR-10029", electricity_kwh=Decimal("-230.0000"),
                billing_start=date(2026, 5, 1), billing_end=date(2026, 5, 20), tariff="Commercial Industrial",
                calculated_emissions_co2e=Decimal("-188.6000"),
                calculation_details={"formula": "Electricity Consumption (kWh) * Emission Factor (kg CO2e/kWh)", "kwh": -230.0, "factor": 0.82}
            )
            ReviewRecord.objects.create(
                tenant=eco_corp, normalized_record=nu2, validation_status="FAILED",
                validation_errors=["Electricity usage (kWh) cannot be negative"], review_status="PENDING"
            )


            # --- BATCH 3: TRAVEL DATA (Scope 3) ---
            travel_batch = UploadBatch.objects.create(
                tenant=eco_corp,
                source_type="TRAVEL",
                uploaded_by=ec_analyst,
                file_name="CONCUR_TRAVEL_MAY.csv",
                status="SUCCESS"
            )

            # Travel Row 1: Flight JFK -> FRA (Missing distance, calculated automatically via haversine)
            # JFK: (40.6413, -73.7781), FRA: (50.0379, 8.5622) -> ~6200 km -> 6200 * 0.15 = 930 kg CO2e
            raw_tr_1 = RawRecord.objects.create(
                tenant=eco_corp, upload_batch=travel_batch, row_index=1,
                row_data={"employee_id": "EMP-4993", "travel_type": "Flight", "origin_airport": "JFK", "destination_airport": "FRA", "travel_date": "10.05.2026", "distance_km": ""},
                status="PROCESSED"
            )
            nt1 = NormalizedRecord.objects.create(
                tenant=eco_corp, raw_record=raw_tr_1, upload_batch=travel_batch,
                source_type="TRAVEL", scope="Scope 3", record_date=date(2026, 5, 10),
                employee_id="EMP-4993", travel_type="Flight", origin_airport="JFK", destination_airport="FRA",
                distance_km=Decimal("6201.24"),
                calculated_emissions_co2e=Decimal("930.19"), # 6201.24 * 0.15
                calculation_details={
                    "formula": "Distance (km) * Travel Emission Factor (kg CO2e/km)",
                    "distance": 6201.24, "factor": 0.15, "calculated_from_airport_lookup": True,
                    "airport_coordinates": {"origin": [40.6413, -73.7781], "destination": [50.0379, 8.5622]}
                }
            )
            ReviewRecord.objects.create(
                tenant=eco_corp, normalized_record=nt1, validation_status="VALID",
                validation_errors=[], review_status="PENDING"
            )

            # Travel Row 2: Taxi with long distance (Suspicious)
            raw_tr_2 = RawRecord.objects.create(
                tenant=eco_corp, upload_batch=travel_batch, row_index=2,
                row_data={"employee_id": "EMP-3882", "travel_type": "Taxi", "origin_airport": "FRA", "destination_airport": "FRA", "travel_date": "12.05.2026", "distance_km": "1150"},
                status="PROCESSED"
            )
            nt2 = NormalizedRecord.objects.create(
                tenant=eco_corp, raw_record=raw_tr_2, upload_batch=travel_batch,
                source_type="TRAVEL", scope="Scope 3", record_date=date(2026, 5, 12),
                employee_id="EMP-3882", travel_type="Taxi", origin_airport="FRA", destination_airport="FRA",
                distance_km=Decimal("1150.00"),
                calculated_emissions_co2e=Decimal("207.00"), # 1150 * 0.18
                calculation_details={"formula": "Distance (km) * Travel Emission Factor (kg CO2e/km)", "distance": 1150.0, "factor": 0.18}
            )
            ReviewRecord.objects.create(
                tenant=eco_corp, normalized_record=nt2, validation_status="SUSPICIOUS",
                validation_errors=["Suspicious long distance for taxi travel: 1150.0 km"], review_status="CORRECTION", review_notes="Is the distance input correct? 1150 km taxi ride seems excessive."
            )

            # 8. Create some Audit Logs
            AuditLog.objects.create(
                tenant=eco_corp, user=ec_analyst, action="UPLOAD_BATCH",
                record_type="UploadBatch", record_id=sap_batch.id,
                new_value={"file_name": "SAP_FUELS_MAY2026.csv", "rows_processed": 4, "rows_failed": 0}
            )
            AuditLog.objects.create(
                tenant=eco_corp, user=ec_analyst, action="UPLOAD_BATCH",
                record_type="UploadBatch", record_id=utility_batch.id,
                new_value={"file_name": "UTILITY_PORTAL_Q1.csv", "rows_processed": 2, "rows_failed": 0}
            )
            AuditLog.objects.create(
                tenant=eco_corp, user=ec_admin, action="RECORD_APPROVE",
                record_type="ReviewRecord", record_id=ns1.id,
                new_value={"review_status": "APPROVED", "approved_by": "admin@ecocorp.com"}
            )
            AuditLog.objects.create(
                tenant=eco_corp, user=ec_admin, action="RECORD_LOCK",
                record_type="ReviewRecord", record_id=nu1.review_details.id,
                new_value={"is_locked": True}
            )

        self.stdout.write(self.style.SUCCESS("Database seeding completed successfully!"))
