import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#10b981', // Emerald green
      light: '#34d399',
      dark: '#059669',
      contrastText: '#0f172a',
    },
    secondary: {
      main: '#06b6d4', // Cyan
      light: '#22d3ee',
      dark: '#0891b2',
      contrastText: '#0f172a',
    },
    background: {
      default: '#0b0f19', // Very dark slate
      paper: '#1e293b',   // Slate gray
    },
    text: {
      primary: '#f8fafc',
      secondary: '#94a3b8',
    },
    divider: 'rgba(148, 163, 184, 0.1)',
    error: {
      main: '#f43f5e', // Rose
    },
    warning: {
      main: '#f59e0b', // Amber
    },
    info: {
      main: '#3b82f6', // Blue
    },
    success: {
      main: '#10b981',
    },
  },
  typography: {
    fontFamily: '"Outfit", "Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 700,
      letterSpacing: '-0.02em',
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 600,
      letterSpacing: '-0.01em',
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 600,
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 600,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 600,
    },
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
          padding: '8px 16px',
          fontWeight: 600,
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            transform: 'translateY(-1px)',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.15)',
          },
          '&.MuiButton-containedPrimary': {
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: '#0f172a',
            '&:hover': {
              background: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
            },
          },
        },

      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: 'rgba(30, 41, 59, 0.7)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(148, 163, 184, 0.1)',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
          transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 12px 20px -3px rgba(0, 0, 0, 0.4), 0 0 1px 1px rgba(16, 185, 129, 0.2)',
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(11, 15, 25, 0.8)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
          boxShadow: 'none',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#0b0f19',
          borderRight: '1px solid rgba(148, 163, 184, 0.1)',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          backgroundColor: 'rgba(15, 23, 42, 0.8)',
          color: '#94a3b8',
          fontWeight: 600,
        },
        root: {
          borderBottom: '1px solid rgba(148, 163, 184, 0.05)',
        },
      },
    },
  },
});
