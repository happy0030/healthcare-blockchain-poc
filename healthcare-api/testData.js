const axios = require('axios');

const API_URL = 'http://localhost:3000/api';

async function populateTestData() {
    try {
        // Initialize ledger
        console.log('Initializing ledger...');
        await axios.post(`${API_URL}/doctor/init-ledger`);
        
        // Add patient data with different privacy levels
        const patientData = [
            { patientId: 'PATIENT001', dataType: 'BloodType', data: 'O+', privacyLevel: '1' },
            { patientId: 'PATIENT001', dataType: 'Allergies', data: 'Penicillin, Peanuts', privacyLevel: '1' },
            { patientId: 'PATIENT001', dataType: 'Diabetes', data: 'Type 2', privacyLevel: '2' },
            { patientId: 'PATIENT001', dataType: 'Medications', data: 'Metformin 500mg', privacyLevel: '2' },
            { patientId: 'PATIENT001', dataType: 'MentalHealth', data: 'Anxiety disorder', privacyLevel: '3' },
            { patientId: 'PATIENT001', dataType: 'HIV_Status', data: 'Negative', privacyLevel: '4' }
        ];

        for (const data of patientData) {
            console.log(`Adding ${data.dataType}...`);
            await axios.post(`${API_URL}/patient/add`, data);
        }

        console.log('Test data populated successfully!');
        
        // Test queries with different roles
        console.log('\n--- Testing Access Control ---');
        
        // Doctor access (should see level 1-2)
        const doctorAccess = await axios.get(`${API_URL}/patient/PATIENT001?requesterId=DOCTOR001&requesterRole=DOCTOR`);
        console.log('\nDoctor sees:', doctorAccess.data.data.length, 'records');
        
        // Emergency access (should see all)
        const emergencyAccess = await axios.get(`${API_URL}/patient/PATIENT001?requesterId=ER001&requesterRole=EMERGENCY`);
        console.log('Emergency sees:', emergencyAccess.data.data.length, 'records');
        
        // Nurse access (should see level 1 only)
        const nurseAccess = await axios.get(`${API_URL}/patient/PATIENT001?requesterId=NURSE001&requesterRole=NURSE`);
        console.log('Nurse sees:', nurseAccess.data.data.length, 'records');

    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
}

// Install axios first: npm install axios
populateTestData();