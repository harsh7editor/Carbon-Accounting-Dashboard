import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import {
  Box, Card, CardContent, Typography, Grid, Button,
  Chip, CircularProgress, Alert, Stack, Table,
  TableBody, TableCell, TableContainer, TableRow, TextField, Paper
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  CheckCircleOutline as ApproveIcon,
  HighlightOff as RejectIcon,
  Lock as LockIcon,
  Undo as CorrectionIcon,
  History as AuditIcon,
  Functions as MathIcon
} from '@mui/icons-material';

interface NormalizedRecord {
  id: number;
  source_type: string;
  scope: string;
  record_date: string;
  plant_code: string | null;
  meter_id: string | null;
  employee_id: string | null;
  fuel_type: string | null;
  fuel_qty: string | null;
  fuel_unit: string | null;
  electricity_kwh: string | null;
  billing_start: string | null;
  billing_end: string | null;
  tariff: string | null;
  travel_type: string | null;
  origin_airport: string | null;
  destination_airport: string | null;
  distance_km: string | null;
  calculated_emissions_co2e: string;
  calculation_details: {
    formula: string;
    quantity?: number;
    kwh?: number;
    distance?: number;
    factor: number;
    factor_name?: string;
    original_quantity?: number;
    original_unit?: string;
    calculated_from_airport_lookup?: boolean;
    airport_coordinates?: any;
  };
  upload_batch: number;
  upload_batch_filename: string;
  raw_row_data: Record<string, string>;
  created_at: string;
  updated_at: string;
  last_modified_by_username: string | null;
  review_details: {
    id: number;
    validation_status: 'VALID' | 'SUSPICIOUS' | 'FAILED';
    validation_errors: string[];
    review_status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CORRECTION';
    review_notes: string | null;
    is_locked: boolean;
    approved_by_username: string | null;
    approved_at: string | null;
  };
}

interface AuditLog {
  id: number;
  username: string;
  action: string;
  timestamp: string;
  old_value: any;
  new_value: any;
}

