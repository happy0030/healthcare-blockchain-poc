const TestSetup = require('./setup');
const { expect } = require('chai');

describe('Patient Data Lifecycle Integration Tests', function() {
    this.timeout(60000); // 60 seconds timeout for blockchain operations
    
    let testSetup;
    let apiClient;

    before(async () => {
        testSetup = new TestSetup();
        await testSetup.initializeAPI();
        await testSetup.initializeLedger();
        apiClient = testSetup.apiClient;
    });

    after(async () => {
        await testSetup.cleanup();
    });

    describe('Complete Data Flow from UI to Blockchain', () => {
        const testPatientId = 'TEST_PATIENT_001';
        const testDoctorId = 'TEST_DOCTOR_001';

        it('should handle complete patient data addition and retrieval flow', async () => {
            // Step 1: Patient adds emergency data (Level 1)
            const emergencyData = {
                patientId: testPatientId,
                dataType: 'bloodType',
                data: 'O+',
                privacyLevel: '1'
            };

            const addResponse = await apiClient.post('/patient/add', emergencyData);
            expect(addResponse.status).to.equal(200);
            expect(addResponse.data.success).to.be.true;
            expect(addResponse.data.result.privacyLevel).to.equal('1');
            expect(addResponse.data.result.isEncrypted).to.be.true;

            // Step 2: Add general medical data (Level 2)
            const generalData = {
                patientId: testPatientId,
                dataType: 'medications',
                data: 'Aspirin 81mg daily',
                privacyLevel: '2'
            };

            const addGeneralResponse = await apiClient.post('/patient/add', generalData);
            expect(addGeneralResponse.status).to.equal(200);

            // Step 3: Add sensitive data (Level 3)
            const sensitiveData = {
                patientId: testPatientId,
                dataType: 'mentalHealth',
                data: 'Anxiety disorder - under treatment',
                privacyLevel: '3'
            };

            const addSensitiveResponse = await apiClient.post('/patient/add', sensitiveData);
            expect(addSensitiveResponse.status).to.equal(200);

            // Step 4: Doctor queries the records
            const queryResponse = await apiClient.get(`/patient/${testPatientId}`, {
                params: {
                    requesterId: testDoctorId,
                    requesterRole: 'DOCTOR'
                }
            });

            expect(queryResponse.status).to.equal(200);
            expect(queryResponse.data.success).to.be.true;
            
            const records = queryResponse.data.data;
            expect(records).to.be.an('array');
            expect(records.length).to.equal(3);

            // Verify doctor can see Level 1 and 2 data decrypted
            const bloodTypeRecord = records.find(r => r.dataType === 'bloodType');
            expect(bloodTypeRecord.decrypted).to.be.true;
            expect(bloodTypeRecord.data).to.equal('O+');

            const medicationRecord = records.find(r => r.dataType === 'medications');
            expect(medicationRecord.decrypted).to.be.true;
            expect(medicationRecord.data).to.equal('Aspirin 81mg daily');

            // Verify doctor cannot see Level 3 data without consent
            const mentalHealthRecord = records.find(r => r.dataType === 'mentalHealth');
            expect(mentalHealthRecord.decrypted).to.be.false;
            expect(mentalHealthRecord.accessDenied).to.be.true;
            expect(mentalHealthRecord.data).to.equal('[ENCRYPTED - Access Denied]');
        });

        it('should verify encryption and access control across privacy levels', async () => {
            // Nurse queries the same patient
            const nurseQueryResponse = await apiClient.get(`/patient/${testPatientId}`, {
                params: {
                    requesterId: 'TEST_NURSE_001',
                    requesterRole: 'NURSE'
                }
            });

            const nurseRecords = nurseQueryResponse.data.data;
            
            // Nurse should only see Level 1 data decrypted
            const bloodTypeForNurse = nurseRecords.find(r => r.dataType === 'bloodType');
            expect(bloodTypeForNurse.decrypted).to.be.true;

            const medicationsForNurse = nurseRecords.find(r => r.dataType === 'medications');
            expect(medicationsForNurse.decrypted).to.be.false;
            expect(medicationsForNurse.accessDenied).to.be.true;
        });
    });

    describe('Consent Management Flow', () => {
        const patientId = 'CONSENT_TEST_PATIENT';
        const doctorId = 'CONSENT_TEST_DOCTOR';

        before(async () => {
            // Add sensitive data that requires consent
            await apiClient.post('/patient/add', {
                patientId: patientId,
                dataType: 'psychiatricHistory',
                data: 'Depression treatment 2020-2021',
                privacyLevel: '3'
            });
        });

        it('should grant consent and verify immediate access update', async () => {
            // Doctor initially cannot access
            const beforeConsentResponse = await apiClient.get(`/patient/${patientId}`, {
                params: {
                    requesterId: doctorId,
                    requesterRole: 'DOCTOR'
                }
            });

            const beforeRecords = beforeConsentResponse.data.data;
            const psychRecord = beforeRecords.find(r => r.dataType === 'psychiatricHistory');
            expect(psychRecord.accessDenied).to.be.true;

            // Patient grants consent
            const expiryDate = new Date();
            expiryDate.setHours(expiryDate.getHours() + 1); // 1 hour from now

            const consentResponse = await apiClient.post('/patient/consent', {
                patientId: patientId,
                granteeId: doctorId,
                dataType: 'psychiatricHistory',
                expiryDate: expiryDate.toISOString()
            });

            expect(consentResponse.data.success).to.be.true;
            expect(consentResponse.data.result.status).to.equal('ACTIVE');

            // Doctor can now access
            const afterConsentResponse = await apiClient.get(`/patient/${patientId}`, {
                params: {
                    requesterId: doctorId,
                    requesterRole: 'DOCTOR'
                }
            });

            const afterRecords = afterConsentResponse.data.data;
            const psychRecordAfter = afterRecords.find(r => r.dataType === 'psychiatricHistory');
            expect(psychRecordAfter.decrypted).to.be.true;
            expect(psychRecordAfter.data).to.equal('Depression treatment 2020-2021');
        });
    });
});