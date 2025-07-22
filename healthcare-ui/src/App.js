import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  Container, 
  Box, 
  Button,
  CssBaseline 
} from '@mui/material';
import { 
  LocalHospital, 
  PersonAdd, 
  Emergency,
  MedicalServices,
  Dashboard as DashboardIcon,
  Security 
} from '@mui/icons-material';

// Import components
import PatientView from './components/Patient/PatientView';
import DoctorView from './components/Doctor/DoctorView';
import EmergencyView from './components/Emergency/EmergencyView';
import Dashboard from './components/Dashboard/Dashboard';

// Create theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#2196f3',
    },
    secondary: {
      main: '#4caf50',
    },
    error: {
      main: '#f44336',
    },
    warning: {
      main: '#ff9800',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Arial", sans-serif',
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Box sx={{ flexGrow: 1 }}>
          <AppBar position="static">
            <Toolbar>
              <LocalHospital sx={{ mr: 2 }} />
              <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                Healthcare Blockchain - Privacy Control System
              </Typography>
              <Button 
                color="inherit" 
                component={Link} 
                to="/dashboard"
                startIcon={<DashboardIcon />}
              >
                Dashboard
              </Button>
              <Button 
                color="inherit" 
                component={Link} 
                to="/"
                startIcon={<PersonAdd />}
              >
                Patient
              </Button>
              <Button 
                color="inherit" 
                component={Link} 
                to="/doctor"
                startIcon={<MedicalServices />}
              >
                Doctor
              </Button>
              <Button 
                color="inherit" 
                component={Link} 
                to="/emergency"
                startIcon={<Emergency />}
                sx={{ 
                  ml: 2,
                  backgroundColor: 'error.main',
                  '&:hover': {
                    backgroundColor: 'error.dark',
                  }
                }}
              >
                Emergency
              </Button>
            </Toolbar>
          </AppBar>

          <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Routes>
              <Route path="/" element={<PatientView />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/doctor" element={<DoctorView />} />
              <Route path="/emergency" element={<EmergencyView />} />
            </Routes>
          </Container>
        </Box>
      </Router>
    </ThemeProvider>
  );
}

export default App;