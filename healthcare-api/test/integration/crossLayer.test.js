const TestSetup = require('./setup');
const { expect } = require('chai');

describe('Cross-Layer Integration Tests', function() {
    this.timeout(60000);
    
    let testSetup;
    let apiClient;

    before(async () => {
        testSetup = new TestSetup();
        await testSetup.initializeAPI();
        await testSetup.initializeLedger();
        apiClient = testSetup.apiClient;
    });

    describe('API to Blockchain Communication', () => {
        it('should handle blockchain errors gracefully', async () => {
            // Try to add data with invalid privacy level
            try {
                await apiClient.post('/patient/add', {
                    patientId: 'ERROR_TEST_PATIENT',
                    dataType: 'test',
                    data: 'test data',
                    privacyLevel: '5' // Invalid level
                });
                
                // Should not reach here
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.response.status).to.equal(500);
                expect(error.response.data.error).to.include('Invalid privacy level');
            }
        });

        it('should validate input at API layer before blockchain submission', async () => {
            // Missing required fields
            try {
                await apiClient.post('/patient/add', {
                    patientId: 'VALIDATION_TEST'
                    // Missing dataType, data, and privacyLevel
                });
                
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.response.status).to.equal(400);
                expect(error.response.data.error).to.include('Missing required fields');
            }
        });

        it('should handle network timeouts appropriately', async function() {
            this.timeout(35000); // Extended timeout for this test
            
            // Create a custom client with very short timeout
            const timeoutClient = axios.create({
                baseURL: testSetup.baseURL,
                timeout: 100 // 100ms timeout
            });

            try {
                await timeoutClient.post('/patient/add', {
                    patientId: 'TIMEOUT_TEST',
                    dataType: 'test',
                    data: 'test',
                    privacyLevel: '1'
                });
                
                expect.fail('Should have timed out');
            } catch (error) {
                expect(error.code).to.equal('ECONNABORTED');
            }
        });
    });

    describe('Transaction Consistency', () => {
        it('should maintain consistency across multiple operations', async () => {
            const patientId = 'CONSISTENCY_TEST_PATIENT';
            const doctorId = 'CONSISTENCY_TEST_DOCTOR';

            // Operation 1: Add data
            await apiClient.post('/patient/add', {
                patientId,
                dataType: 'diagnosis',
                data: 'Hypertension',
                privacyLevel: '2'
            });

            // Operation 2: Query to create access log
            await apiClient.get(`/patient/${patientId}`, {
                params: {
                    requesterId: doctorId,
                    requesterRole: 'DOCTOR'
                }
            });

            // Operation 3: Get audit trail
            const auditResponse = await apiClient.get(`/patient/${patientId}/audit`);
            
            const auditTrail = auditResponse.data.auditTrail;
            
            // Should have at least one access log
            const accessLog = auditTrail.find(log => 
                log.eventType === 'NORMAL_ACCESS' && 
                log.requesterId === doctorId
            );

            expect(accessLog).to.exist;
            expect(accessLog.recordsAccessed).to.equal(1);
            expect(accessLog.recordsDenied).to.equal(0);
        });
    });
});