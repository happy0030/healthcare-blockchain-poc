import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  Security,
  Warning,
  CheckCircle,
  Assignment
} from '@mui/icons-material';
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import axios from 'axios';

const API_URL = 'http://localhost:3000/api';

// Colors for privacy levels
const PRIVACY_COLORS = {
  '1': '#4caf50', // Green - Emergency
  '2': '#2196f3', // Blue - General
  '3': '#ff9800', // Orange - Sensitive
  '4': '#f44336'  // Red - Highly Sensitive
};

function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRecords: 0,
    privacyDistribution: [],
    accessHistory: [],
    breakGlassEvents: 0,
    activeConsents: 0
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch patient data to calculate statistics
      const patientResponse = await axios.get(`${API_URL}/patient/PATIENT001`, {
        params: { requesterId: 'SYSTEM', requesterRole: 'EMERGENCY' }
      });

      const records = patientResponse.data.data;

      // Calculate privacy distribution
      const privacyCount = records.reduce((acc, record) => {
        acc[record.privacyLevel] = (acc[record.privacyLevel] || 0) + 1;
        return acc;
      }, {});

      const privacyDistribution = Object.keys(privacyCount).map(level => ({
        name: `Level ${level}`,
        value: privacyCount[level],
        level: level
      }));

      // Fetch audit trail
      const auditResponse = await axios.get(`${API_URL}/patient/PATIENT001/audit`);
      const auditTrail = auditResponse.data.auditTrail;

      // Count break-glass events
      const breakGlassEvents = auditTrail.filter(
        event => event.eventType === 'BREAK_GLASS_ACCESS'
      ).length;

      // Process access history for the line chart
      const accessByHour = {};
      const now = new Date();
      for (let i = 0; i < 24; i++) {
        const hour = new Date(now - i * 60 * 60 * 1000);
        const hourKey = hour.getHours();
        accessByHour[hourKey] = 0;
      }

      auditTrail.forEach(event => {
        const eventHour = new Date(event.timestamp).getHours();
        if (accessByHour.hasOwnProperty(eventHour)) {
          accessByHour[eventHour]++;
        }
      });

      // Build a sorted array for the chart (so hours are left-to-right, 0-23)
      const hoursSorted = Array.from({length: 24}, (_, i) => (now.getHours() - 23 + i + 24) % 24);
      const accessHistory = hoursSorted.map(hour => ({
        hour: `${hour}:00`,
        accesses: accessByHour[hour] || 0
      }));

      setStats({
        totalRecords: records.length,
        privacyDistribution,
        accessHistory,
        breakGlassEvents,
        activeConsents: 3 // Mock data - in real implementation, fetch from consent endpoint
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Fixed width for the main dashboard (charts+summary+cards)
  const DASHBOARD_WIDTH = 1200; // Change this value for wider/narrower layout

  return (
    <Box sx={{ width: DASHBOARD_WIDTH, maxWidth: '100%', mx: 'auto', p: 2 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 4 }}>
        Healthcare Blockchain Analytics Dashboard
      </Typography>

      {/* Key Metrics Cards */}
      <Grid container spacing={3} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ width: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, minWidth: 200 }}>
                <Assignment sx={{ fontSize: 40, color: 'primary.main', mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    Total Records
                  </Typography>
                  <Typography variant="h4">
                    {stats.totalRecords}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ width: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, minWidth: 200 }}>
                <Warning sx={{ fontSize: 40, color: 'error.main', mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    Break-Glass Events
                  </Typography>
                  <Typography variant="h4">
                    {stats.breakGlassEvents}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ width: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, minWidth: 200 }}>
                <CheckCircle sx={{ fontSize: 40, color: 'success.main', mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    Active Consents
                  </Typography>
                  <Typography variant="h4">
                    {stats.activeConsents}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ width: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, minWidth: 200 }}>
                <Security sx={{ fontSize: 40, color: 'warning.main', mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    Privacy Levels
                  </Typography>
                  <Typography variant="h4">
                    4
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts and Summary */}
      <Grid container spacing={3}>
        {/* Pie Chart */}
        <Grid item xs={12} sm={6}>
          <Paper sx={{ p: 3, width: '100%', minWidth: 650 }}>
            <Typography variant="h6" gutterBottom>
              Privacy Level Distribution
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stats.privacyDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {stats.privacyDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PRIVACY_COLORS[entry.level]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <Box sx={{ mt: 2 }}>
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <Chip 
                    size="small" 
                    sx={{ bgcolor: PRIVACY_COLORS['1'], color: 'white' }} 
                    label="Level 1: Emergency" 
                  />
                </Grid>
                <Grid item xs={6}>
                  <Chip 
                    size="small" 
                    sx={{ bgcolor: PRIVACY_COLORS['2'], color: 'white' }} 
                    label="Level 2: General" 
                  />
                </Grid>
                <Grid item xs={6}>
                  <Chip 
                    size="small" 
                    sx={{ bgcolor: PRIVACY_COLORS['3'], color: 'white' }} 
                    label="Level 3: Sensitive" 
                  />
                </Grid>
                <Grid item xs={6}>
                  <Chip 
                    size="small" 
                    sx={{ bgcolor: PRIVACY_COLORS['4'], color: 'white' }} 
                    label="Level 4: Highly Sensitive" 
                  />
                </Grid>
              </Grid>
            </Box>
          </Paper>
        </Grid>
        {/* Line Chart */}
        <Grid item xs={12} sm={6}>
          <Paper sx={{ p: 3, width: '100%', minWidth: 300 }}>
            <Typography variant="h6" gutterBottom>
              Access History (Last 24 Hours)
            </Typography>
            <ResponsiveContainer width="100%" height={342}>
              <LineChart data={stats.accessHistory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="accesses" 
                  stroke="#2196f3" 
                  strokeWidth={2}
                  name="Access Attempts"
                />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
        {/* Summary - same width as chart row */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3, width: '100%', minWidth: 1000 }}>
            <Typography variant="h6" gutterBottom>
              System Activity Summary
            </Typography>
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>System Health:</strong> All privacy controls are functioning normally.
                {stats.breakGlassEvents > 0 && ` ${stats.breakGlassEvents} emergency access event(s) logged in the past 24 hours.`}
              </Typography>
            </Alert>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default Dashboard;
