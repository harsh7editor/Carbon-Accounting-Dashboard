from django.db import models
from django.contrib.auth.models import AbstractUser
from django.conf import settings

class Tenant(models.Model):
    name = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class CustomUser(AbstractUser):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, null=True, blank=True, related_name='users')
    role = models.CharField(max_length=50, choices=[('ADMIN', 'Admin'), ('ANALYST', 'Analyst')], default='ANALYST')

    def __str__(self):
        return f"{self.username} ({self.tenant.name if self.tenant else 'Global'})"

class PlantCode(models.Model):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='plants')
    code = models.CharField(max_length=100)
    name = models.CharField(max_length=255)
    location = models.CharField(max_length=255, blank=True)

    class Meta:
        unique_together = ('tenant', 'code')

    def __str__(self):
        return f"{self.code} - {self.name} ({self.tenant.name})"

class AirportCode(models.Model):
    # Global lookup or tenant specific (we keep it global for airport definitions, but allow querying)
    code = models.CharField(max_length=10, unique=True) # e.g. JFK, LHR, FRA
    name = models.CharField(max_length=255)
    city = models.CharField(max_length=255)
    country = models.CharField(max_length=255)
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)

    def __str__(self):
        return f"{self.code} - {self.name}"

class DataSource(models.Model):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='data_sources')
    name = models.CharField(max_length=255)
    source_type = models.CharField(max_length=50, choices=[('SAP', 'SAP Fuel Data'), ('UTILITY', 'Utility Electricity Data'), ('TRAVEL', 'Corporate Travel')])
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('tenant', 'name')

    def __str__(self):
        return f"{self.name} ({self.source_type})"

class UploadBatch(models.Model):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='upload_batches')
    source_type = models.CharField(max_length=50)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='uploaded_batches')
    uploaded_at = models.DateTimeField(auto_now_add=True)
    file_name = models.CharField(max_length=255)
    status = models.CharField(max_length=50, choices=[('PENDING', 'Pending'), ('SUCCESS', 'Success'), ('FAILED', 'Failed')], default='PENDING')

    def __str__(self):
        return f"Batch {self.id} - {self.file_name} ({self.uploaded_at})"

class RawRecord(models.Model):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='raw_records')
    upload_batch = models.ForeignKey(UploadBatch, on_delete=models.CASCADE, related_name='raw_records')
    row_index = models.IntegerField()
    row_data = models.JSONField() # JSON object storing original row values
    status = models.CharField(max_length=50, choices=[('PENDING', 'Pending'), ('PROCESSED', 'Processed'), ('ERROR', 'Error')], default='PENDING')

    def __str__(self):
        return f"Raw {self.id} in Batch {self.upload_batch.id} [Row {self.row_index}]"

class SoftDeleteManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False)

class NormalizedRecord(models.Model):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='normalized_records')
    raw_record = models.ForeignKey(RawRecord, on_delete=models.CASCADE, null=True, blank=True, related_name='normalized_records')
    upload_batch = models.ForeignKey(UploadBatch, on_delete=models.CASCADE, related_name='normalized_records')
    source_type = models.CharField(max_length=50) # SAP, UTILITY, TRAVEL
    scope = models.CharField(max_length=10) # Scope 1, Scope 2, Scope 3
    record_date = models.DateField(null=True)
    
    # Unified Normalized Fields
    plant_code = models.CharField(max_length=100, blank=True, null=True)
    meter_id = models.CharField(max_length=100, blank=True, null=True)
    employee_id = models.CharField(max_length=100, blank=True, null=True)
    
    fuel_type = models.CharField(max_length=100, blank=True, null=True) # Diesel, Petrol
    fuel_qty = models.DecimalField(max_digits=15, decimal_places=4, null=True, blank=True)
    fuel_unit = models.CharField(max_length=50, blank=True, null=True) # Standard unit: L
    
    electricity_kwh = models.DecimalField(max_digits=15, decimal_places=4, null=True, blank=True)
    billing_start = models.DateField(null=True, blank=True)
    billing_end = models.DateField(null=True, blank=True)
    tariff = models.CharField(max_length=100, blank=True, null=True)
    
    travel_type = models.CharField(max_length=100, blank=True, null=True) # Flight, Hotel, Taxi, Rail
    origin_airport = models.CharField(max_length=10, blank=True, null=True)
    destination_airport = models.CharField(max_length=10, blank=True, null=True)
    distance_km = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    
    calculated_emissions_co2e = models.DecimalField(max_digits=15, decimal_places=4, default=0.0) # In kg CO2e
    calculation_details = models.JSONField(default=dict) # Details of formula and factors used
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_modified_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='modified_records')
    
    is_deleted = models.BooleanField(default=False)

    objects = SoftDeleteManager()
    all_objects = models.Manager()

    def __str__(self):
        return f"Normalized {self.id} ({self.source_type}) - {self.calculated_emissions_co2e} kg CO2e"

class ReviewRecord(models.Model):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='review_records')
    normalized_record = models.OneToOneField(NormalizedRecord, on_delete=models.CASCADE, related_name='review_details')
    
    validation_status = models.CharField(max_length=50, choices=[('VALID', 'Valid'), ('SUSPICIOUS', 'Suspicious'), ('FAILED', 'Failed')], default='VALID')
    validation_errors = models.JSONField(default=list) # List of validation issue descriptions
    
    review_status = models.CharField(max_length=50, choices=[('PENDING', 'Pending Review'), ('APPROVED', 'Approved'), ('REJECTED', 'Rejected'), ('CORRECTION', 'Correction Requested')], default='PENDING')
    review_notes = models.TextField(blank=True, null=True)
    
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_records')
    approved_at = models.DateTimeField(null=True, blank=True)
    
    is_locked = models.BooleanField(default=False) # Audit lock
    
    is_deleted = models.BooleanField(default=False)

    objects = SoftDeleteManager()
    all_objects = models.Manager()

    def __str__(self):
        return f"Review {self.id} for Normalized {self.normalized_record.id} [Status: {self.review_status}]"

class AuditLog(models.Model):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='audit_logs')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='audit_logs')
    action = models.CharField(max_length=100) # UPLOAD_BATCH, RECORD_EDIT, RECORD_APPROVE, RECORD_REJECT, RECORD_LOCK, RECORD_CORRECTION, RECORD_DELETE
    timestamp = models.DateTimeField(auto_now_add=True)
    
    record_type = models.CharField(max_length=100) # e.g. UploadBatch, NormalizedRecord, ReviewRecord
    record_id = models.IntegerField()
    
    old_value = models.JSONField(null=True, blank=True)
    new_value = models.JSONField(null=True, blank=True)

    def __str__(self):
        return f"Audit {self.id} - {self.action} by {self.user.username if self.user else 'System'} at {self.timestamp}"
