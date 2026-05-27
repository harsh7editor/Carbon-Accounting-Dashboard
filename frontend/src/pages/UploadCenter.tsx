import React, { useState } from 'react';
import { api } from '../api';
import {
  Box, Card, CardContent, Typography,
  Button, MenuItem, Select, FormControl, InputLabel,
  Alert, AlertTitle, CircularProgress, Paper
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  FileDownload as DownloadIcon,
  CheckCircleOutlined,
  ErrorOutlined
} from '@mui/icons-material';

export const UploadCenter: React.FC = () => {
  const [sourceType, setSourceType] = useState('SAP');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a CSV file to upload.');
      return;
    }

    setUploading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('source_type', sourceType);

    try {
      const response = await api.post('batches/upload_file/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setResult(response.data);
      setFile(null);
    } catch (err: any) {
      setError(
        err.response?.data?.error || 
        'An error occurred during file upload. Please verify the CSV format.'
      );
    } finally {
      setUploading(false);
    }
  };

  // Helper to generate and download template CSVs
  const downloadTemplate = (type: string) => {
    let headers = '';
    let sample = '';
    let fileName = '';

    if (type === 'SAP') {
      headers = 'WERK,KRAFTSTOFF,MENGE,EINHEIT,DATUM\n';
      sample = 'PL01,Diesel,500,L,24.05.2026\nPL02,Petrol,150,gal,25.05.2026\n';
      fileName = 'SAP_Fuel_Template.csv';
    } else if (type === 'UTILITY') {
      headers = 'meter_id,kwh,billing_start,billing_end,tariff\n';
      sample = 'MTR-10029,12450,2026-04-01,2026-04-30,Commercial Industrial\n';
      fileName = 'Utility_Electricity_Template.csv';
    } else if (type === 'TRAVEL') {
      headers = 'employee_id,travel_type,origin_airport,destination_airport,travel_date,distance_km\n';
      sample = 'EMP-4993,Flight,JFK,FRA,2026-05-10,\nEMP-3882,Taxi,,,2026-05-12,12.5\n';
      fileName = 'Corporate_Travel_Template.csv';
    }

    const blob = new Blob([headers + sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>
          Data Ingestion Hub
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Upload and normalize flat-file datasets into standard Scope-classified logs.
        </Typography>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '7fr 5fr' }, gap: 3.5 }}>
        {/* Upload Panel */}
        <Box>
          <Card>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h6" sx={{ mb: 3 }}>
                Upload Emissions Flat-File
              </Typography>

              <FormControl fullWidth sx={{ mb: 3.5 }}>
                <InputLabel id="source-type-label">Emissions Data Source</InputLabel>
                <Select
                  labelId="source-type-label"
                  value={sourceType}
                  label="Emissions Data Source"
                  onChange={(e) => setSourceType(e.target.value)}
                >
                  <MenuItem value="SAP">SAP Fuel Data (Scope 1)</MenuItem>
                  <MenuItem value="UTILITY">Utility Electricity Portal (Scope 2)</MenuItem>
                  <MenuItem value="TRAVEL">Corporate Travel Concur Export (Scope 3)</MenuItem>
                </Select>
              </FormControl>

              {/* Drag and Drop Zone Mock */}
              <Paper
                variant="outlined"
                sx={{
                  borderStyle: 'dashed',
                  borderWidth: 2,
                  borderColor: file ? 'primary.main' : 'rgba(148, 163, 184, 0.25)',
                  bgcolor: 'rgba(15, 23, 42, 0.2)',
                  p: 4.5,
                  textAlign: 'center',
                  cursor: 'pointer',
                  position: 'relative',
                  mb: 3.5,
                  transition: 'border-color 0.2s',
                  '&:hover': {
                    borderColor: 'primary.main',
                  }
                }}
              >
                <input
                  type="file"
                  accept=".csv"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    cursor: 'pointer',
                  }}
                  onChange={handleFileChange}
                />
                <UploadIcon sx={{ fontSize: 44, color: file ? 'primary.main' : 'text.secondary', mb: 2 }} />
                <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {file ? file.name : 'Choose file or drag here'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Supports CSV standard encoding (.csv up to 10MB)
                </Typography>
              </Paper>

              {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  <AlertTitle>Ingestion Error</AlertTitle>
                  {error}
                </Alert>
              )}

              {result && (
                <Alert
                  severity={result.status === 'SUCCESS' ? 'success' : 'warning'}
                  icon={result.status === 'SUCCESS' ? <CheckCircleOutlined /> : <ErrorOutlined />}
                  sx={{ mb: 3 }}
                >
                  <AlertTitle>Upload Finished: {result.status}</AlertTitle>
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="body2">
                      Batch ID: <strong>{result.batch_id}</strong> | File: {result.file_name}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      Processed rows: <strong style={{ color: '#10b981' }}>{result.rows_processed}</strong> | Failures: <strong style={{ color: '#f43f5e' }}>{result.rows_failed}</strong>
                    </Typography>
                  </Box>
                </Alert>
              )}

              <Button
                fullWidth
                variant="contained"
                size="large"
                startIcon={uploading ? <CircularProgress size={20} color="inherit" /> : <UploadIcon />}
                disabled={uploading || !file}
                onClick={handleUpload}
              >
                {uploading ? 'Processing File...' : 'Ingest & Normalize CSV'}
              </Button>
            </CardContent>
          </Card>
        </Box>

        {/* Templates Panel */}
        <Box>
          <Card>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h6" sx={{ mb: 2.5 }}>
                Emissions CSV Templates
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3.5 }}>
                Ensure your ingestion files conform to the structural requirements before submitting to the Normalization Engine.
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <Paper variant="outlined" sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderColor: 'rgba(148,163,184,0.1)' }}>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      SAP Fuel Flat-File (Scope 1)
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Columns: WERK, KRAFTSTOFF, MENGE, EINHEIT, DATUM
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={() => downloadTemplate('SAP')}
                  >
                    Template
                  </Button>
                </Paper>

                <Paper variant="outlined" sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderColor: 'rgba(148,163,184,0.1)' }}>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      Utility Electricity Invoice (Scope 2)
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Columns: meter_id, kwh, billing_start, billing_end, tariff
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={() => downloadTemplate('UTILITY')}
                  >
                    Template
                  </Button>
                </Paper>

                <Paper variant="outlined" sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderColor: 'rgba(148,163,184,0.1)' }}>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      Corporate Travel Export (Scope 3)
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Columns: employee_id, travel_type, origin_airport...
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={() => downloadTemplate('TRAVEL')}
                  >
                    Template
                  </Button>
                </Paper>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
};
export default UploadCenter;

