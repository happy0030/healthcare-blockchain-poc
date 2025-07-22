const express = require('express');
const router = express.Router();

// Break glass access
router.post('/break-glass', async (req, res) => {
    try {
        const { doctorId, patientId, reason } = req.body;
        
        if (!doctorId || !patientId || !reason) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const contract = req.app.locals.contract;
        const result = await contract.submitTransaction('BreakGlassAccess', doctorId, patientId, reason);
        
        res.json({ 
            success: true, 
            message: 'Break-glass access granted',
            audit: JSON.parse(result.toString())
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// Initialize ledger (admin function)
router.post('/init-ledger', async (req, res) => {
    try {
        const contract = req.app.locals.contract;
        const result = await contract.submitTransaction('InitLedger');
        
        res.json({ 
            success: true, 
            message: 'Ledger initialized successfully',
            result: result.toString()
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
