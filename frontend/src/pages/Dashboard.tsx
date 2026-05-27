import React, { useState, useEffect } from 'react';
import { api } from '../api';
import {
  Grid, Card, CardContent, Typography, Box,
  CircularProgress
} from '@mui/material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as ChartTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import {
  DescriptionOutlined,
  CheckCircleOutlined,
  HourglassEmptyOutlined,
  WarningAmberOutlined,
  ErrorOutlineOutlined,
  Co2Outlined,
  TrendingUpOutlined
} from '@mui/icons-material';

interface KPIStats {
  total_records: number;
  approved_records: number;
  pending_review: number;
  suspicious_records: number;
  failed_records: number;
  scope_1_total: number;
  scope_2_total: number;
  scope_3_total: number;
  total_emissions: number;
}

interface StatusBreakdownItem {
  validation_status: string;
  count: number;
}

interface SourceDistributionItem {
  source_type: string;
  count: number;
  emissions: number;
}

interface MonthlyTrendItem {
  month: string;
  emissions: number;
  count: number;
}

interface DashboardData {
  kpis: KPIStats;
  status_breakdown: StatusBreakdownItem[];
  source_distribution: SourceDistributionItem[];
  monthly_trend: MonthlyTrendItem[];
}

const COLORS = {
  VALID: '#10b981',      // Emerald Green
  SUSPICIOUS: '#f59e0b', // Amber
  FAILED: '#f43f5e',     // Rose
  PENDING: '#64748b',    // Slate
  Scope1: '#10b981',
  Scope2: '#06b6d4',
  Scope3: '#3b82f6'
};

