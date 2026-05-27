import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import {
  Box, Card, CardContent, Typography, TextField, MenuItem,
  Select, FormControl, InputLabel, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TablePagination,
  Paper, Chip, Stack, IconButton, Tooltip, CircularProgress, Grid
} from '@mui/material';
import {
  Search as SearchIcon,
  VisibilityOutlined as ViewIcon,
  CheckCircleOutline as ApproveIcon,
  HighlightOff as RejectIcon,
  Lock as LockIcon,
  FilterList as FilterIcon,
  ClearAll as ClearIcon
} from '@mui/icons-material';


interface NormalizedRecord {
  id: number;
  source_type: string;
  scope: string;
  record_date: string;
  plant_code: string | null;
  meter_id: string | null;
  employee_id: string | null;
  fuel_qty: string | null;
  fuel_unit: string | null;
  fuel_type?: string | null;
  electricity_kwh: string | null;
  travel_type: string | null;
  distance_km: string | null;
  calculated_emissions_co2e: string;
  upload_batch_filename: string;
  review_details: {
    id: number;
    validation_status: 'VALID' | 'SUSPICIOUS' | 'FAILED';
    validation_errors: string[];
    review_status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CORRECTION';
    review_notes: string | null;
    is_locked: boolean;
  };
}

export const ReviewQueue: React.FC = () => {
  const navigate = useNavigate();
  const [records, setRecords] = useState<NormalizedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  
  // Table Params
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [sortBy] = useState('-created_at');
  
  // Filter States
  const [sourceType, setSourceType] = useState('');
  const [scope, setScope] = useState('');
  const [status, setStatus] = useState('');
  const [reviewStatus, setReviewStatus] = useState('PENDING'); // Default to pending review queue
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const params: any = {
        limit: rowsPerPage,
        offset: page * rowsPerPage,
        ordering: sortBy,
        search: search || undefined,
        source_type: sourceType || undefined,
        scope: scope || undefined,
        status: status || undefined,
        review_status: reviewStatus || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined
      };
      
      const response = await api.get('records/', { params });
      // DRF might return paginated results list or direct array
      if (response.data.results) {
        setRecords(response.data.results);
        setTotalCount(response.data.count);
      } else {
        setRecords(response.data);
        setTotalCount(response.data.length);
      }
    } catch (err) {
      console.error("Failed to load records", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [page, rowsPerPage, sortBy, sourceType, scope, status, reviewStatus, startDate, endDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRecords();
  };

  const handleClearFilters = () => {
    setSearch('');
    setSourceType('');
    setScope('');
    setStatus('');
    setReviewStatus('');
    setStartDate('');
    setEndDate('');
    setPage(0);
  };

  const handleApprove = async (reviewId: number) => {
    try {
      await api.post(`reviews/${reviewId}/approve/`, { notes: "Approved via quick action." });
      fetchRecords();
    } catch (err) {
      alert("Failed to approve record.");
    }
  };

  const handleReject = async (reviewId: number) => {
    const notes = prompt("Enter rejection reason:");
    if (notes === null) return;
    try {
      await api.post(`reviews/${reviewId}/reject/`, { notes });
      fetchRecords();
    } catch (err) {
      alert("Failed to reject record.");
    }
  };

  const getStatusChip = (valStatus: string) => {
    switch (valStatus) {
      case 'VALID':
        return <Chip label="Valid" color="success" size="small" variant="outlined" sx={{ bgcolor: 'rgba(16,185,129,0.1)', color: '#10b981', fontWeight: 600 }} />;
      case 'SUSPICIOUS':
        return <Chip label="Suspicious" color="warning" size="small" sx={{ bgcolor: 'rgba(245,158,11,0.1)', color: '#f59e0b', fontWeight: 600 }} />;
      case 'FAILED':
        return <Chip label="Failed" color="error" size="small" sx={{ bgcolor: 'rgba(244,63,94,0.1)', color: '#f43f5e', fontWeight: 600 }} />;
      default:
        return <Chip label={valStatus} size="small" />;
    }
  };

  const getReviewChip = (revStatus: string) => {
    switch (revStatus) {
      case 'APPROVED':
        return <Chip label="Approved" size="small" color="success" sx={{ fontWeight: 600 }} />;
      case 'REJECTED':
        return <Chip label="Rejected" size="small" color="error" sx={{ fontWeight: 600 }} />;
      case 'CORRECTION':
        return <Chip label="Correction" size="small" color="warning" sx={{ fontWeight: 600 }} />;
      case 'PENDING':
      default:
        return <Chip label="Pending Review" size="small" color="secondary" sx={{ fontWeight: 600 }} />;
    }
  };

  const getMetricSummary = (row: NormalizedRecord) => {
    if (row.source_type === 'SAP') {
      return `${row.fuel_qty} ${row.fuel_unit} (${row.fuel_type})`;
    } else if (row.source_type === 'UTILITY') {
      return `${row.electricity_kwh} kWh`;
    } else if (row.source_type === 'TRAVEL') {
      return `${row.distance_km} km (${row.travel_type})`;
    }
    return '';
  };

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>
          Analyst Review Queue
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Validate and audit incoming normalized sustainability metrics.
        </Typography>
      </Box>

      {/* Filters Card */}
      <Card sx={{ mb: 3.5 }}>
        <CardContent sx={{ p: 3 }}>
          <Box component="form" onSubmit={handleSearchSubmit}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={4} md={3}>
                <TextField
                  fullWidth
                  label="Search records..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  InputProps={{
                    startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />
                  }}
                />
              </Grid>

              <Grid item xs={12} sm={4} md={2.25}>
                <FormControl fullWidth>
                  <InputLabel>Ingestion Source</InputLabel>
                  <Select
                    value={sourceType}
                    label="Ingestion Source"
                    onChange={(e) => { setSourceType(e.target.value); setPage(0); }}
                  >
                    <MenuItem value="">All Sources</MenuItem>
                    <MenuItem value="SAP">SAP Fuel Data</MenuItem>
                    <MenuItem value="UTILITY">Utility Electricity</MenuItem>
                    <MenuItem value="TRAVEL">Corporate Travel</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={4} md={2.25}>
                <FormControl fullWidth>
                  <InputLabel>Scope Classification</InputLabel>
                  <Select
                    value={scope}
                    label="Scope Classification"
                    onChange={(e) => { setScope(e.target.value); setPage(0); }}
                  >
                    <MenuItem value="">All Scopes</MenuItem>
                    <MenuItem value="Scope 1">Scope 1 (Direct)</MenuItem>
                    <MenuItem value="Scope 2">Scope 2 (Indirect)</MenuItem>
                    <MenuItem value="Scope 3">Scope 3 (Value Chain)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={4} md={2.25}>
                <FormControl fullWidth>
                  <InputLabel>Review Status</InputLabel>
                  <Select
                    value={reviewStatus}
                    label="Review Status"
                    onChange={(e) => { setReviewStatus(e.target.value); setPage(0); }}
                  >
                    <MenuItem value="">All Reviews</MenuItem>
                    <MenuItem value="PENDING">Pending Review</MenuItem>
                    <MenuItem value="APPROVED">Approved</MenuItem>
                    <MenuItem value="REJECTED">Rejected</MenuItem>
                    <MenuItem value="CORRECTION">Correction Requested</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={4} md={2.25}>
                <FormControl fullWidth>
                  <InputLabel>Validation Flag</InputLabel>
                  <Select
                    value={status}
                    label="Validation Flag"
                    onChange={(e) => { setStatus(e.target.value); setPage(0); }}
                  >
                    <MenuItem value="">All Flags</MenuItem>
                    <MenuItem value="VALID">Valid</MenuItem>
                    <MenuItem value="SUSPICIOUS">Suspicious</MenuItem>
                    <MenuItem value="FAILED">Failed</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  type="date"
                  label="Start Date"
                  InputLabelProps={{ shrink: true } as any}
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setPage(0); }}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  type="date"
                  label="End Date"
                  InputLabelProps={{ shrink: true } as any}
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setPage(0); }}
                />
              </Grid>

              <Grid item xs={12} md={6} sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
                <Button variant="outlined" color="secondary" startIcon={<ClearIcon />} onClick={handleClearFilters}>
                  Reset
                </Button>
                <Button variant="contained" type="submit" startIcon={<FilterIcon />}>
                  Apply Filters
                </Button>
              </Grid>
            </Grid>
          </Box>
        </CardContent>
      </Card>

      {/* Records Table */}
      <TableContainer component={Paper}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Table sx={{ minWidth: 650 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Record Date</TableCell>
                  <TableCell>Ingestion Source</TableCell>
                  <TableCell>Scope</TableCell>
                  <TableCell>Normalized Metric</TableCell>
                  <TableCell align="right">Emissions (kg CO2e)</TableCell>
                  <TableCell>Validation</TableCell>
                  <TableCell>Review Status</TableCell>
                  <TableCell align="center">Lock</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {records.length > 0 ? (
                  records.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{row.record_date || 'N/A'}</TableCell>
                      <TableCell>
                        <Stack>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{row.source_type}</Typography>
                          <Typography variant="caption" color="text.secondary">{row.upload_batch_filename}</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>{row.scope}</TableCell>
                      <TableCell>{getMetricSummary(row)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        {parseFloat(row.calculated_emissions_co2e).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>{getStatusChip(row.review_details.validation_status)}</TableCell>
                      <TableCell>{getReviewChip(row.review_details.review_status)}</TableCell>
                      <TableCell align="center">
                        {row.review_details.is_locked ? (
                          <Tooltip title="Audit Locked">
                            <LockIcon sx={{ color: 'warning.main', fontSize: 18 }} />
                          </Tooltip>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'center' }}>
                          <Tooltip title="View Details">
                            <IconButton color="info" size="small" onClick={() => navigate(`/records/${row.id}`)}>
                              <ViewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          
                          {!row.review_details.is_locked && row.review_details.review_status === 'PENDING' && (
                            <>
                              <Tooltip title="Approve">
                                <IconButton color="success" size="small" onClick={() => handleApprove(row.review_details.id)}>
                                  <ApproveIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Reject">
                                <IconButton color="error" size="small" onClick={() => handleReject(row.review_details.id)}>
                                  <RejectIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                        </Stack>
                      </TableCell>

                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 5 }}>
                      <Typography color="text.secondary">No matching records found in queue</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <TablePagination
              rowsPerPageOptions={[5, 10, 25, 50]}
              component="div"
              count={totalCount}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(_, newPage) => setPage(newPage)}
              onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
            />
          </>
        )}
      </TableContainer>
    </Box>
  );
};
export default ReviewQueue;
