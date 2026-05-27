import React, { useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  AppBar, Box, CssBaseline, Divider, Drawer, IconButton,
  List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Toolbar, Typography, Button, Avatar, Chip
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  CloudUpload as UploadIcon,
  RateReview as ReviewIcon,
  History as AuditIcon,
  Settings as SettingsIcon,
  Source as SourceIcon,
  Logout as LogoutIcon,
  Business as BusinessIcon
} from '@mui/icons-material';

const drawerWidth = 260;

export const DashboardLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const userInitial =
    user?.first_name?.trim()?.charAt(0) ||
    user?.username?.trim()?.charAt(0) ||
    'U';

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
    { text: 'Upload Center', icon: <UploadIcon />, path: '/upload' },
    { text: 'Review Queue', icon: <ReviewIcon />, path: '/review' },
    { text: 'Audit Trail', icon: <AuditIcon />, path: '/audit' },
    { text: 'Data Sources', icon: <SourceIcon />, path: '/sources' },
    { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
  ];

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar sx={{ px: [2], display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, py: 1 }}>
        <BusinessIcon sx={{ color: 'primary.main', fontSize: 28 }} />
        <Typography variant="h6" sx={{ fontWeight: 800, background: 'linear-gradient(90deg, #10b981, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          CARBONSENSE
        </Typography>
      </Toolbar>
      <Divider />
      
      {/* Active User Section */}
      <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <Avatar sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', width: 56, height: 56, mb: 1, fontWeight: 700 }}>
          {userInitial.toUpperCase()}
        </Avatar>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'text.primary' }}>
          {user?.first_name} {user?.last_name}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1.5 }}>
          {user?.role === 'ADMIN' ? 'Compliance Admin' : 'Sustainability Analyst'}
        </Typography>
        <Chip 
          label={user?.tenant_name || 'Global Admin'} 
          color="secondary" 
          variant="outlined" 
          size="small"
          icon={<BusinessIcon style={{ fontSize: 14 }} />}
          sx={{ maxWidth: '100%', borderColor: 'rgba(6, 182, 212, 0.4)' }}
        />
      </Box>
      <Divider sx={{ mb: 1 }} />
      
      {/* Navigation Links */}
      <List sx={{ px: 1.5, flexGrow: 1 }}>
        {menuItems.map((item) => {
          const isSelected = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => {
                  navigate(item.path);
                  setMobileOpen(false);
                }}
                sx={{
                  borderRadius: '8px',
                  backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
                  color: isSelected ? 'primary.main' : 'text.secondary',
                  '&:hover': {
                    backgroundColor: 'rgba(16, 185, 129, 0.04)',
                    color: 'text.primary',
                    '& .MuiListItemIcon-root': { color: 'text.primary' },
                  },
                }}
              >
                <ListItemIcon sx={{ color: isSelected ? 'primary.main' : 'text.secondary', minWidth: 40 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.text} primaryTypographyProps={{ fontSize: 14, fontWeight: isSelected ? 600 : 500 }} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider />
      
      {/* Logout button */}
      <Box sx={{ p: 2 }}>
        <Button
          fullWidth
          variant="outlined"
          color="error"
          startIcon={<LogoutIcon />}
          onClick={logout}
          sx={{ borderColor: 'rgba(244, 63, 94, 0.2)', '&:hover': { borderColor: 'error.main', backgroundColor: 'rgba(244, 63, 94, 0.05)' } }}
        >
          Sign Out
        </Button>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <CssBaseline />
      
      {/* Top Navbar */}
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body1" sx={{ color: 'text.secondary', display: { xs: 'none', sm: 'block' } }}>
              Active Tenant:
            </Typography>
            <Chip 
              label={user?.tenant_name || 'Global Admin'} 
              color="primary" 
              size="small"
              sx={{ fontWeight: 600 }}
            />
          </Box>
          
          <Box sx={{ flexGrow: 1 }} />
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', display: { xs: 'none', md: 'block' } }}>
              Last login: {new Date().toLocaleDateString()}
            </Typography>
            <Avatar sx={{ bgcolor: 'secondary.main', color: 'secondary.contrastText', width: 32, height: 32, fontSize: 14, fontWeight: 600 }}>
              {user?.username ? user.username[0].toUpperCase() : 'U'}
            </Avatar>
          </Box>
        </Toolbar>
      </AppBar>
      
      {/* Navigation Drawers */}
      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
      >
        {/* Mobile View Drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        
        {/* Desktop View Drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      
      {/* Content Container */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          mt: '64px',
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
};
