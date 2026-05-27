from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import (
    Tenant, PlantCode, AirportCode, DataSource, 
    UploadBatch, RawRecord, NormalizedRecord, ReviewRecord, AuditLog
)

User = get_user_model()

class TenantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tenant
        fields = '__all__'

class CustomUserSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'tenant', 'tenant_name', 'role', 'first_name', 'last_name')
        read_only_fields = ('id',)


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True)
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    tenant = serializers.PrimaryKeyRelatedField(queryset=Tenant.objects.all())

    def validate_email(self, value):
        email = value.lower().strip()
        if User.objects.filter(username__iexact=email).exists():
            raise serializers.ValidationError('An account with this email already exists.')
        return email

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({'password_confirm': 'Passwords do not match.'})
        return attrs

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        email = validated_data.pop('email')
        tenant = validated_data.pop('tenant')
        first_name = validated_data.get('first_name', '')
        last_name = validated_data.get('last_name', '')
        return User.objects.create_user(
            username=email,
            email=email,
            password=password,
            tenant=tenant,
            role='ANALYST',
            first_name=first_name,
            last_name=last_name,
        )

class PlantCodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlantCode
        fields = '__all__'

class AirportCodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = AirportCode
        fields = '__all__'

class DataSourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = DataSource
        fields = '__all__'

class UploadBatchSerializer(serializers.ModelSerializer):
    uploaded_by_username = serializers.CharField(source='uploaded_by.username', read_only=True)
    
    class Meta:
        model = UploadBatch
        fields = '__all__'

class RawRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = RawRecord
        fields = '__all__'

class ReviewRecordSerializer(serializers.ModelSerializer):
    approved_by_username = serializers.CharField(source='approved_by.username', read_only=True)

    class Meta:
        model = ReviewRecord
        fields = '__all__'

class NormalizedRecordSerializer(serializers.ModelSerializer):
    review_details = ReviewRecordSerializer(read_only=True)
    raw_row_data = serializers.JSONField(source='raw_record.row_data', read_only=True)
    last_modified_by_username = serializers.CharField(source='last_modified_by.username', read_only=True)
    upload_batch_filename = serializers.CharField(source='upload_batch.file_name', read_only=True)

    class Meta:
        model = NormalizedRecord
        fields = '__all__'

class AuditLogSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = AuditLog
        fields = '__all__'
