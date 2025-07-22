const express = require('express');
const router = express.Router();

// Add patient data
router.post('/add', async (req, res) => {
    try {
        const { patientId, dataType, data, privacyLevel } = req.body;
        
        if (!patientId || !dataType || !data || !privacyLevel) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const contract = req.app.locals.contract;
        const result = await contract.submitTransaction('AddPatientData', patientId, dataType, data, privacyLevel);
        
        res.json({
            success: true,
            message: 'Patient data added successfully',
            result: JSON.parse(result.toString())
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// Query patient data
router.get('/:patientId', async (req, res) => {
    try {
        const { patientId } = req.params;
        const { requesterId, requesterRole } = req.query;
        
        if (!requesterId || !requesterRole) {
            return res.status(400).json({ error: 'Missing requesterId or requesterRole' });
        }

        const contract = req.app.locals.contract;
        const result = await contract.evaluateTransaction('QueryPatientData', patientId, requesterId, requesterRole);
        
        res.json({
            success: true,
            data: JSON.parse(result.toString())
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// Grant consent
router.post('/consent', async (req, res) => {
    try {
        const { patientId, granteeId, dataType, expiryDate } = req.body;
        
        if (!patientId || !granteeId || !dataType) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const contract = req.app.locals.contract;
        const result = await contract.submitTransaction('GrantConsent', patientId, granteeId, dataType, expiryDate || '');
        
        res.json({
            success: true,
            message: 'Consent granted successfully',
            result: JSON.parse(result.toString())
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// Get audit trail
router.get('/:patientId/audit', async (req, res) => {
    try {
        const { patientId } = req.params;
        
        const contract = req.app.locals.contract;
        const result = await contract.evaluateTransaction('GetAuditTrail', patientId);
        
        res.json({
            success: true,
            auditTrail: JSON.parse(result.toString())
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;