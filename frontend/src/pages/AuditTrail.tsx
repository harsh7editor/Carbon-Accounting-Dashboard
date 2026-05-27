import React, { useState, useEffect } from 'react';
import { api } from '../api';
import {
  Box, Card, CardContent, Typography, TextField, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, Paper, CircularProgress, Button, Chip
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  ClearAll as ClearIcon
} from '@mui/icons-material';

interface AuditLog {
  id: number;
  username: string;
  action: string;
  timestamp: string;
  record_type: string;
  record_id: number;
  old_value: any;
  new_value: any;
}

export const AuditTrail: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  
  // Table Params
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const [search, setSearch] = useState('');
  const [sortBy] = useState('-timestamp');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = {
        limit: rowsPerPage,
        offset: page * rowsPerPage,
        ordering: sortBy,
        search: search || undefined
      };
      const response = await api.get('audit/', { params });
      
      if (response.data.results) {
        setLogs(response.data.results);
        setTotalCount(response.data.count);
      } else {
        setLogs(response.data);
        setTotalCount(response.data.length);
      }
    } catch (err) {
      console.error("Failed to load audit logs", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, rowsPerPage, sortBy]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs();
  };

  const handleClear = () => {
    setSearch('');
    setPage(0);
  };

  const getActionColor = (action: string) => {
    if (action.includes('UPLOAD')) return 'info';
    if (action.includes('APPROVE')) return 'success';
    if (action.includes('REJECT')) return 'error';
    if (action.includes('LOCK')) return 'warning';
    if (action.includes('DELETE')) return 'error';
    return 'default';
  };

  const formatValue = (val: any) => {
    if (!val) return '-';
    if (typeof val === 'object') {
      return (
        <pre style={{ margin: 0, fontSize: '11px', fontFamily: 'monospace', color: '#94a3b8', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {JSON.stringify(val, null, 2)}
        </pre>
      );
    }
    return String(val);
  };

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>
          Chronological Audit Trail
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Immutable history logs of all imports, approvals, modifications, and lock events.
        </Typography>
      </Box>

      {/* Search Filter */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 2 }}>
          <Box component="form" onSubmit={handleSearchSubmit} sx={{ display: 'flex', gap: 2 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search by action, model type, or user email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />
              }}
            />
            <Button variant="outlined" startIcon={<ClearIcon />} onClick={handleClear}>
              Reset
            </Button>
            <Button variant="contained" type="submit" startIcon={<FilterIcon />}>
              Search
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Logs Table */}
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
                  <TableCell style={{ width: '180px' }}>Timestamp</TableCell>
                  <TableCell style={{ width: '150px' }}>User</TableCell>
                  <TableCell style={{ width: '180px' }}>Action</TableCell>
                  <TableCell style={{ width: '150px' }}>Entity Type</TableCell>
                  <TableCell style={{ width: '80px' }}>Entity ID</TableCell>
                  <TableCell>Previous Value</TableCell>
                  <TableCell>Updated Value</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {logs.length > 0 ? (
                  logs.map((log) => (
                    <TableRow key={log.id} hover>
                      <TableCell>{new Date(log.timestamp).toLocaleString()}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{log.username || 'System'}</TableCell>
                      <TableCell>
                        <Chip
                          label={log.action.replace('RECORD_', '')}
                          color={getActionColor(log.action) as any}
                          size="small"
                          sx={{ fontWeight: 700, fontSize: '11px' }}
                        />
                      </TableCell>
                      <TableCell>{log.record_type}</TableCell>
                      <TableCell>{log.record_id}</TableCell>
                      <TableCell>{formatValue(log.old_value)}</TableCell>
                      <TableCell>{formatValue(log.new_value)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 5 }}>
                      <Typography color="text.secondary">No audit logs found</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <TablePagination
              rowsPerPageOptions={[10, 15, 30, 50]}
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
export default AuditTrail;
