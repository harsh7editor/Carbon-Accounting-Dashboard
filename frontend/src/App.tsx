import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { theme } from './theme';
import { AuthProvider, useAuth } from './context/AuthContext';

// Components & Shell
import { DashboardLayout } from './components/DashboardLayout';

// Pages
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { UploadCenter } from './pages/UploadCenter';
import { ReviewQueue } from './pages/ReviewQueue';
import { RecordDetails } from './pages/RecordDetails';
import { AuditTrail } from './pages/AuditTrail';
import { DataSources } from './pages/DataSources';
import { Settings } from './pages/Settings';

const queryClient = new QueryClient();

const PrivateRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) return null; // Or show loading spinner
  
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <AuthProvider>
          <Router>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* Private routes wrapper */}
              <Route
                path="/"
                element={
                  <PrivateRoute>
                    <DashboardLayout />
                  </PrivateRoute>
                }
              >
                <Route index element={<Dashboard />} />
                <Route path="upload" element={<UploadCenter />} />
                <Route path="review" element={<ReviewQueue />} />
                <Route path="records/:id" element={<RecordDetails />} />
                <Route path="audit" element={<AuditTrail />} />
                <Route path="sources" element={<DataSources />} />
                <Route path="settings" element={<Settings />} />
              </Route>
              
              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
