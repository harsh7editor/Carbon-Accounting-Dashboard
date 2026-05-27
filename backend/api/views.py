from rest_framework import viewsets, permissions, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Sum, Count
from django.db.models.functions import TruncMonth
from django.utils import timezone
from datetime import datetime, date
from decimal import Decimal
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import (
    Tenant, PlantCode, AirportCode, DataSource, 
    UploadBatch, RawRecord, NormalizedRecord, ReviewRecord, AuditLog
)
from .serializers import (
    TenantSerializer, CustomUserSerializer, RegisterSerializer, PlantCodeSerializer, 
    AirportCodeSerializer, DataSourceSerializer, UploadBatchSerializer, 
    RawRecordSerializer, NormalizedRecordSerializer, ReviewRecordSerializer, 
    AuditLogSerializer
)
from .services import process_csv_upload
from .tasks import process_csv_upload_task

User = get_user_model()

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['username'] = user.username
        token['role'] = user.role
        token['tenant_id'] = user.tenant.id if user.tenant else None
        token['tenant_name'] = user.tenant.name if user.tenant else 'Global'
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data['user'] = CustomUserSerializer(self.user).data
        return data

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = CustomTokenObtainPairSerializer.get_token(user)
        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user': CustomUserSerializer(user).data,
        }, status=status.HTTP_201_CREATED)


class PublicTenantListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        tenants = Tenant.objects.all().order_by('name')
        return Response([{'id': t.id, 'name': t.name} for t in tenants])


class TenantViewSet(viewsets.ModelViewSet):
    queryset = Tenant.objects.all()
    serializer_class = TenantSerializer
    permission_classes = [permissions.IsAdminUser]

class CustomUserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = CustomUserSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_anonymous:
            return User.objects.none()
        if user.tenant is None:
            return User.objects.all()
        return User.objects.filter(tenant=user.tenant)

    @action(detail=False, methods=['GET'])
    def me(self, request):
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)

class PlantCodeViewSet(viewsets.ModelViewSet):
    queryset = PlantCode.objects.all()
    serializer_class = PlantCodeSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['code', 'name', 'location']

    def get_queryset(self):
        user = self.request.user
        if user.is_anonymous:
            return PlantCode.objects.none()
        if user.tenant is None:
            return PlantCode.objects.all()
        return PlantCode.objects.filter(tenant=user.tenant)

class AirportCodeViewSet(viewsets.ModelViewSet):
    queryset = AirportCode.objects.all()
    serializer_class = AirportCodeSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = ['code', 'name', 'city', 'country']

class DataSourceViewSet(viewsets.ModelViewSet):
    queryset = DataSource.objects.all()
    serializer_class = DataSourceSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_anonymous:
            return DataSource.objects.none()
        if user.tenant is None:
            return DataSource.objects.all()
        return DataSource.objects.filter(tenant=user.tenant)

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant)