export const Dashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get('records/dashboard_stats/');
        setData(response.data);
      } catch (err: any) {
        setError('Failed to fetch dashboard data. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchStats();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  if (error || !data) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="error" variant="h6">{error || 'Something went wrong'}</Typography>
      </Box>
    );
  }

  const { kpis, status_breakdown, source_distribution, monthly_trend } = data;

  // Prepare Pie Chart data for Status Breakdown
  const statusPieData = status_breakdown.map(item => ({
    name: item.validation_status,
    value: item.count,
    color: COLORS[item.validation_status as keyof typeof COLORS] || '#64748b'
  }));

  // Prepare Pie Chart data for Scope Distribution
  const scopePieData = [
    { name: 'Scope 1 (Direct)', value: kpis.scope_1_total, color: COLORS.Scope1 },
    { name: 'Scope 2 (Indirect)', value: kpis.scope_2_total, color: COLORS.Scope2 },
    { name: 'Scope 3 (Value Chain)', value: kpis.scope_3_total, color: COLORS.Scope3 }
  ].filter(item => item.value > 0);

  const kpiCards = [
    { title: 'Total Records', value: kpis.total_records, icon: <DescriptionOutlined />, color: '#3b82f6' },
    { title: 'Approved Records', value: kpis.approved_records, icon: <CheckCircleOutlined />, color: '#10b981' },
    { title: 'Pending Review', value: kpis.pending_review, icon: <HourglassEmptyOutlined />, color: '#64748b' },
    { title: 'Suspicious Records', value: kpis.suspicious_records, icon: <WarningAmberOutlined />, color: '#f59e0b' },
    { title: 'Failed Records', value: kpis.failed_records, icon: <ErrorOutlineOutlined />, color: '#f43f5e' },
  ];

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>
            Sustainability Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Continuous audit & normalization summary for emissions sources.
          </Typography>
        </Box>
        <Card sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Co2Outlined sx={{ fontSize: 36, color: 'primary.main' }} />
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
              Total Emissions Locked / Approved
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 800, color: 'primary.main', lineHeight: 1.1 }}>
              {kpis.total_emissions.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span style={{ fontSize: 12 }}>kg CO2e</span>
            </Typography>
          </Box>
        </Card>
      </Box>

      {/* KPI Section */}
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        {kpiCards.map((kpi, idx) => (
          <Grid item xs={12} sm={6} md={2.4} key={idx}>
            <Card>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                    {kpi.title}
                  </Typography>
                  <Box sx={{ p: 0.75, borderRadius: '8px', bgcolor: 'rgba(255,255,255,0.05)', color: kpi.color, display: 'flex' }}>
                    {kpi.icon}
                  </Box>
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
                  {kpi.value}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Scope Cards */}
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Card sx={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(15, 23, 42, 0.6) 100%)' }}>
            <CardContent>
              <Typography variant="h6" sx={{ color: 'primary.light', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10b981' }}></span>
                Scope 1 (Direct)
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Stationary combustion & mobile fuels (e.g. SAP Fuel Exports)
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>
                {kpis.scope_1_total.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span style={{ fontSize: 14, fontWeight: 500 }}>kg CO2e</span>
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.05) 0%, rgba(15, 23, 42, 0.6) 100%)' }}>
            <CardContent>
              <Typography variant="h6" sx={{ color: 'secondary.light', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#06b6d4' }}></span>
                Scope 2 (Indirect)
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Purchased electricity & grid utilities (e.g. Electricity Invoices)
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>
                {kpis.scope_2_total.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span style={{ fontSize: 14, fontWeight: 500 }}>kg CO2e</span>
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(15, 23, 42, 0.6) 100%)' }}>
            <CardContent>
              <Typography variant="h6" sx={{ color: 'info.light', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#3b82f6' }}></span>
                Scope 3 (Value Chain)
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Corporate business travel & logistics (e.g. Travel CSV exports)
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>
                {kpis.scope_3_total.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span style={{ fontSize: 14, fontWeight: 500 }}>kg CO2e</span>
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts Section */}
      <Grid container spacing={2.5}>
        {/* Monthly Trend */}
        <Grid item xs={12} md={8}>
          <Card sx={{ height: '400px' }}>
            <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingUpOutlined sx={{ color: 'primary.main' }} />
                Monthly Emissions Ingestion Trend
              </Typography>
              <Box sx={{ flexGrow: 1, minHeight: 0 }}>
                {monthly_trend.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthly_trend} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.05)" />
                      <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
                      <YAxis stroke="#94a3b8" fontSize={12} label={{ value: 'kg CO2e', angle: -90, position: 'insideLeft', fill: '#94a3b8', offset: 10 }} />
                      <ChartTooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '8px' }} />
                      <Legend />
                      <Line name="Emissions (kg CO2e)" type="monotone" dataKey="emissions" stroke="#10b981" strokeWidth={3} activeDot={{ r: 8 }} />
                      <Line name="Record Count" type="monotone" dataKey="count" stroke="#06b6d4" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                    <Typography color="text.secondary">No trend data available</Typography>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Status Breakdown */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '400px' }}>
            <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Record Validation Status
              </Typography>
              <Box sx={{ flexGrow: 1, position: 'relative', minHeight: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                {statusPieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusPieData}
                        cx="50%"
                        cy="45%"
                        innerRadius={65}
                        outerRadius={85}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {statusPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <ChartTooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '8px' }} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <Typography color="text.secondary">No validation data available</Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Source Distribution */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '360px' }}>
            <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Emissions by Ingestion Source (kg CO2e)
              </Typography>
              <Box sx={{ flexGrow: 1, minHeight: 0 }}>
                {source_distribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={source_distribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.05)" />
                      <XAxis dataKey="source_type" stroke="#94a3b8" fontSize={12} />
                      <YAxis stroke="#94a3b8" fontSize={12} />
                      <ChartTooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '8px' }} />
                      <Bar name="Emissions (kg CO2e)" dataKey="emissions" radius={[4, 4, 0, 0]}>
                        {source_distribution.map((entry, index) => {
                          const scopeColor = entry.source_type === 'SAP' ? COLORS.Scope1 : entry.source_type === 'UTILITY' ? COLORS.Scope2 : COLORS.Scope3;
                          return <Cell key={`cell-${index}`} fill={scopeColor} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                    <Typography color="text.secondary">No source data available</Typography>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Scope Distribution */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '360px' }}>
            <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Scope Emissions Distribution
              </Typography>
              <Box sx={{ flexGrow: 1, position: 'relative', minHeight: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                {scopePieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={scopePieData}
                        cx="50%"
                        cy="45%"
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name = '', percent = 0 }) => `${name.split(' ')[0] || 'Unknown'}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {scopePieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <ChartTooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '8px' }} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <Typography color="text.secondary">No scope data available</Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};
export default Dashboard;
