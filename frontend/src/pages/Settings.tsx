import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Box, Card, CardContent, Typography, TextField,
  Button, Divider, Alert, Stack, Switch, FormControlLabel, Chip
} from '@mui/material';
import {
  Save as SaveIcon,
  Settings as SettingsIcon,
  Business as TenantIcon,
  Person as UserIcon
} from '@mui/icons-material';

export const Settings: React.FC = () => {
  const { user } = useAuth();
  
  // Custom thresholds mock setting
  const [fuelLimit, setFuelLimit] = useState('100000');
  const [kwhLimit, setKwhLimit] = useState('50000');
  const [autoApproveValids, setAutoApproveValids] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>
          Portal Settings
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Configure Tenant compliance limits, rulesets, and review active user profile details.
        </Typography>
      </Box>

      {saved && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Settings updated successfully! Compliance rules are immediately updated.
        </Alert>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3.5 }}>
        {/* Tenant Configuration */}
        <Box>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                <SettingsIcon sx={{ color: 'primary.main' }} />
                Validation Rulesets
              </Typography>
              
              <Box component="form" onSubmit={handleSave}>
                <Stack spacing={3}>
                  <TextField
                    label="Fuel Quantity Suspect Limit (Liters)"
                    type="number"
                    value={fuelLimit}
                    onChange={(e) => setFuelLimit(e.target.value)}
                    helperText="Ingestion values exceeding this quantity will be flagged as SUSPICIOUS."
                    fullWidth
                  />

                  <TextField
                    label="Electricity Consumption Spike Limit (kWh)"
                    type="number"
                    value={kwhLimit}
                    onChange={(e) => setKwhLimit(e.target.value)}
                    helperText="Utility logs with values above this threshold will flag for review."
                    fullWidth
                  />

                  <Divider />
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={autoApproveValids}
                        onChange={(e) => setAutoApproveValids(e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Auto-Approve Completely Valid Records"
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: -1.5, display: 'block' }}>
                    If enabled, records passing all plant and threshold tests bypass the review queue.
                  </Typography>

                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={<SaveIcon />}
                    sx={{ alignSelf: 'flex-start', mt: 2 }}
                  >
                    Save Rulesets
                  </Button>
                </Stack>
              </Box>
            </CardContent>
          </Card>
        </Box>

        {/* User Info Details */}
        <Box>
          <Stack spacing={3.5}>
            {/* User card */}
            <Card>
              <CardContent sx={{ p: 4 }}>
                <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <UserIcon sx={{ color: 'secondary.main' }} />
                  Analyst Profile
                </Typography>
                
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Full Name</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>{user?.first_name} {user?.last_name}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Email Identifier</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>{user?.email}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Access Role Mapping</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      <Chip label={user?.role} size="small" color="secondary" />
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            {/* Tenant details */}
            <Card>
              <CardContent sx={{ p: 4 }}>
                <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TenantIcon sx={{ color: 'info.main' }} />
                  Tenant Information
                </Typography>
                
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Organization (Tenant Name)</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>{user?.tenant_name || 'Global Admin Scope'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Tenant Database ID</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>{user?.tenant || 'None (Global/Host)'}</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
};
export default Settings;

