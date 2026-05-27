import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Box, Card, CardContent, TextField, Button,
  Typography, Container, Alert, InputAdornment, IconButton,
  Divider
} from '@mui/material';
import {
  Visibility, VisibilityOff, LockOutlined,
  EmailOutlined, BusinessOutlined
} from '@mui/icons-material';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please fill in all fields');
      return;
    }
    
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err: any) {
      setError(
        err.response?.data?.detail || 
        'Invalid credentials. Please verify your email and password.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickLogin = async (userType: 'analyst' | 'admin') => {
    setError(null);
    setSubmitting(true);
    const email = userType === 'analyst' ? 'analyst@ecocorp.com' : 'admin@ecocorp.com';
    const pwd = 'password123';
    
    try {
      await login(email, pwd);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Quick login failed');
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
                  boxShadow: '0 8px 16px rgba(16, 185, 129, 0.2)'
                }}
              >
                <BusinessOutlined sx={{ color: '#0f172a', fontSize: 28 }} />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 800, textAlign: 'center', mb: 0.5 }}>
                CarbonSense
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                Sustainability Data Normalization & Review Portal
              </Typography>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 3, borderRadius: '8px' }}>
                {error}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit} noValidate>
              <TextField
                margin="normal"
                required
                fullWidth
                id="username"
                label="Corporate Email Address"
                name="username"
                autoComplete="email"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
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
                name="password"
                label="Password"
                type={showPassword ? 'text' : 'password'}
                id="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
              
              <Button
                type="submit"
                fullWidth
                variant="contained"
                disabled={submitting}
                sx={{ mt: 3, mb: 1, py: 1.25 }}
              >
                {submitting ? 'Authenticating...' : 'Sign In'}
              </Button>

              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mb: 2 }}>
                Don&apos;t have an account?{' '}
                <Link to="/register" style={{ color: '#10b981', textDecoration: 'none', fontWeight: 600 }}>
                  Create one
                </Link>
              </Typography>
            </Box>

            <Divider sx={{ my: 3 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', px: 1 }}>
                DEVELOPER QUICK LOGIN
              </Typography>
            </Divider>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                fullWidth
                variant="outlined"
                color="primary"
                onClick={() => handleQuickLogin('analyst')}
                disabled={submitting}
              >
                EcoCorp Analyst
              </Button>
              <Button
                fullWidth
                variant="outlined"
                color="secondary"
                onClick={() => handleQuickLogin('admin')}
                disabled={submitting}
              >
                EcoCorp Admin
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};
