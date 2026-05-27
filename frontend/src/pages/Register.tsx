import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import {
  Box, Card, CardContent, TextField, Button,
  Typography, Container, Alert, InputAdornment, IconButton,
  MenuItem,
} from '@mui/material';
import {
  Visibility, VisibilityOff, LockOutlined,
  EmailOutlined, BusinessOutlined, PersonOutlined,
} from '@mui/icons-material';

interface TenantOption {
  id: number;
  name: string;
}

export const Register: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadTenants = async () => {
      try {
        const response = await api.get('auth/tenants/');
        setTenants(response.data);
        if (response.data.length === 1) {
          setTenantId(String(response.data[0].id));
        }
      } catch {
        setError('Could not load organizations. Is the API server running?');
      }
    };
    loadTenants();
  }, []);

  const parseApiError = (err: unknown): string => {
    const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data;
    if (!data) return 'Registration failed. Please try again.';
    if (typeof data.detail === 'string') return data.detail;
    const messages: string[] = [];
    for (const [key, value] of Object.entries(data)) {
      if (Array.isArray(value)) {
        messages.push(`${key}: ${value.join(' ')}`);
      } else if (typeof value === 'string') {
        messages.push(value);
      }
    }
    return messages.length > 0 ? messages.join(' ') : 'Registration failed. Please try again.';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !passwordConfirm || !firstName || !lastName || !tenantId) {
      setError('Please fill in all fields');
      return;
    }
    if (password !== passwordConfirm) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await register({
        email,
        password,
        password_confirm: passwordConfirm,
        first_name: firstName,
        last_name: lastName,
        tenant: Number(tenantId),
      });
      navigate('/');
    } catch (err: unknown) {
      setError(parseApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        py: 4,
        background: 'radial-gradient(circle at 10% 20%, rgba(16, 185, 129, 0.08) 0%, rgba(0, 0, 0, 0) 40%), radial-gradient(circle at 90% 80%, rgba(6, 182, 212, 0.08) 0%, rgba(0, 0, 0, 0) 40%), #0b0f19',
      }}
    >
      <Container maxWidth="sm">
        <Card sx={{ p: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
              <Box
                sx={{
                  width: 52,
                  height: 52,
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 1.5,
                  boxShadow: '0 8px 16px rgba(16, 185, 129, 0.2)',
                }}
              >
                <BusinessOutlined sx={{ color: '#0f172a', fontSize: 28 }} />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 800, textAlign: 'center', mb: 0.5 }}>
                Create Account
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                Join your organization on CarbonSense
              </Typography>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 3, borderRadius: '8px' }}>
                {error}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit} noValidate>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  label="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonOutlined sx={{ color: 'text.secondary' }} />
                      </InputAdornment>
                    ),
                  }}
                />
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  label="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </Box>

              <TextField
                margin="normal"
                required
                fullWidth
                label="Corporate Email Address"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailOutlined sx={{ color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                }}
              />

              <TextField
                margin="normal"
                required
                fullWidth
                select
                label="Organization"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                disabled={tenants.length === 0}
                helperText={tenants.length === 0 ? 'No organizations available' : undefined}
              >
                {tenants.map((t) => (
                  <MenuItem key={t.id} value={String(t.id)}>
                    {t.name}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                margin="normal"
                required
                fullWidth
                label="Password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                helperText="At least 8 characters"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockOutlined sx={{ color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <TextField
                margin="normal"
                required
                fullWidth
                label="Confirm Password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockOutlined sx={{ color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                }}
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                disabled={submitting || tenants.length === 0}
                sx={{ mt: 3, mb: 2, py: 1.25 }}
              >
                {submitting ? 'Creating account...' : 'Create Account'}
              </Button>
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color: '#10b981', textDecoration: 'none', fontWeight: 600 }}>
                Sign in
              </Link>
            </Typography>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};
