import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Alert,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Divider
} from '@mui/material';
import {
  Warning,
  LocalHospital,
  AccessTime,
  Lock,
  Emergency as EmergencyIcon
} from '@mui/icons-material';
import axios from 'axios';

const API_URL = 'http://localhost:3000/api';

function EmergencyView() {
  const [formData, setFormData] = useState({
    doctorId: '',
    patientId: '',
    reason: ''
  });

  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [auditInfo, setAuditInfo] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [error, setError] = useState('');

  const privacyLevelInfo = {
    '1': { label: 'Emergency', color: 'success' },
    '2': { label: 'General', color: 'info' },
    '3': { label: 'Sensitive', color: 'warning' },
    '4': { label: 'Highly Sensitive', color: 'error' }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setConfirmDialog(true);
  };

  const handleConfirmedAccess = async () => {
    setConfirmDialog(false);
    setLoading(true);
    setError('');

    try {
      // First, break the glass
      const breakGlassResponse = await axios.post(`${API_URL}/doctor/break-glass`, formData);
      setAuditInfo(breakGlassResponse.data.audit);

      // Then query all records with emergency access
      const recordsResponse = await axios.get(`${API_URL}/patient/${formData.patientId}`, {
        params: {
          requesterId: formData.doctorId,
          requesterRole: 'EMERGENCY'
        }
      });

      setRecords(recordsResponse.data.data);
    } catch (error) {
      setError(error.response?.data?.error || 'Error accessing emergency records');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Alert severity="error" sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
          <Warning sx={{ mr: 1 }} /> Emergency Access Protocol
        </Typography>
        <Typography variant="body2">
          This is for genuine medical emergencies only. All access will be logged, audited, and reported.
          Misuse will result in immediate revocation of access privileges and potential legal action.
        </Typography>
      </Alert>

      {/* Emergency Access Form - Modified Layout */}
      <Paper elevation={3} sx={{ p: 3, border: '2px solid #f44336', mb: 3 }}>
        <Typography variant="h5" gutterBottom sx={{ color: 'error.main', display: 'flex', alignItems: 'center' }}>
          <EmergencyIcon sx={{ mr: 1 }} /> Break-Glass Protocol
        </Typography>

        <form onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Emergency Personnel ID"
                value={formData.doctorId}
                onChange={(e) => setFormData({ ...formData, doctorId: e.target.value })}
                required
                placeholder="ER_DOCTOR001"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Patient ID"
                value={formData.patientId}
                onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
                required
                placeholder="PATIENT001"
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Emergency Reason"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                required
                placeholder="Patient unconscious after motor vehicle accident. Need immediate access to blood type, allergies, and current medications for emergency surgery..."
              />
            </Grid>

            <Grid item xs={12} sm={6} display="flex" alignItems="center" justifyContent="flex-end">
              <Button
                type="submit"
                variant="contained"
                color="error"
                fullWidth
                size="large"
                startIcon={<Lock />}
                disabled={loading}
              >
                BREAK GLASS - Emergency Access
              </Button>
            </Grid>
          </Grid>
        </form>
      </Paper>

      {/* Audit Information - Horizontal Layout */}
      {auditInfo && (
        <Paper elevation={3} sx={{ p: 3, bgcolor: 'error.light', color: 'white', mb: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
            <LocalHospital sx={{ mr: 1 }} /> Emergency Access Granted
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={6} md={3}>
              <Typography variant="subtitle2" sx={{ opacity: 0.9 }}>Access ID</Typography>
              <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                {auditInfo.doctorId} → {auditInfo.patientId}
              </Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="subtitle2" sx={{ opacity: 0.9 }}>Timestamp</Typography>
              <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                {new Date(auditInfo.timestamp).toLocaleString()}
              </Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="subtitle2" sx={{ opacity: 0.9 }}>Access Expires</Typography>
              <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                {new Date(auditInfo.expiresAt).toLocaleString()}
              </Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="subtitle2" sx={{ opacity: 0.9 }}>Reason</Typography>
              <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                {auditInfo.reason}
              </Typography>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
      )}

      {/* Emergency Records */}
      {records.length > 0 && (
        <Paper elevation={3} sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom sx={{ color: 'error.main' }}>
            🚨 Emergency Access - All Patient Records ({records.length} total)
          </Typography>

          <Grid container spacing={2}>
            {records.map((record, index) => (
              <Grid item xs={12} md={6} key={index}>
                <Card
                  variant="outlined"
                  sx={{
                    border: `2px solid ${record.privacyLevel >= '3' ? '#f44336' : '#2196f3'}`,
                    bgcolor: record.privacyLevel >= '3' ? 'error.light' : 'background.paper'
                  }}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="h6">
                        {record.dataType}
                      </Typography>
                      <Chip
                        icon={<Lock />}
                        label={privacyLevelInfo[record.privacyLevel].label}
                        color={privacyLevelInfo[record.privacyLevel].color}
                        size="small"
                      />
                    </Box>
                    <Typography variant="body1" sx={{ mb: 1, fontWeight: 'bold' }}>
                      {record.data}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      <AccessTime sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
                      {new Date(record.timestamp).toLocaleString()}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog} onClose={() => setConfirmDialog(false)}>
        <DialogTitle sx={{ bgcolor: 'error.main', color: 'white' }}>
          ⚠️ Confirm Emergency Access
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <DialogContentText>
            You are about to activate the Break-Glass Protocol for emergency access to ALL patient records,
            including highly sensitive Level 4 data.
            <br /><br />
            This action will be permanently logged and audited. Confirm that this is a genuine medical emergency.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog(false)} color="primary">
            Cancel
          </Button>
          <Button
            onClick={handleConfirmedAccess}
            color="error"
            variant="contained"
            startIcon={loading ? <CircularProgress size={20} /> : <Lock />}
            disabled={loading}
          >
            {loading ? 'Accessing...' : 'Confirm Emergency Access'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default EmergencyView;