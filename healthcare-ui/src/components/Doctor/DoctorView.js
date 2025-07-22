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
  Grid,
  Card,
  CardContent,
  Chip,
  Divider,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Tooltip
} from '@mui/material';
import {
  Search,
  Lock,
  LockOpen,
  Person,
  AccessTime,
  Assignment,
  Block,
  CheckCircle
} from '@mui/icons-material';
import axios from 'axios';

const API_URL = 'http://localhost:3000/api';

function getRoleForDoctor(doctorId) {
  // This is for POC purpose. In production, role would be stored in blockchain layer.
  if (doctorId.startsWith('DOCTOR')) {
    return 'DOCTOR';
  } else if (doctorId.startsWith('ER_')) {
    return 'EMERGENCY_DOCTOR';
  } else if (doctorId.startsWith('NURSE')) {
    return 'NURSE';
  } else if (doctorId.startsWith('RESEARCHER')) {
    return 'RESEARCHER';
  } 
}

function DoctorView() {
  const [queryData, setQueryData] = useState({
    doctorId: 'DOCTOR001',
    patientId: 'PATIENT001',
    role: 'DOCTOR'
  });
  
  const [records, setRecords] = useState([]);
  const [auditTrail, setAuditTrail] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const privacyLevelInfo = {
    '1': { label: 'Emergency', color: 'success', icon: <LockOpen /> },
    '2': { label: 'General', color: 'info', icon: <LockOpen /> },
    '3': { label: 'Sensitive', color: 'warning', icon: <Lock /> },
    '4': { label: 'Highly Sensitive', color: 'error', icon: <Lock /> }
  };

  const handleQuery = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const role = getRoleForDoctor(queryData.doctorId);
      const response = await axios.get(`${API_URL}/patient/${queryData.patientId}`, {
        params: {
          requesterId: queryData.doctorId,
          requesterRole: role
        }
      });
      
      setRecords(response.data.data);
      
      const auditResponse = await axios.get(`${API_URL}/patient/${queryData.patientId}/audit`);
      setAuditTrail(auditResponse.data.auditTrail);
      
    } catch (error) {
      setError(error.response?.data?.error || 'Error fetching records');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Doctor Access Portal
      </Typography>

      <Grid container spacing={3}>
        {/* Query Form */}
        <Grid item xs={12}>
          <Paper elevation={3} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              <Search sx={{ mr: 1 }} /> Query Patient Records
            </Typography>
            
            <form onSubmit={handleQuery}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Doctor ID"
                    value={queryData.doctorId}
                    onChange={(e) => setQueryData({ ...queryData, doctorId: e.target.value })}
                    required
                  />
                </Grid>
                
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Patient ID"
                    value={queryData.patientId}
                    onChange={(e) => setQueryData({ ...queryData, patientId: e.target.value })}
                    required
                  />
                </Grid>
                
                <Grid item xs={12} sm={6} display="flex" alignItems="center" justifyContent="flex-end">
                  <Button 
                    type="submit" 
                    variant="contained" 
                    fullWidth 
                    size="large"
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={20} /> : <Search />}
                  >
                    {loading ? 'Querying...' : 'Query Records'}
                  </Button>
                </Grid>
              </Grid>
            </form>
          </Paper>
        </Grid>

        {/* Error Alert */}
        {error && (
          <Grid item xs={12}>
            <Alert severity="error">{error}</Alert>
          </Grid>
        )}

        {/* Access Summary */}
        {records.length > 0 && (
          <Grid item xs={12}>
            <Alert severity="info">
              Showing {records.filter(r => r.decrypted).length} of {records.length} records. 
              {records.filter(r => r.accessDenied).length > 0 && 
                ` ${records.filter(r => r.accessDenied).length} records require additional consent or emergency access.`
              }
            </Alert>
          </Grid>
        )}

        {/* Patient Records */}
        {records.length > 0 && (
          <Grid item xs={12} md={8}>
            <Paper elevation={3} sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Patient Records
              </Typography>
              
              <Grid container spacing={2}>
                {records.map((record, index) => (
                  <Grid item xs={12} key={index}>
                    <Card 
                      variant="outlined"
                      sx={{ 
                        borderLeft: `4px solid ${
                          record.accessDenied ? '#ccc' : 
                          privacyLevelInfo[record.privacyLevel].color === 'success' ? '#4caf50' :
                          privacyLevelInfo[record.privacyLevel].color === 'info' ? '#2196f3' :
                          privacyLevelInfo[record.privacyLevel].color === 'warning' ? '#ff9800' :
                          '#f44336'
                        }`
                      }}
                    >
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="h6">
                            {record.dataType}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            {record.decrypted ? (
                              <Tooltip title="Data decrypted successfully">
                                <Chip
                                  icon={<CheckCircle />}
                                  label="Decrypted"
                                  color="success"
                                  size="small"
                                />
                              </Tooltip>
                            ) : record.accessDenied ? (
                              <Tooltip title="Access denied - requires consent or higher privileges">
                                <Chip
                                  icon={<Block />}
                                  label="Access Denied"
                                  color="default"
                                  size="small"
                                />
                              </Tooltip>
                            ) : (
                              <Chip
                                icon={<Lock />}
                                label="Encrypted"
                                color="error"
                                size="small"
                              />
                            )}
                            <Chip
                              icon={privacyLevelInfo[record.privacyLevel].icon}
                              label={privacyLevelInfo[record.privacyLevel].label}
                              color={privacyLevelInfo[record.privacyLevel].color}
                              size="small"
                            />
                          </Box>
                        </Box>
                        
                        <Typography 
                          variant="body1" 
                          sx={{ 
                            mb: 1,
                            fontWeight: record.decrypted ? 'normal' : 'light',
                            fontStyle: record.accessDenied ? 'italic' : 'normal',
                            color: record.accessDenied ? 'text.secondary' : 'text.primary'
                          }}
                        >
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
          </Grid>
        )}

        {/* Audit Trail */}
        {auditTrail.length > 0 && (
          <Grid item xs={12} md={4}>
            <Paper elevation={3} sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                <Assignment sx={{ verticalAlign: 'middle', mr: 1 }} />
                Access Audit Trail
              </Typography>
              
              <List dense>
                {auditTrail.slice(0, 5).map((audit, index) => (
                  <React.Fragment key={index}>
                    <ListItem>
                      <ListItemIcon>
                        <Person />
                      </ListItemIcon>
                      <ListItemText
                        primary={`${audit.doctorId} (${audit.reason})`}
                        secondary={
                          <>
                            {audit.eventType === 'BREAK_GLASS_ACCESS' ? (
                              <Chip label="Emergency Access" color="error" size="small" />
                            ) : (
                              <>
                                Accessed: {audit.recordsAccessed || 0} | 
                                Denied: {audit.recordsDenied || 0}
                              </>
                            )}
                            <br />
                            {new Date(audit.timestamp).toLocaleString()}
                          </>
                        }
                      />
                    </ListItem>
                    {index < auditTrail.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}

export default DoctorView;