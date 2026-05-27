from celery import shared_task
from django.apps import apps

from .services import process_csv_upload


@shared_task(bind=True)
def process_csv_upload_task(self, upload_batch_id, file_content):
    UploadBatch = apps.get_model('api', 'UploadBatch')
    try:
        upload_batch = UploadBatch.objects.get(id=upload_batch_id)
    except UploadBatch.DoesNotExist:
        return {'error': 'UploadBatch not found', 'id': upload_batch_id}

    success, failed = process_csv_upload(upload_batch, file_content)
    return {'success': success, 'failed': failed}
