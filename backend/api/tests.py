from django.test import TestCase
from decimal import Decimal
from datetime import date
from django.contrib.auth import get_user_model
from api.models import (
    Tenant, PlantCode, AirportCode, UploadBatch, RawRecord, 
    NormalizedRecord, ReviewRecord
)
from api.services import (
    parse_date, calculate_haversine,
    normalize_and_validate_sap,
    normalize_and_validate_utility,
    normalize_and_validate_travel
)

User = get_user_model()

class NormalizationEngineTestCase(TestCase):
    def setUp(self):
        # Create Tenant
        self.tenant = Tenant.objects.create(name="Test Corp")
        
        # Create User
        self.user = User.objects.create_user(
            username="analyst@test.com",
            email="analyst@test.com",
            password="password123",
            tenant=self.tenant,
            role="ANALYST"
        )
        
        # Seed Plant Code
        self.plant = PlantCode.objects.create(
            tenant=self.tenant,
            code="PL01",
            name="Hamburg Site"
        )
        
        # Seed Airport Codes
        self.jfk = AirportCode.objects.create(
            code="JFK", name="JFK Airport", city="New York", country="USA",
            latitude=Decimal("40.6413"), longitude=Decimal("-73.7781")
        )
        self.fra = AirportCode.objects.create(
            code="FRA", name="Frankfurt Airport", city="Frankfurt", country="Germany",
            latitude=Decimal("50.0379"), longitude=Decimal("8.5622")
        )
        
        # Create Batch
        self.batch = UploadBatch.objects.create(
            tenant=self.tenant,
            source_type="SAP",
            uploaded_by=self.user,
            file_name="test_upload.csv",
            status="PENDING"
        )

    def test_parse_date(self):
        # German
        self.assertEqual(parse_date("24.05.2026"), date(2026, 5, 24))
        # ISO
        self.assertEqual(parse_date("2026-05-24"), date(2026, 5, 24))
        # Slash format
        self.assertEqual(parse_date("24/05/2026"), date(2026, 5, 24))
        # Invalid
        self.assertIsNone(parse_date("invalid-date"))

    def test_haversine_calculation(self):
        # JFK to FRA distance should be roughly 6200 km
        dist = calculate_haversine(
            self.jfk.latitude, self.jfk.longitude,
            self.fra.latitude, self.fra.longitude
        )
        self.assertGreater(dist, 6100)
        self.assertLess(dist, 6300)

    def test_sap_normalization_valid(self):
        raw = RawRecord.objects.create(
            tenant=self.tenant, upload_batch=self.batch, row_index=1,
            row_data={"WERK": "PL01", "KRAFTSTOFF": "Diesel", "MENGE": "500", "EINHEIT": "L", "DATUM": "24.05.2026"}
        )
        
        norm = normalize_and_validate_sap(self.tenant, raw.row_data, raw, self.batch)
        
        self.assertEqual(norm.plant_code, "PL01")
        self.assertEqual(norm.fuel_type, "Diesel")
        self.assertEqual(norm.fuel_qty, Decimal("500"))
        self.assertEqual(norm.fuel_unit, "L")
        self.assertEqual(norm.record_date, date(2026, 5, 24))
        # Emissions: 500 * 2.68 = 1340.00
        self.assertEqual(norm.calculated_emissions_co2e, Decimal("1340.0000"))
        
        # Check Review status
        review = norm.review_details
        self.assertEqual(review.validation_status, "VALID")
        self.assertEqual(len(review.validation_errors), 0)

    def test_sap_normalization_gallons_and_unknown_plant(self):
        # 100 gallons = 378.541 liters -> Petrol factor = 2.31
        raw = RawRecord.objects.create(
            tenant=self.tenant, upload_batch=self.batch, row_index=2,
            row_data={"WERK": "UNKNOWN_PL", "KRAFTSTOFF": "Petrol", "MENGE": "100", "EINHEIT": "gal", "DATUM": "24.05.2026"}
        )
        
        norm = normalize_and_validate_sap(self.tenant, raw.row_data, raw, self.batch)
        self.assertAlmostEqual(norm.fuel_qty, Decimal("378.541"), places=3)
        self.assertEqual(norm.fuel_unit, "L")
        
        review = norm.review_details
        self.assertEqual(review.validation_status, "SUSPICIOUS")
        self.assertTrue(any("Unknown plant code" in err for err in review.validation_errors))

    def test_utility_normalization_negative_and_spike(self):
        # Negative kwh should fail
        raw_neg = RawRecord.objects.create(
            tenant=self.tenant, upload_batch=self.batch, row_index=3,
            row_data={"meter_id": "MTR1", "kwh": "-10", "billing_start": "2026-05-01", "billing_end": "2026-05-31"}
        )
        norm_neg = normalize_and_validate_utility(self.tenant, raw_neg.row_data, raw_neg, self.batch)
        self.assertEqual(norm_neg.review_details.validation_status, "FAILED")
        
        # Large spike should be suspicious
        raw_spike = RawRecord.objects.create(
            tenant=self.tenant, upload_batch=self.batch, row_index=4,
            row_data={"meter_id": "MTR1", "kwh": "95000", "billing_start": "2026-05-01", "billing_end": "2026-05-31"}
        )
        norm_spike = normalize_and_validate_utility(self.tenant, raw_spike.row_data, raw_spike, self.batch)
        self.assertEqual(norm_spike.review_details.validation_status, "SUSPICIOUS")

    def test_travel_distance_lookup(self):
        # Missing distance, should compute JFK -> FRA via lookup
        raw = RawRecord.objects.create(
            tenant=self.tenant, upload_batch=self.batch, row_index=5,
            row_data={"employee_id": "E1", "travel_type": "Flight", "origin_airport": "JFK", "destination_airport": "FRA", "travel_date": "2026-05-24", "distance_km": ""}
        )
        norm = normalize_and_validate_travel(self.tenant, raw.row_data, raw, self.batch)
        self.assertGreater(norm.distance_km, Decimal("6100"))
        # Check Scope 3 Flight calculation (0.15 kg/km)
        self.assertAlmostEqual(norm.calculated_emissions_co2e, norm.distance_km * Decimal("0.15"), places=2)
