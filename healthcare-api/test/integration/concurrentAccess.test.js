const TestSetup = require('./setup');
const { expect } = require('chai');

describe('Concurrent Access Integration Tests', function() {
    this.timeout(120000); // Extended timeout for concurrent operations
    
    let testSetup;
    let apiClient;

    before(async () => {
        testSetup = new TestSetup();
        await testSetup.initializeAPI();
        await testSetup.initializeLedger();
        apiClient = testSetup.apiClient;
    });

    describe('Multiple Simultaneous Queries', () => {
        const concurrentPatientId = 'CONCURRENT_PATIENT_001';
        const doctorIds = Array.from({ length: 10 }, (_, i) => `DOCTOR_${i + 1}`);

        before(async () => {
            // Add test data
            await apiClient.post('/patient/add', {
                patientId: concurrentPatientId,
                dataType: 'vitals',
                data: 'BP: 120/80, HR: 72',
                privacyLevel: '2'
            });
        });

        it('should handle 10 concurrent doctor queries without errors', async () => {
            const promises = doctorIds.map(doctorId => 
                apiClient.get(`/patient/${concurrentPatientId}`, {
                    params: {
                        requesterId: doctorId,
                        requesterRole: 'DOCTOR'
                    }
                })
            );

            const results = await Promise.all(promises);

            // All requests should succeed
            results.forEach((result, index) => {
                expect(result.status).to.equal(200);
                expect(result.data.success).to.be.true;
                expect(result.data.data).to.be.an('array');
                expect(result.data.data.length).to.be.at.least(1);
            });

            // Verify data consistency across all responses
            const firstData = results[0].data.data[0].data;
            results.forEach(result => {
                const data = result.data.data[0].data;
                expect(data).to.equal(firstData);
            });
        });

        it('should handle concurrent write operations correctly', async () => {
            const writePromises = doctorIds.slice(0, 5).map((_, index) => 
                apiClient.post('/patient/add', {
                    patientId: `CONCURRENT_WRITE_PATIENT_${index}`,
                    dataType: 'temperature',
                    data: `98.${index}°F`,
                    privacyLevel: '1'
                })
            );

            const writeResults = await Promise.all(writePromises);

            writeResults.forEach((result, index) => {
                expect(result.status).to.equal(200);
                expect(result.data.success).to.be.true;
                expect(result.data.result.patientId).to.equal(`CONCURRENT_WRITE_PATIENT_${index}`);
            });
        });

        it('should maintain data integrity during concurrent consent grants', async () => {
            const consentPatientId = 'CONSENT_CONCURRENT_PATIENT';
            
            // Add sensitive data first
            await apiClient.post('/patient/add', {
                patientId: consentPatientId,
                dataType: 'labResults',
                data: 'Cholesterol: 180',
                privacyLevel: '3'
            });

            // Multiple doctors request consent simultaneously
            const consentPromises = doctorIds.slice(0, 3).map(doctorId =>
                apiClient.post('/patient/consent', {
                    patientId: consentPatientId,
                    granteeId: doctorId,
                    dataType: 'labResults',
                    expiryDate: new Date(Date.now() + 3600000).toISOString()
                })
            );

            const consentResults = await Promise.all(consentPromises);

            consentResults.forEach(result => {
                expect(result.status).to.equal(200);
                expect(result.data.success).to.be.true;
                expect(result.data.result.status).to.equal('ACTIVE');
            });

            // Verify all doctors can now access
            const accessPromises = doctorIds.slice(0, 3).map(doctorId =>
                apiClient.get(`/patient/${consentPatientId}`, {
                    params: {
                        requesterId: doctorId,
                        requesterRole: 'DOCTOR'
                    }
                })
            );

            const accessResults = await Promise.all(accessPromises);

            accessResults.forEach(result => {
                const labRecord = result.data.data.find(r => r.dataType === 'labResults');
                expect(labRecord.decrypted).to.be.true;
                expect(labRecord.data).to.equal('Cholesterol: 180');
            });
        });
    });
});