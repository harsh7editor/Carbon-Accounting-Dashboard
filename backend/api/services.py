import csv
import io
import re
import math
from datetime import datetime
from decimal import Decimal
from django.db import transaction
from .models import (
    Tenant, UploadBatch, RawRecord, NormalizedRecord, 
    ReviewRecord, PlantCode, AirportCode, AuditLog
)

# Great-circle distance using Haversine formula
def calculate_haversine(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(float, [lat1, lon1, lat2, lon2])
    R = 6371.0  # Earth radius in kilometers
    
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    
    a = (math.sin(d_lat / 2) ** 2 + 
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c

def parse_date(date_str):
    """Normalize date strings into a Python date object."""
    if not date_str:
        return None
    
    # Try different formats
    formats = [
        '%d.%m.%Y',  # German 24.05.2026
        '%Y-%m-%d',  # ISO
        '%m/%d/%Y',  # US
        '%d/%m/%Y',  # UK/EU
        '%Y/%m/%d'
    ]
    
    date_str = date_str.strip()
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt).date()
        except ValueError:
            continue
            
    # Try parsing digits if formats fail
    match = re.match(r'(\d{1,2})[./-](\d{1,2})[./-](\d{4})', date_str)
    if match:
        # Check if German or US - we default to German since SAP export uses German
        try:
            d, m, y = map(int, match.groups())
            return datetime(y, m, d).date()
        except ValueError:
            try:
                m, d, y = map(int, match.groups())
                return datetime(y, m, d).date()
            except ValueError:
                pass
                
    return None

def normalize_and_validate_sap(tenant, row, raw_record, upload_batch):
    """
    SAP Columns: WERK, KRAFTSTOFF, MENGE, EINHEIT, DATUM
    """
    original = row
    
    # 1. Column Normalization
    werk = row.get('WERK', '').strip()
    kraftstoff = row.get('KRAFTSTOFF', '').strip()
    menge_str = row.get('MENGE', '').strip()
    einheit = row.get('EINHEIT', '').strip()
    datum_str = row.get('DATUM', '').strip()
    
    validation_errors = []
    validation_status = 'VALID'
    
    # 2. Date normalization
    record_date = parse_date(datum_str)
    if not record_date:
        validation_status = 'FAILED'
        validation_errors.append(f"Invalid date format for '{datum_str}' (Expected DD.MM.YYYY or YYYY-MM-DD)")
        
    # 3. Quantity & Unit normalization
    try:
        fuel_qty = Decimal(menge_str.replace(',', '.')) # Support German decimal formatting
    except Exception:
        fuel_qty = Decimal('0')
        validation_status = 'FAILED'
        validation_errors.append(f"Invalid fuel quantity value: '{menge_str}'")

    # Normalize units: L (Liters) is standard. Gallons (gal) converted.
    normalized_qty = fuel_qty
    normalized_unit = 'L'
    unit_upper = einheit.upper()
    
    if unit_upper in ['GAL', 'GALLON', 'GALLONS']:
        # 1 Gallon = 3.78541 Liters
        normalized_qty = fuel_qty * Decimal('3.78541')
        normalized_unit = 'L'
    elif unit_upper in ['L', 'LITER', 'LITERS', 'LITRE', 'LITRES']:
        normalized_qty = fuel_qty
        normalized_unit = 'L'
    else:
        validation_status = 'FAILED'
        validation_errors.append(f"Unknown unit of measure: '{einheit}'")

    # 4. Plant lookup
    plant_exists = PlantCode.objects.filter(tenant=tenant, code=werk).exists()
    if not plant_exists:
        if validation_status != 'FAILED':
            validation_status = 'SUSPICIOUS'
        validation_errors.append(f"Unknown plant code '{werk}' (Not found in lookup table)")

    # 5. Validation rules
    if normalized_qty < 0:
        validation_status = 'FAILED'
        validation_errors.append("Fuel quantity cannot be negative")
    elif normalized_qty > 100000:
        if validation_status != 'FAILED':
            validation_status = 'SUSPICIOUS'
        validation_errors.append(f"Abnormally large fuel quantity detected: {normalized_qty} L")

    # 6. Emissions calculations
    # Diesel = 2.68 kg CO2e/L, Petrol = 2.31 kg CO2e/L
    fuel_upper = kraftstoff.upper()
    emission_factor = Decimal('0')
    factor_name = "Unknown Fuel Factor"
    
    if 'DIESEL' in fuel_upper:
        emission_factor = Decimal('2.68')
        factor_name = "Diesel Ingestion Factor (2.68 kg CO2e/L)"
    elif 'PETROL' in fuel_upper or 'BENZIN' in fuel_upper:
        emission_factor = Decimal('2.31')
        factor_name = "Petrol Ingestion Factor (2.31 kg CO2e/L)"
    else:
        if validation_status != 'FAILED':
            validation_status = 'SUSPICIOUS'
        validation_errors.append(f"Unknown fuel type '{kraftstoff}', unable to calculate precise emissions factor")
        emission_factor = Decimal('0')
    
    emissions = normalized_qty * emission_factor
    calc_details = {
        "formula": "Quantity (L) * Emission Factor (kg CO2e/L)",
        "quantity": float(normalized_qty),
        "factor": float(emission_factor),
        "factor_name": factor_name,
        "original_quantity": float(fuel_qty),
        "original_unit": einheit
    }

    # Save Normalized Record
    norm_rec = NormalizedRecord.objects.create(
        tenant=tenant,
        raw_record=raw_record,
        upload_batch=upload_batch,
        source_type='SAP',
        scope='Scope 1',
        record_date=record_date,
        plant_code=werk,
        fuel_type=kraftstoff,
        fuel_qty=normalized_qty,
        fuel_unit=normalized_unit,
        calculated_emissions_co2e=emissions,
        calculation_details=calc_details
    )

    # Save Review Record
    ReviewRecord.objects.create(
        tenant=tenant,
        normalized_record=norm_rec,
        validation_status=validation_status,
        validation_errors=validation_errors,
        review_status='PENDING'
    )
    
    return norm_rec

def normalize_and_validate_utility(tenant, row, raw_record, upload_batch):
    """
    Utility Columns: meter_id, kwh, billing_start, billing_end, tariff
    """
    meter_id = row.get('meter_id', '').strip()
    kwh_str = row.get('kwh', '').strip()
    billing_start_str = row.get('billing_start', '').strip()
    billing_end_str = row.get('billing_end', '').strip()
    tariff = row.get('tariff', '').strip()
    
    validation_errors = []
    validation_status = 'VALID'
    
    # Dates
    start_date = parse_date(billing_start_str)
    end_date = parse_date(billing_end_str)
    
    if not start_date or not end_date:
        validation_status = 'FAILED'
        validation_errors.append(f"Invalid billing start/end dates: '{billing_start_str}' to '{billing_end_str}'")
    
    # kWh check
    try:
        kwh = Decimal(kwh_str.replace(',', '.'))
    except Exception:
        kwh = Decimal('0')
        validation_status = 'FAILED'
        validation_errors.append(f"Invalid kWh usage value: '{kwh_str}'")

    if kwh < 0:
        validation_status = 'FAILED'
        validation_errors.append("Electricity usage (kWh) cannot be negative")
    elif kwh > 50000:
        if validation_status != 'FAILED':
            validation_status = 'SUSPICIOUS'
        validation_errors.append(f"Abnormal electricity consumption spike detected: {kwh} kWh")

    # Date spanning validation
    if start_date and end_date:
        delta = end_date - start_date
        if delta.days < 0:
            validation_status = 'FAILED'
            validation_errors.append(f"Billing end date ({end_date}) is before billing start date ({start_date})")
        elif delta.days > 35:
            if validation_status != 'FAILED':
                validation_status = 'SUSPICIOUS'
            validation_errors.append(f"Billing period spans abnormal duration: {delta.days} days")

    # Scope 2 Emissions calculations
    # Electricity = 0.82 kg CO2e/kWh
    factor = Decimal('0.82')
    emissions = kwh * factor
    calc_details = {
        "formula": "Electricity Consumption (kWh) * Emission Factor (kg CO2e/kWh)",
        "kwh": float(kwh),
        "factor": float(factor),
        "factor_name": "Grid Electricity Emission Factor (0.82 kg CO2e/kWh)"
    }

    norm_rec = NormalizedRecord.objects.create(
        tenant=tenant,
        raw_record=raw_record,
        upload_batch=upload_batch,
        source_type='UTILITY',
        scope='Scope 2',
        record_date=end_date if end_date else start_date, # Use end of billing cycle as record date
        meter_id=meter_id,
        electricity_kwh=kwh,
        billing_start=start_date,
        billing_end=end_date,
        tariff=tariff,
        calculated_emissions_co2e=emissions,
        calculation_details=calc_details
    )

    ReviewRecord.objects.create(
        tenant=tenant,
        normalized_record=norm_rec,
        validation_status=validation_status,
        validation_errors=validation_errors,
        review_status='PENDING'
    )
    
    return norm_rec

def normalize_and_validate_travel(tenant, row, raw_record, upload_batch):
    """
    Travel Columns: employee_id, travel_type, origin_airport, destination_airport, travel_date, distance_km
    """
    employee_id = row.get('employee_id', '').strip()
    travel_type = row.get('travel_type', '').strip()
    origin_airport = row.get('origin_airport', '').strip().upper()
    destination_airport = row.get('destination_airport', '').strip().upper()
    travel_date_str = row.get('travel_date', '').strip()
    distance_str = row.get('distance_km', '').strip()
    
    validation_errors = []
    validation_status = 'VALID'
    
    # Date
    record_date = parse_date(travel_date_str)
    if not record_date:
        validation_status = 'FAILED'
        validation_errors.append(f"Invalid travel date: '{travel_date_str}'")

    # Airport lookup validation
    origin_obj = None
    dest_obj = None
    
    if origin_airport:
        try:
            origin_obj = AirportCode.objects.get(code=origin_airport)
        except AirportCode.DoesNotExist:
            validation_errors.append(f"Origin airport code '{origin_airport}' not found in database")
            if validation_status != 'FAILED':
                validation_status = 'SUSPICIOUS'
    else:
        validation_errors.append("Origin airport code is missing")
        validation_status = 'FAILED'

    if destination_airport:
        try:
            dest_obj = AirportCode.objects.get(code=destination_airport)
        except AirportCode.DoesNotExist:
            validation_errors.append(f"Destination airport code '{destination_airport}' not found in database")
            if validation_status != 'FAILED':
                validation_status = 'SUSPICIOUS'
    else:
        validation_errors.append("Destination airport code is missing")
        validation_status = 'FAILED'

    # Distance calculation & verification
    distance = None
    calc_from_airports = False
    
    if distance_str:
        try:
            distance = Decimal(distance_str.replace(',', '.'))
        except Exception:
            validation_errors.append(f"Invalid distance value: '{distance_str}'")
            validation_status = 'FAILED'
            
    if (distance is None or distance <= 0) and origin_obj and dest_obj:
        # Distance is missing or invalid, calculate using airports
        try:
            calculated_dist = calculate_haversine(
                origin_obj.latitude, origin_obj.longitude,
                dest_obj.latitude, dest_obj.longitude
            )
            distance = Decimal(str(round(calculated_dist, 2)))
            calc_from_airports = True
        except Exception as e:
            validation_errors.append(f"Failed to calculate distance from airports: {str(e)}")
            validation_status = 'FAILED'

    if distance is None:
        validation_errors.append("Distance is missing and cannot be calculated due to missing airport coordinates")
        validation_status = 'FAILED'
        distance = Decimal('0')
    else:
        if distance < 0:
            validation_status = 'FAILED'
            validation_errors.append("Travel distance cannot be negative")
        elif distance > 20000: # Half the Earth
            if validation_status != 'FAILED':
                validation_status = 'SUSPICIOUS'
            validation_errors.append(f"Impossible travel distance detected: {distance} km")
        elif distance > 1000 and travel_type.upper() in ['TAXI', 'CAB']:
            if validation_status != 'FAILED':
                validation_status = 'SUSPICIOUS'
            validation_errors.append(f"Suspicious long distance for taxi travel: {distance} km")

    # Scope 3 Emissions calculations
    # Flight = 0.15 kg CO2e/km
    # Let's map travel type and set factors:
    # Rail = 0.04 kg/km, Taxi = 0.18 kg/km, Hotel = 0 kg/km (not distance-based)
    travel_type_upper = travel_type.upper()
    factor = Decimal('0')
    factor_name = "No distance factor"
    
    if 'FLIGHT' in travel_type_upper or 'AIR' in travel_type_upper:
        factor = Decimal('0.15')
        factor_name = "Flight Ingestion Factor (0.15 kg CO2e/km)"
    elif 'RAIL' in travel_type_upper or 'TRAIN' in travel_type_upper:
        factor = Decimal('0.04')
        factor_name = "Rail Ingestion Factor (0.04 kg CO2e/km)"
    elif 'TAXI' in travel_type_upper or 'CAB' in travel_type_upper or 'CAR' in travel_type_upper:
        factor = Decimal('0.18')
        factor_name = "Taxi/Car Ingestion Factor (0.18 kg CO2e/km)"
    elif 'HOTEL' in travel_type_upper:
        # Hotel is usually per night, but we'll assign standard placeholder or 0 distance emissions
        factor = Decimal('0')
        factor_name = "Hotel Stay (0 kg CO2e/km - requires per-night calculation)"
    else:
        factor = Decimal('0.05')
        factor_name = "Generic Travel Factor (0.05 kg CO2e/km)"
        
    emissions = distance * factor
    calc_details = {
        "formula": "Distance (km) * Travel Emission Factor (kg CO2e/km)",
        "distance": float(distance),
        "factor": float(factor),
        "factor_name": factor_name,
        "calculated_from_airport_lookup": calc_from_airports
    }
    
    if calc_from_airports and origin_obj and dest_obj:
        calc_details["airport_coordinates"] = {
            "origin": [float(origin_obj.latitude), float(origin_obj.longitude)],
            "destination": [float(dest_obj.latitude), float(dest_obj.longitude)]
        }

    norm_rec = NormalizedRecord.objects.create(
        tenant=tenant,
        raw_record=raw_record,
        upload_batch=upload_batch,
        source_type='TRAVEL',
        scope='Scope 3',
        record_date=record_date,
        employee_id=employee_id,
        travel_type=travel_type,
        origin_airport=origin_airport,
        destination_airport=destination_airport,
        distance_km=distance,
        calculated_emissions_co2e=emissions,
        calculation_details=calc_details
    )

    ReviewRecord.objects.create(
        tenant=tenant,
        normalized_record=norm_rec,
        validation_status=validation_status,
        validation_errors=validation_errors,
        review_status='PENDING'
    )
    
    return norm_rec

def process_csv_upload(upload_batch, file_content_str):
    """
    Parses the CSV content string, creates RawRecord objects, and runs normalization and validation services.
    """
    tenant = upload_batch.tenant
    source_type = upload_batch.source_type
    
    # Use StringIO and CSV DictReader
    f = io.StringIO(file_content_str.strip())
    # Detect delimiter
    first_line = f.readline()
    f.seek(0)
    delimiter = ';' if ';' in first_line else ','
    
    reader = csv.DictReader(f, delimiter=delimiter)
    
    success_count = 0
    failed_count = 0
    
    with transaction.atomic():
        for i, row in enumerate(reader, start=1):
            raw_record = RawRecord.objects.create(
                tenant=tenant,
                upload_batch=upload_batch,
                row_index=i,
                row_data=row,
                status='PENDING'
            )
            
            try:
                if source_type == 'SAP':
                    normalize_and_validate_sap(tenant, row, raw_record, upload_batch)
                elif source_type == 'UTILITY':
                    normalize_and_validate_utility(tenant, row, raw_record, upload_batch)
                elif source_type == 'TRAVEL':
                    normalize_and_validate_travel(tenant, row, raw_record, upload_batch)
                else:
                    raise ValueError(f"Unknown source type: {source_type}")
                
                raw_record.status = 'PROCESSED'
                raw_record.save()
                success_count += 1
            except Exception as e:
                import traceback
                print(f"Error processing row {i}: {str(e)}")
                traceback.print_exc()
                raw_record.status = 'ERROR'
                raw_record.save()
                failed_count += 1
                
        # If any rows failed, we don't necessarily abort, we just record progress
        if failed_count > 0 and success_count == 0:
            upload_batch.status = 'FAILED'
        else:
            upload_batch.status = 'SUCCESS'
        upload_batch.save()
        
        # Log audit action
        AuditLog.objects.create(
            tenant=tenant,
            user=upload_batch.uploaded_by,
            action='UPLOAD_BATCH',
            record_type='UploadBatch',
            record_id=upload_batch.id,
            new_value={
                "file_name": upload_batch.file_name,
                "source_type": upload_batch.source_type,
                "rows_processed": success_count,
                "rows_failed": failed_count
            }
        )

    return success_count, failed_count
