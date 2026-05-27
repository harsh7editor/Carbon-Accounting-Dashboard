import React, { useState, useEffect } from 'react';
import { api } from '../api';
import {
  Box, Card, CardContent, Typography, Tabs, Tab, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, CircularProgress, Grid, Chip, Stack, Divider
} from '@mui/material';
import {
  Business as PlantIcon,
  FlightTakeoff as AirportIcon,
  Source as SourceIcon
} from '@mui/icons-material';

interface PlantCode {
  id: number;
  code: string;
  name: string;
  location: string;
}

interface AirportCode {
  id: number;
  code: string;
  name: string;
  city: string;
  country: string;
  latitude: string;
  longitude: string;
}

interface DataSource {
  id: number;
  name: string;
  source_type: string;
  is_active: boolean;
}

export const DataSources: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [plants, setPlants] = useState<PlantCode[]>([]);
  const [airports, setAirports] = useState<AirportCode[]>([]);
  const [sources, setSources] = useState<DataSource[]>([]);
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [plantsRes, airportsRes, sourcesRes] = await Promise.all([
          api.get('plants/'),
          api.get('airports/'),
          api.get('sources/')
        ]);
        
        setPlants(plantsRes.data.results || plantsRes.data);
        setAirports(airportsRes.data.results || airportsRes.data);
        setSources(sourcesRes.data.results || sourcesRes.data);
      } catch (err) {
        console.error("Failed to load reference data", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>
          Reference Directories & Sources
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Manage Plant Code tables, Global Airport lookups, and configured Ingestion pipelines.
        </Typography>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 1, pb: '8px !important' }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            indicatorColor="primary"
            textColor="primary"
            variant="fullWidth"
          >
            <Tab icon={<SourceIcon />} label="Ingestion Sources" iconPosition="start" />
            <Tab icon={<PlantIcon />} label="Plant Code Directory" iconPosition="start" />
            <Tab icon={<AirportIcon />} label="Airport Coordinates Lookup" iconPosition="start" />
          </Tabs>
        </CardContent>
      </Card>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box>
          {/* Tab 0: Sources */}
          {tabValue === 0 && (
            <Grid container spacing={3}>
              {sources.map((src) => (
                <Grid item xs={12} sm={6} md={4} key={src.id}>
                  <Card>
                    <CardContent sx={{ p: 3 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                          {src.name}
                        </Typography>
                        <Chip
                          label={src.is_active ? 'Active' : 'Inactive'}
                          color={src.is_active ? 'success' : 'default'}
                          size="small"
                        />
                      </Stack>
                      <Divider sx={{ mb: 2 }} />
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                          Ingestion Schema
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 600 }}>
                          {src.source_type === 'SAP' && 'SAP Fuel Data (Scope 1)'}
                          {src.source_type === 'UTILITY' && 'Utility Electricity Invoices (Scope 2)'}
                          {src.source_type === 'TRAVEL' && 'Corporate Travel Concur Exports (Scope 3)'}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}

          {/* Tab 1: Plants */}
          {tabValue === 1 && (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Plant Code (WERK)</TableCell>
                    <TableCell>Description / Plant Name</TableCell>
                    <TableCell>Region / Location</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {plants.map((plant) => (
                    <TableRow key={plant.id} hover>
                      <TableCell sx={{ fontWeight: 700, color: 'primary.light' }}>{plant.code}</TableCell>
                      <TableCell>{plant.name}</TableCell>
                      <TableCell>{plant.location || 'N/A'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Tab 2: Airports */}
          {tabValue === 2 && (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>IATA Code</TableCell>
                    <TableCell>Airport Name</TableCell>
                    <TableCell>City</TableCell>
                    <TableCell>Country</TableCell>
                    <TableCell align="right">Latitude</TableCell>
                    <TableCell align="right">Longitude</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {airports.map((ap) => (
                    <TableRow key={ap.id} hover>
                      <TableCell sx={{ fontWeight: 700, color: 'secondary.light' }}>{ap.code}</TableCell>
                      <TableCell>{ap.name}</TableCell>
                      <TableCell>{ap.city}</TableCell>
                      <TableCell>{ap.country}</TableCell>
                      <TableCell align="right">{ap.latitude}</TableCell>
                      <TableCell align="right">{ap.longitude}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}
    </Box>
  );
};
export default DataSources;