class UploadBatchViewSet(viewsets.ModelViewSet):
    queryset = UploadBatch.objects.all()
    serializer_class = UploadBatchSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_anonymous:
            return UploadBatch.objects.none()
        if user.tenant is None:
            return UploadBatch.objects.all()
        return UploadBatch.objects.filter(tenant=user.tenant)

    @action(detail=False, methods=['POST'])
    def upload_file(self, request):
        tenant = request.user.tenant
        if not tenant:
            return Response({"error": "User does not belong to any tenant"}, status=status.HTTP_400_BAD_REQUEST)
        
        file_obj = request.FILES.get('file')
        source_type = request.data.get('source_type')
        
        if not file_obj or not source_type:
            return Response({"error": "File and source_type are required"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Read the file content
        try:
            file_content = file_obj.read().decode('utf-8')
        except Exception:
            try:
                # Fallback to latin-1
                file_content = file_obj.read().decode('latin-1')
            except Exception as e:
                return Response({"error": f"Failed to decode file: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

        # Create batch
        batch = UploadBatch.objects.create(
            tenant=tenant,
            source_type=source_type,
            uploaded_by=request.user,
            file_name=file_obj.name,
            status='PENDING'
        )

        # Enqueue processing to Celery worker for asynchronous handling
        try:
            process_csv_upload_task.delay(batch.id, file_content)
        except Exception:
            # Fallback to synchronous processing if Celery isn't available
            success, failed = process_csv_upload(batch, file_content)
            return Response({
                "batch_id": batch.id,
                "file_name": batch.file_name,
                "status": batch.status,
                "rows_processed": success,
                "rows_failed": failed
            })

        return Response({
            "batch_id": batch.id,
            "file_name": batch.file_name,
            "status": batch.status,
            "rows_processed": 0,
            "rows_failed": 0,
            "message": "Processing enqueued"
        }, status=status.HTTP_202_ACCEPTED)

class NormalizedRecordViewSet(viewsets.ModelViewSet):
    queryset = NormalizedRecord.objects.all().select_related('review_details', 'raw_record', 'upload_batch')
    serializer_class = NormalizedRecordSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['plant_code', 'meter_id', 'employee_id', 'fuel_type', 'travel_type', 'origin_airport', 'destination_airport']
    ordering_fields = ['record_date', 'calculated_emissions_co2e', 'created_at']

    def get_queryset(self):
        user = self.request.user
        if user.is_anonymous:
            return NormalizedRecord.objects.none()
        
        qs = NormalizedRecord.objects.filter(is_deleted=False)
        if user.tenant is not None:
            qs = qs.filter(tenant=user.tenant)
            
        # Apply filters manually for high reliability
        source_type = self.request.query_params.get('source_type')
        if source_type:
            qs = qs.filter(source_type=source_type)
            
        scope = self.request.query_params.get('scope')
        if scope:
            qs = qs.filter(scope=scope)
            
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(review_details__validation_status=status_param)
            
        review_status = self.request.query_params.get('review_status')
        if review_status:
            qs = qs.filter(review_details__review_status=review_status)

        start_date = self.request.query_params.get('start_date')
        if start_date:
            qs = qs.filter(record_date__gte=start_date)
            
        end_date = self.request.query_params.get('end_date')
        if end_date:
            qs = qs.filter(record_date__lte=end_date)
            
        return qs

    def perform_update(self, serializer):
        old_instance = self.get_object()
        
        # build old values dict
        old_values = {}
        for field in serializer.validated_data:
            old_val = getattr(old_instance, field, None)
            if isinstance(old_val, Decimal):
                old_val = float(old_val)
            elif isinstance(old_val, (datetime, date)):
                old_val = old_val.isoformat()
            old_values[field] = old_val
            
        instance = serializer.save(last_modified_by=self.request.user)
        
        # Re-run simple emissions calculation if quantity changes
        is_modified = False
        if instance.source_type == 'SAP' and 'fuel_qty' in serializer.validated_data:
            qty = instance.fuel_qty or Decimal('0')
            fuel_upper = (instance.fuel_type or '').upper()
            factor = Decimal('2.68') if 'DIESEL' in fuel_upper else Decimal('2.31') if 'PETROL' in fuel_upper or 'BENZIN' in fuel_upper else Decimal('0')
            instance.calculated_emissions_co2e = qty * factor
            instance.calculation_details['quantity'] = float(qty)
            instance.calculation_details['factor'] = float(factor)
            is_modified = True
        elif instance.source_type == 'UTILITY' and 'electricity_kwh' in serializer.validated_data:
            kwh = instance.electricity_kwh or Decimal('0')
            factor = Decimal('0.82')
            instance.calculated_emissions_co2e = kwh * factor
            instance.calculation_details['kwh'] = float(kwh)
            instance.calculation_details['factor'] = float(factor)
            is_modified = True
        elif instance.source_type == 'TRAVEL' and 'distance_km' in serializer.validated_data:
            dist = instance.distance_km or Decimal('0')
            travel_upper = (instance.travel_type or '').upper()
            factor = Decimal('0.15') if 'FLIGHT' in travel_upper or 'AIR' in travel_upper else Decimal('0.04') if 'RAIL' in travel_upper or 'TRAIN' in travel_upper else Decimal('0.18') if 'TAXI' in travel_upper or 'CAB' in travel_upper or 'CAR' in travel_upper else Decimal('0')
            instance.calculated_emissions_co2e = dist * factor
            instance.calculation_details['distance'] = float(dist)
            instance.calculation_details['factor'] = float(factor)
            is_modified = True
            
        if is_modified:
            instance.save()

        new_values = {}
        for field in serializer.validated_data:
            new_val = getattr(instance, field, None)
            if isinstance(new_val, Decimal):
                new_val = float(new_val)
            elif isinstance(new_val, (datetime, date)):
                new_val = new_val.isoformat()
            new_values[field] = new_val
            
        AuditLog.objects.create(
            tenant=instance.tenant,
            user=self.request.user,
            action='RECORD_EDIT',
            record_type='NormalizedRecord',
            record_id=instance.id,
            old_value=old_values,
            new_value=new_values
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        
        # Check if audit locked
        if hasattr(instance, 'review_details') and instance.review_details.is_locked:
            return Response({"error": "Cannot delete an audit-locked record"}, status=status.HTTP_400_BAD_REQUEST)
            
        instance.is_deleted = True
        instance.save()
        
        if hasattr(instance, 'review_details'):
            review = instance.review_details
            review.is_deleted = True
            review.save()
            
        AuditLog.objects.create(
            tenant=instance.tenant,
            user=request.user,
            action='RECORD_DELETE',
            record_type='NormalizedRecord',
            record_id=instance.id,
            old_value={"id": instance.id, "source_type": instance.source_type},
            new_value={"is_deleted": True}
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['GET'])
    def dashboard_stats(self, request):
        user = request.user
        if user.is_anonymous:
            return Response({"error": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)
            
        tenant_qs = NormalizedRecord.objects.filter(is_deleted=False)
        review_qs = ReviewRecord.objects.filter(is_deleted=False)
        
        if user.tenant is not None:
            tenant_qs = tenant_qs.filter(tenant=user.tenant)
            review_qs = review_qs.filter(tenant=user.tenant)
            
        # 1. Total KPI Metrics
        total_records = tenant_qs.count()
        approved_records = review_qs.filter(review_status='APPROVED').count()
        pending_review = review_qs.filter(review_status='PENDING').count()
        suspicious_records = review_qs.filter(validation_status='SUSPICIOUS').count()
        failed_records = review_qs.filter(validation_status='FAILED').count()
        
        # Emissions
        scope_1_total = tenant_qs.filter(scope='Scope 1').aggregate(total=Sum('calculated_emissions_co2e'))['total'] or 0.0
        scope_2_total = tenant_qs.filter(scope='Scope 2').aggregate(total=Sum('calculated_emissions_co2e'))['total'] or 0.0
        scope_3_total = tenant_qs.filter(scope='Scope 3').aggregate(total=Sum('calculated_emissions_co2e'))['total'] or 0.0
        
        # 2. Record Status Breakdown
        status_breakdown = list(review_qs.values('validation_status').annotate(count=Count('id')))
        
        # 3. Source Distribution
        source_dist = list(tenant_qs.values('source_type').annotate(count=Count('id'), emissions=Sum('calculated_emissions_co2e')))
        
        # 4. Monthly Upload Trend (grouping by record_date)
        monthly_trend = list(tenant_qs.annotate(
            month=TruncMonth('record_date')
        ).values('month').annotate(
            emissions=Sum('calculated_emissions_co2e'),
            count=Count('id')
        ).order_by('month'))
        
        # Format monthly trend response
        formatted_trend = []
        for item in monthly_trend:
            if item['month']:
                formatted_trend.append({
                    "month": item['month'].strftime('%Y-%m'),
                    "emissions": float(item['emissions'] or 0.0),
                    "count": item['count']
                })
        
        return Response({
            "kpis": {
                "total_records": total_records,
                "approved_records": approved_records,
                "pending_review": pending_review,
                "suspicious_records": suspicious_records,
                "failed_records": failed_records,
                "scope_1_total": float(scope_1_total),
                "scope_2_total": float(scope_2_total),
                "scope_3_total": float(scope_3_total),
                "total_emissions": float(scope_1_total + scope_2_total + scope_3_total)
            },
            "status_breakdown": status_breakdown,
            "source_distribution": [{
                "source_type": item['source_type'],
                "count": item['count'],
                "emissions": float(item['emissions'] or 0.0)
            } for item in source_dist],
            "monthly_trend": formatted_trend
        })

class ReviewRecordViewSet(viewsets.ModelViewSet):
    queryset = ReviewRecord.objects.all().select_related('normalized_record')
    serializer_class = ReviewRecordSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_anonymous:
            return ReviewRecord.objects.none()
        if user.tenant is None:
            return ReviewRecord.objects.all()
        return ReviewRecord.objects.filter(tenant=user.tenant)

    @action(detail=True, methods=['POST'])
    def approve(self, request, pk=None):
        review = self.get_object()
        if review.is_locked:
            return Response({"error": "Cannot edit an audit-locked record"}, status=status.HTTP_400_BAD_REQUEST)
            
        old_status = review.review_status
        review.review_status = 'APPROVED'
        review.approved_by = request.user
        review.approved_at = timezone.now()
        review.review_notes = request.data.get('notes', review.review_notes)
        review.save()
        
        AuditLog.objects.create(
            tenant=review.tenant,
            user=request.user,
            action='RECORD_APPROVE',
            record_type='ReviewRecord',
            record_id=review.id,
            old_value={"review_status": old_status},
            new_value={"review_status": 'APPROVED', "approved_by": request.user.username}
        )
        return Response(self.get_serializer(review).data)

    @action(detail=True, methods=['POST'])
    def reject(self, request, pk=None):
        review = self.get_object()
        if review.is_locked:
            return Response({"error": "Cannot edit an audit-locked record"}, status=status.HTTP_400_BAD_REQUEST)
            
        old_status = review.review_status
        review.review_status = 'REJECTED'
        review.review_notes = request.data.get('notes', '')
        review.save()
        
        AuditLog.objects.create(
            tenant=review.tenant,
            user=request.user,
            action='RECORD_REJECT',
            record_type='ReviewRecord',
            record_id=review.id,
            old_value={"review_status": old_status},
            new_value={"review_status": 'REJECTED', "notes": review.review_notes}
        )
        return Response(self.get_serializer(review).data)

    @action(detail=True, methods=['POST'])
    def request_correction(self, request, pk=None):
        review = self.get_object()
        if review.is_locked:
            return Response({"error": "Cannot edit an audit-locked record"}, status=status.HTTP_400_BAD_REQUEST)
            
        old_status = review.review_status
        review.review_status = 'CORRECTION'
        review.review_notes = request.data.get('notes', '')
        review.save()
        
        AuditLog.objects.create(
            tenant=review.tenant,
            user=request.user,
            action='RECORD_CORRECTION',
            record_type='ReviewRecord',
            record_id=review.id,
            old_value={"review_status": old_status},
            new_value={"review_status": 'CORRECTION', "notes": review.review_notes}
        )
        return Response(self.get_serializer(review).data)

    @action(detail=True, methods=['POST'])
    def lock_record(self, request, pk=None):
        review = self.get_object()
        if review.review_status != 'APPROVED':
            return Response({"error": "Only approved records can be audit locked"}, status=status.HTTP_400_BAD_REQUEST)
            
        review.is_locked = True
        review.save()
        
        AuditLog.objects.create(
            tenant=review.tenant,
            user=request.user,
            action='RECORD_LOCK',
            record_type='ReviewRecord',
            record_id=review.id,
            old_value={"is_locked": False},
            new_value={"is_locked": True}
        )
        return Response(self.get_serializer(review).data)

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.all().select_related('user')
    serializer_class = AuditLogSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['action', 'record_type', 'user__username']
    ordering_fields = ['timestamp']

    def get_queryset(self):
        user = self.request.user
        if user.is_anonymous:
            return AuditLog.objects.none()
        if user.tenant is None:
            return AuditLog.objects.all()
        return AuditLog.objects.filter(tenant=user.tenant)