export const RecordDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [record, setRecord] = useState<NormalizedRecord | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const recRes = await api.get(`records/${id}/`);
      setRecord(recRes.data);
      
      // Fetch audits for this record ID
      const auditRes = await api.get('audit/', {
        params: {
          search: `NormalizedRecord`, // Searching record logs
        }
      });
      // Filter manually to match this record ID specifically
      const filteredAudits = (auditRes.data.results || auditRes.data).filter(
        (log: any) => log.record_id === parseInt(id || '0')
      );
      setAuditLogs(filteredAudits);
    } catch (err: any) {
      setError('Failed to retrieve record information.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleAction = async (actionType: 'approve' | 'reject' | 'request_correction' | 'lock_record') => {
    if (!record) return;
    setSaving(true);
    
    try {
      const reviewId = record.review_details.id;
      let url = `reviews/${reviewId}/`;
      
      if (actionType === 'approve') {
        url += 'approve/';
      } else if (actionType === 'reject') {
        url += 'reject/';
      } else if (actionType === 'request_correction') {
        url += 'request_correction/';
      } else if (actionType === 'lock_record') {
        url += 'lock_record/';
      }
      
      await api.post(url, { notes });
      setNotes('');
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || `Action failed.`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !record) {
    return (
      <Box sx={{ p: 3 }}>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/review')} sx={{ mb: 2 }}>
          Back to Queue
        </Button>
        <Alert severity="error">{error || 'Record not found'}</Alert>
      </Box>
    );
  }

  const { validation_status, validation_errors, review_status, is_locked } = record.review_details;

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/review')}>
          Back to Review Queue
        </Button>
        
        <Stack direction="row" spacing={1.5}>
          {is_locked && (
            <Chip icon={<LockIcon />} label="Audit Locked" color="warning" sx={{ fontWeight: 700 }} />
          )}
          <Chip label={`Validation: ${validation_status}`} color={validation_status === 'VALID' ? 'success' : validation_status === 'SUSPICIOUS' ? 'warning' : 'error'} />
          <Chip label={`Review: ${review_status}`} color={review_status === 'APPROVED' ? 'success' : review_status === 'REJECTED' ? 'error' : 'secondary'} />
        </Stack>
      </Box>

      {validation_errors.length > 0 && (
        <Alert severity={validation_status === 'FAILED' ? 'error' : 'warning'} sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Automated Validation Flags Detected:
          </Typography>
          <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
            {validation_errors.map((err, i) => (
              <li key={i}><Typography variant="body2">{err}</Typography></li>
            ))}
          </ul>
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Comparison Side-by-Side */}
        <Grid item xs={12} lg={8}>
          <Grid container spacing={3}>
            {/* Raw CSV values */}
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, color: 'text.secondary' }}>
                    Original Flat-File Ingested Row
                  </Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableBody>
                        {Object.entries(record.raw_row_data || {}).map(([key, val]) => (
                          <TableRow key={key}>
                            <TableCell sx={{ fontWeight: 600, width: '40%' }}>{key}</TableCell>
                            <TableCell>{val || <em style={{ color: '#64748b' }}>null</em>}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>

            {/* Normalized system values */}
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, color: 'primary.light' }}>
                    Normalized Database Schema
                  </Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableBody>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600, width: '45%' }}>Ingestion Source</TableCell>
                          <TableCell>{record.source_type}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600 }}>Scope Tier</TableCell>
                          <TableCell>{record.scope}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600 }}>Normalized Date</TableCell>
                          <TableCell>{record.record_date}</TableCell>
                        </TableRow>
                        
                        {record.source_type === 'SAP' && (
                          <>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 600 }}>Plant Code</TableCell>
                              <TableCell>{record.plant_code}</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 600 }}>Fuel Type</TableCell>
                              <TableCell>{record.fuel_type}</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 600 }}>Normalized Qty</TableCell>
                              <TableCell>{record.fuel_qty} {record.fuel_unit}</TableCell>
                            </TableRow>
                          </>
                        )}

                        {record.source_type === 'UTILITY' && (
                          <>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 600 }}>Meter ID</TableCell>
                              <TableCell>{record.meter_id}</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 600 }}>Electricity (kWh)</TableCell>
                              <TableCell>{record.electricity_kwh} kWh</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 600 }}>Billing Period</TableCell>
                              <TableCell>{record.billing_start} to {record.billing_end}</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 600 }}>Tariff Class</TableCell>
                              <TableCell>{record.tariff}</TableCell>
                            </TableRow>
                          </>
                        )}

                        {record.source_type === 'TRAVEL' && (
                          <>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 600 }}>Employee ID</TableCell>
                              <TableCell>{record.employee_id}</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 600 }}>Travel Type</TableCell>
                              <TableCell>{record.travel_type}</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 600 }}>Origin Airport</TableCell>
                              <TableCell>{record.origin_airport || '-'}</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 600 }}>Destination Airport</TableCell>
                              <TableCell>{record.destination_airport || '-'}</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 600 }}>Distance (km)</TableCell>
                              <TableCell>{record.distance_km} km</TableCell>
                            </TableRow>
                          </>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Calculations Detail Card */}
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <MathIcon sx={{ color: 'secondary.main' }} />
                Emissions Calculation Audit Trace
              </Typography>
              
              <Box sx={{ p: 2.5, bgcolor: 'rgba(15, 23, 42, 0.4)', borderRadius: '8px', border: '1px solid rgba(148, 163, 184, 0.05)' }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={8}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Formula Applied:
                    </Typography>
                    <Typography variant="body1" sx={{ fontFamily: 'monospace', fontWeight: 600, color: 'secondary.light', my: 0.5 }}>
                      {record.calculation_details.formula}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Factor: <strong>{record.calculation_details.factor_name || `${record.calculation_details.factor} kg CO2e`}</strong>
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={4} sx={{ textAlign: { md: 'right' }, borderLeft: { md: '1px solid rgba(148,163,184,0.1)' }, pl: { md: 3 } }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Calculated Output:
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: 'primary.main' }}>
                      {parseFloat(record.calculated_emissions_co2e).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      kg CO2e
                    </Typography>
                  </Grid>
                </Grid>
                
                {record.calculation_details.calculated_from_airport_lookup && (
                  <Alert severity="info" sx={{ mt: 2, py: 0.5 }}>
                    Distance was calculated dynamically using the Great-Circle Haversine formula based on airport locations.
                  </Alert>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Audit Lock and Analyst Decision Controls */}
        <Grid item xs={12} lg={4}>
          {/* Decision Box */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Analyst Audit Actions
              </Typography>
              
              {is_locked ? (
                <Alert severity="warning">
                  This record is **Audit Locked**. No further updates, reviews, or edits can be made.
                </Alert>
              ) : (
                <Box>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Audit & review justification notes..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    sx={{ mb: 2 }}
                  />
                  
                  <Stack spacing={1.5}>
                    {review_status === 'PENDING' && (
                      <>
                        <Button
                          fullWidth
                          variant="contained"
                          color="success"
                          startIcon={<ApproveIcon />}
                          disabled={saving}
                          onClick={() => handleAction('approve')}
                        >
                          Approve Record
                        </Button>
                        <Button
                          fullWidth
                          variant="contained"
                          color="error"
                          startIcon={<RejectIcon />}
                          disabled={saving}
                          onClick={() => handleAction('reject')}
                        >
                          Reject Record
                        </Button>
                        <Button
                          fullWidth
                          variant="outlined"
                          color="warning"
                          startIcon={<CorrectionIcon />}
                          disabled={saving}
                          onClick={() => handleAction('request_correction')}
                        >
                          Request Correction
                        </Button>
                      </>
                    )}
                    
                    {review_status === 'APPROVED' && (
                      <Button
                        fullWidth
                        variant="contained"
                        color="warning"
                        startIcon={<LockIcon />}
                        disabled={saving}
                        onClick={() => handleAction('lock_record')}
                      >
                        Apply Audit Lock
                      </Button>
                    )}

                    {review_status === 'REJECTED' && (
                      <Alert severity="error">
                        This record was rejected. Review notes: "{record.review_details.review_notes || 'None'}"
                      </Alert>
                    )}
                    
                    {review_status === 'CORRECTION' && (
                      <Alert severity="warning">
                        Correction was requested. Analyst notes: "{record.review_details.review_notes || 'None'}"
                      </Alert>
                    )}
                  </Stack>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Record History */}
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <AuditIcon sx={{ color: 'text.secondary' }} />
                Record History
              </Typography>
              
              {auditLogs.length > 0 ? (
                <Stack spacing={2} sx={{ mt: 1.5 }}>
                  {auditLogs.map((log) => (
                    <Box key={log.id} sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: '8px', borderLeft: '3px solid', borderColor: log.action.includes('APPROVE') ? 'success.main' : log.action.includes('LOCK') ? 'warning.main' : 'info.main' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {log.action.replace('RECORD_', '')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        By {log.username} at {new Date(log.timestamp).toLocaleString()}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No modifications logged for this record.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};
export default RecordDetails;
