import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  RadioGroup,
  FormControlLabel,
  Radio,
  Alert,
  Snackbar,
  Grid,
  Chip
} from '@mui/material';
import { Add, Security, CheckCircle } from '@mui/icons-material';
import axios from 'axios';

const API_URL = 'http://localhost:3000/api';

// Privacy level configuration
const privacyLevels = [
  { value: '1', label: 'Emergency', color: 'success', description: 'Always accessible (Blood type, Allergies)' },
  { value: '2', label: 'General', color: 'info', description: 'Doctor accessible (Conditions, Medications)' },
  { value: '3', label: 'Sensitive', color: 'warning', description: 'Requires consent (Mental health, Reproductive)' },
  { value: '4', label: 'Highly Sensitive', color: 'error', description: 'Maximum protection (HIV, Substance abuse)' }
];

const dataTypePrivacyMap = {
  BloodType: '1', // Emergency
  Allergies: '1',
  Medications: '2', // General
  ChronicConditions: '2',
  MentalHealth: '3', // Sensitive
  HIV_Status: '4', // Highly Sensitive
  SubstanceAbuse: '4',
};

function PatientView() {
  const [formData, setFormData] = useState({
    patientId: 'PATIENT001',
    dataType: '',
    data: '',
    privacyLevel: '2'
  });
  
  const [consentData, setConsentData] = useState({
    granteeId: '',
    dataType: ''
  });
  
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API_URL}/patient/add`, formData);
      setSnackbar({ 
        open: true, 
        message: 'Medical record added successfully!', 
        severity: 'success' 
      });
      // Reset form
      setFormData({ ...formData, data: '', dataType: '' });
    } catch (error) {
      setSnackbar({ 
        open: true, 
        message: error.response?.data?.error || 'Error adding record', 
        severity: 'error' 
      });
    }
  };

  const handleConsentSubmit = async (e) => {
    e.preventDefault();
    let milliOffset = 0;
    switch(consentData.expiryDate) {
      case '1 hour':
        milliOffset = 60 * 60 * 1000; // 1 hour in ms
        break;
      case '24 hours':
        milliOffset = 24 * 60 * 60 * 1000; // 24 hours in ms
        break;
      case '7 days':
        milliOffset = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
        break;
      case '30 days':
        milliOffset = 30 * 24 * 60 * 60 * 1000; // 30 days in ms
        break;
      default:
        milliOffset = 60 * 60 * 1000; // fallback to 1 hour
    }
    try {
      const response = await axios.post(`${API_URL}/patient/consent`, {
        patientId: formData.patientId,
        ...consentData,
        expiryDate: new Date(Date.now() + milliOffset).toISOString()
      });
      setSnackbar({ 
        open: true, 
        message: 'Consent granted successfully!', 
        severity: 'success' 
      });
      setConsentData({ granteeId: '', dataType: '' });
    } catch (error) {
      setSnackbar({ 
        open: true, 
        message: error.response?.data?.error || 'Error granting consent', 
        severity: 'error' 
      });
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Patient Data Management
      </Typography>

      <Grid container spacing={3} justifyContent="center">
        {/* Add Medical Record */}
        <Grid item xs={12} md={8}>
          <Paper elevation={3} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              <Add sx={{ mr: 1 }} /> Add Medical Record
            </Typography>
            
            <form onSubmit={handleSubmit}>
              <Grid container spacing={2} >
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Patient ID"
                    value={formData.patientId}
                    onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
                    required
                    sx={{ minWidth: 350 }}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth required sx={{ minWidth: 350 }}>
                    <InputLabel>Data Type</InputLabel>
                    <Select
                      label="Data Type"
                      value={formData.dataType}
                      onChange={(e) => {
                                const val = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  dataType: val,
                                  privacyLevel: dataTypePrivacyMap[val] || prev.privacyLevel,
                                }));
                              }}
                    >
                      <MenuItem value="BloodType">Blood Type</MenuItem>
                      <MenuItem value="Allergies">Allergies</MenuItem>
                      <MenuItem value="Medications">Medications</MenuItem>
                      <MenuItem value="ChronicConditions">Chronic Conditions</MenuItem>
                      <MenuItem value="MentalHealth">Mental Health</MenuItem>
                      <MenuItem value="ReproductiveHealth">Reproductive Health</MenuItem>
                      <MenuItem value="HIV_Status">HIV Status</MenuItem>
                      <MenuItem value="SubstanceAbuse">Substance Abuse History</MenuItem>

                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Medical Data"
                    multiline
                    rows={3}
                    value={formData.data}
                    onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                    required
                    sx={{ minWidth: 350 }}
                  />
                </Grid>
                <Grid item xs={12} sx={{ mt: 2 }}>
                  <Typography variant="subtitle1" sx={{ mb: 1 }}>
                    <Security sx={{ verticalAlign: 'middle', mr: 1 }} />
                    Privacy Level
                  </Typography>
                  <RadioGroup
                    value={formData.privacyLevel}
                    onChange={(e) => setFormData({ ...formData, privacyLevel: e.target.value })}
                  >
                    {privacyLevels.map((level) => (
                      <FormControlLabel
                        key={level.value}
                        value={level.value}
                        control={<Radio />}
                        label={
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Chip 
                              label={level.label} 
                              color={level.color} 
                              size="small" 
                              sx={{ mr: 1 }}
                            />
                            <Typography variant="body2">{level.description}</Typography>
                          </Box>
                        }
                      />
                    ))}
                  </RadioGroup>
                </Grid>
              </Grid>
              <Grid item xs={12} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', mt: 2 }}>
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    startIcon={<CheckCircle />}
                    sx={{ whiteSpace: 'nowrap', minWidth: 350 }}
                  >
                    Add Medical Record
                  </Button>
              </Grid>

              
            </form>
          </Paper>
        </Grid>

        {/* Grant Consent */}
        <Grid item xs={12} md={8}>
          <Paper elevation={3} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Grant Consent
            </Typography>
            
            <form onSubmit={handleConsentSubmit}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    label="Doctor/Provider ID"
                    placeholder="DOCTOR001"
                    value={consentData.granteeId}
                    onChange={(e) => setConsentData({ ...consentData, granteeId: e.target.value })}
                    required
                    sx={{ minWidth: 360 }}
                  />
                </Grid>
                
                <Grid item xs={12} sm={3}>
                  <FormControl fullWidth required sx={{ minWidth: 355 }}>
                    <InputLabel>Data Type</InputLabel>
                    <Select
                      label="Data Type"
                      value={consentData.dataType}
                      onChange={(e) => setConsentData({ ...consentData, dataType: e.target.value })}
                    >
                      <MenuItem value="BloodType">Blood Type</MenuItem>
                      <MenuItem value="Allergies">Allergies</MenuItem>
                      <MenuItem value="Medications">Medications</MenuItem>
                      <MenuItem value="ChronicConditions">Chronic Conditions</MenuItem>
                      <MenuItem value="MentalHealth">Mental Health</MenuItem>
                      <MenuItem value="ReproductiveHealth">Reproductive Health</MenuItem>
                      <MenuItem value="HIV_Status">HIV Status</MenuItem>
                      <MenuItem value="SubstanceAbuse">Substance Abuse History</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={3}>
                  <FormControl fullWidth required sx={{ minWidth: 355 }}>
                    <InputLabel>Expiry</InputLabel>
                    <Select
                      label="Expiry"
                      value={consentData.expiryDate}
                      onChange={(e) => setConsentData({ ...consentData, expiryDate: e.target.value })}
                    >
                      <MenuItem value="1 hour">1 hour</MenuItem>
                      <MenuItem value="24 hours">24 hours</MenuItem>
                      <MenuItem value="7 days">7 days</MenuItem>
                      <MenuItem value="30 days">30 days</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                
                
              </Grid>
              <Grid item xs={12} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', mt: 2 }}>
                  <Button 
                    type="submit" 
                    variant="contained" 
                    color="secondary"
                    sx={{ whiteSpace: 'nowrap', minWidth: 350 }}
                  >
                    Grant Access
                  </Button>
                </Grid>
            </form>
          </Paper>
        </Grid>
      </Grid>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default PatientView;