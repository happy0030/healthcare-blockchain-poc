const TestSetup = require('./setup');
const { expect } = require('chai');

describe('Emergency Access Integration Tests', function() {
    this.timeout(60000);
    
    let testSetup;
    let apiClient;

    before(async () => {
        testSetup = new TestSetup();
        await testSetup.initializeAPI();
        await testSetup.initializeLedger();
        apiClient = testSetup.apiClient;
    });

    describe('Break-Glass Protocol Activation', () => {
        const emergencyPatientId = 'EMERGENCY_PATIENT_001';
        const emergencyDoctorId = 'ER_DOCTOR_001';

        before(async () => {
            // Setup patient with all privacy levels
            const dataToAdd = [
                { dataType: 'allergies', data: 'Penicillin', privacyLevel: '1' },
                { dataType: 'currentMedications', data: 'Insulin', privacyLevel: '2' },
                { dataType: 'psychiatricNotes', data: 'PTSD treatment', privacyLevel: '3' },
                { dataType: 'hivStatus', data: 'Negative', privacyLevel: '4' }
            ];

            for (const item of dataToAdd) {
                await apiClient.post('/patient/add', {
                    patientId: emergencyPatientId,
                    ...item
                });
            }
        });

        it('should activate break-glass access with proper audit trail', async () => {
            // Activate break-glass
            const breakGlassResponse = await apiClient.post('/doctor/break-glass', {
                doctorId: emergencyDoctorId,
                patientId: emergencyPatientId,
                reason: 'Patient unconscious, need full medical history for emergency treatment'
            });

            expect(breakGlassResponse.status).to.equal(200);
            expect(breakGlassResponse.data.success).to.be.true;
            
            const audit = breakGlassResponse.data.audit;
            expect(audit.eventType).to.equal('BREAK_GLASS_ACCESS');
            expect(audit.accessGranted).to.be.true;
            expect(audit.reason).to.include('unconscious');

            // Verify expiration time is set (1 hour from now)
            const expiresAt = new Date(audit.expiresAt);
            const now = new Date();
            const diffInHours = (expiresAt - now) / (1000 * 60 * 60);
            expect(diffInHours).to.be.closeTo(1, 0.1);
        });

        it('should grant full access to all privacy levels after break-glass', async () => {
            // Query as emergency doctor after break-glass
            const queryResponse = await apiClient.get(`/patient/${emergencyPatientId}`, {
                params: {
                    requesterId: emergencyDoctorId,
                    requesterRole: 'EMERGENCY_DOCTOR'
                }
            });

            const records = queryResponse.data.data;
            expect(records.length).to.equal(4);

            // Verify all levels are decrypted
            records.forEach(record => {
                expect(record.decrypted).to.be.true;
                expect(record.data).to.not.include('[ENCRYPTED');
            });

            // Specifically verify Level 4 data is accessible
            const hivRecord = records.find(r => r.dataType === 'hivStatus');
            expect(hivRecord.data).to.equal('Negative');
            expect(hivRecord.privacyLevel).to.equal('4');
        });

        it('should log emergency access in audit trail', async () => {
            // Get audit trail
            const auditResponse = await apiClient.get(`/patient/${emergencyPatientId}/audit`);
            
            const auditTrail = auditResponse.data.auditTrail;
            expect(auditTrail).to.be.an('array');

            // Find break-glass event
            const breakGlassEvent = auditTrail.find(event => 
                event.eventType === 'BREAK_GLASS_ACCESS' && 
                event.doctorId === emergencyDoctorId
            );

            expect(breakGlassEvent).to.exist;
            expect(breakGlassEvent.reason).to.exist;

            // Find normal access events
            const accessEvents = auditTrail.filter(event => 
                event.eventType === 'NORMAL_ACCESS' &&
                event.requesterId === emergencyDoctorId
            );

            expect(accessEvents.length).to.be.at.least(1);
            expect(accessEvents[0].recordsAccessed).to.equal(4);
        });
    });
});