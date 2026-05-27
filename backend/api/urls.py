from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    TenantViewSet, CustomUserViewSet, PlantCodeViewSet, 
    AirportCodeViewSet, DataSourceViewSet, UploadBatchViewSet, 
    NormalizedRecordViewSet, ReviewRecordViewSet, AuditLogViewSet,
    CustomTokenObtainPairView, RegisterView, PublicTenantListView,
)
from rest_framework_simplejwt.views import TokenRefreshView

router = DefaultRouter()
router.register('tenants', TenantViewSet)
router.register('users', CustomUserViewSet)
router.register('plants', PlantCodeViewSet)
router.register('airports', AirportCodeViewSet)
router.register('sources', DataSourceViewSet)
router.register('batches', UploadBatchViewSet)
router.register('records', NormalizedRecordViewSet)
router.register('reviews', ReviewRecordViewSet)
router.register('audit', AuditLogViewSet)

urlpatterns = [
    path('auth/login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/tenants/', PublicTenantListView.as_view(), name='public_tenants'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('', include(router.urls)),
]
