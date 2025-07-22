'use strict';

const { ChaincodeStub, ClientIdentity } = require('fabric-shim');
const HealthcarePrivacyContract = require('../privacyContract');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const sinon = require('sinon');
const expect = chai.expect;

chai.use(chaiAsPromised);

describe('HealthcarePrivacyContract Tests', () => {
    let contract;
    let ctx;
    let stub;
    let clientIdentity;

    beforeEach(() => {
        contract = new HealthcarePrivacyContract();
        stub = sinon.createStubInstance(ChaincodeStub);
        clientIdentity = sinon.createStubInstance(ClientIdentity);
        ctx = {
            stub: stub,
            clientIdentity: clientIdentity
        };

        // Mock timestamp
        stub.getTxTimestamp.returns({
            seconds: { low: 1640995200 }, // 2022-01-01 00:00:00
            nanos: 0
        });

        // Mock transaction ID
        stub.getTxID.returns('tx123456789');
    });

    describe('Privacy Level Tests', () => {
        it('should initialize ledger with correct privacy levels', async () => {
            stub.putState.resolves();
            
            await contract.InitLedger(ctx);
            
            // Verify all 4 privacy levels were created
            expect(stub.putState.callCount).to.equal(5); // 4 levels + 1 access rules
            
            // Check Level 1
            const level1Call = stub.putState.getCall(0);
            expect(level1Call.args[0]).to.equal('LEVEL_1');
            const level1Data = JSON.parse(level1Call.args[1].toString());
            expect(level1Data.name).to.equal('Emergency');
            expect(level1Data.encryptionType).to.equal('AES-128-CBC');
        });

        it('should reject invalid privacy levels', async () => {
            await expect(
                contract.AddPatientData(ctx, 'P001', 'bloodType', 'A+', '5')
            ).to.be.rejectedWith('Invalid privacy level: 5');

            await expect(
                contract.AddPatientData(ctx, 'P001', 'bloodType', 'A+', '0')
            ).to.be.rejectedWith('Invalid privacy level: 0');
        });

        it('should enforce encryption by privacy level', async () => {
            stub.putState.resolves();
            stub.createCompositeKey.returnsArg(1);

            // Test Level 1 (AES-128)
            const result1 = await contract.AddPatientData(ctx, 'P001', 'bloodType', 'A+', '1');
            const parsed1 = JSON.parse(result1);
            expect(parsed1.privacyLevel).to.equal('1');

            // Test Level 3 (AES-256)
            const result3 = await contract.AddPatientData(ctx, 'P001', 'psychiatric', 'data', '3');
            const parsed3 = JSON.parse(result3);
            expect(parsed3.privacyLevel).to.equal('3');
        });
    });

    describe('Access Control Tests', () => {
        beforeEach(() => {
            // Setup access rules
            const accessRules = {
                'DOCTOR': { maxLevel: '2', needsConsent: ['3', '4'] },
                'NURSE': { maxLevel: '1', needsConsent: ['2', '3', '4'] },
                'RESEARCHER': { maxLevel: '0', needsConsent: ['1', '2', '3', '4'] },
                'EMERGENCY': { maxLevel: '4', needsConsent: [] }
            };
            stub.getState.withArgs('ACCESS_RULES').resolves(Buffer.from(JSON.stringify(accessRules)));
        });

        it('should allow DOCTOR access to level 1 and 2 without consent', async () => {
            const canAccess1 = await contract.CanAccessLevel(ctx, 'D001', 'DOCTOR', 'P001', '1', 'bloodType');
            expect(canAccess1).to.be.true;

            const canAccess2 = await contract.CanAccessLevel(ctx, 'D001', 'DOCTOR', 'P001', '2', 'medication');
            expect(canAccess2).to.be.true;
        });

        it('should deny DOCTOR access to level 3 without consent', async () => {
            stub.getState.resolves(null); // This will make all getState calls return null
            stub.createCompositeKey.callsFake((type, attrs) => `${type}_${attrs.join('_')}`);
            
            const canAccess = await contract.CanAccessLevel(ctx, 'D001', 'DOCTOR', 'P001', '3', 'mentalHealth');
            expect(canAccess).to.be.false;
        });

        it('should allow DOCTOR access to level 3 with consent', async () => {
            const consent = {
                status: 'ACTIVE',
                patientId: 'P001',
                granteeId: 'D001',
                dataType: 'mentalHealth'
            };
            stub.createCompositeKey.returns('consent_key');
            stub.getState.withArgs('consent_key').resolves(Buffer.from(JSON.stringify(consent)));

            const canAccess = await contract.CanAccessLevel(ctx, 'D001', 'DOCTOR', 'P001', '3', 'mentalHealth');
            expect(canAccess).to.be.true;
        });

        it('should allow NURSE access only to level 1', async () => {
            const canAccess1 = await contract.CanAccessLevel(ctx, 'N001', 'NURSE', 'P001', '1', 'bloodType');
            expect(canAccess1).to.be.true;

            const canAccess2 = await contract.CanAccessLevel(ctx, 'N001', 'NURSE', 'P001', '2', 'medication');
            expect(canAccess2).to.be.false;
        });

        it('should deny RESEARCHER access to all levels without consent', async () => {
            const canAccess1 = await contract.CanAccessLevel(ctx, 'R001', 'RESEARCHER', 'P001', '1', 'bloodType');
            expect(canAccess1).to.be.false;
        });
    });

    describe('Encryption/Decryption Tests', () => {
        it('should encrypt data with correct algorithm based on level', () => {
            // Test Level 1-2 (AES-128)
            const encrypted1 = contract.encryptData(ctx, 'test data', '1');
            expect(encrypted1.algorithm).to.equal('aes-128-cbc');
            expect(encrypted1.encrypted).to.exist;
            expect(encrypted1.iv).to.exist;

            // Test Level 3-4 (AES-256)
            const encrypted3 = contract.encryptData(ctx, 'test data', '3');
            expect(encrypted3.algorithm).to.equal('aes-256-cbc');
        });

        it('should successfully decrypt encrypted data', () => {
            const originalData = 'sensitive medical data';
            const encrypted = contract.encryptData(ctx, originalData, '3');
            
            const decrypted = contract.decryptData(
                encrypted.encrypted,
                encrypted.iv,
                '3',
                encrypted.algorithm
            );
            
            expect(decrypted).to.equal(originalData);
        });

        it('should use different encryption keys for different levels', () => {
            const key1 = contract.getEncryptionKey('1');
            const key2 = contract.getEncryptionKey('2');
            const key3 = contract.getEncryptionKey('3');
            const key4 = contract.getEncryptionKey('4');

            expect(key1).to.not.equal(key2);
            expect(key2).to.not.equal(key3);
            expect(key3).to.not.equal(key4);
        });
    });

    describe('Consent Management Tests', () => {
        it('should successfully grant consent', async () => {
            stub.putState.resolves();
            stub.createCompositeKey.returns('consent_key');

            const result = await contract.GrantConsent(
                ctx,
                'P001',
                'D001',
                'mentalHealth',
                '2024-12-31T23:59:59Z'
            );

            const consent = JSON.parse(result);
            expect(consent.patientId).to.equal('P001');
            expect(consent.granteeId).to.equal('D001');
            expect(consent.dataType).to.equal('mentalHealth');
            expect(consent.status).to.equal('ACTIVE');
        });

        it('should store consent with correct composite key', async () => {
            stub.putState.resolves();
            const mockKey = 'consent_P001_D001_mentalHealth';
            stub.createCompositeKey.returns(mockKey);

            await contract.GrantConsent(ctx, 'P001', 'D001', 'mentalHealth', '2024-12-31');

            expect(stub.createCompositeKey.calledWith('consent', ['P001', 'D001', 'mentalHealth'])).to.be.true;
            expect(stub.putState.calledWith(mockKey)).to.be.true;
        });
    });

    describe('Break-Glass Protocol Tests', () => {
        it('should grant emergency access with audit', async () => {
            stub.putState.resolves();
            stub.createCompositeKey.returns('audit_key');

            const result = await contract.BreakGlassAccess(
                ctx,
                'ER001',
                'P001',
                'Patient unconscious, need medication history'
            );

            const audit = JSON.parse(result);
            expect(audit.doctorId).to.equal('ER001');
            expect(audit.patientId).to.equal('P001');
            expect(audit.reason).to.include('unconscious');
            expect(audit.eventType).to.equal('BREAK_GLASS_ACCESS');
            expect(audit.accessGranted).to.be.true;
        });

        it('should set expiration time for emergency access', async () => {
            stub.putState.resolves();

            const result = await contract.BreakGlassAccess(ctx, 'ER001', 'P001', 'Emergency');
            const audit = JSON.parse(result);

            const timestamp = new Date(audit.timestamp);
            const expiresAt = new Date(audit.expiresAt);
            const diff = expiresAt - timestamp;

            expect(diff).to.equal(3600000); // 1 hour in milliseconds
        });

        it('should check emergency access expiration', async () => {
            // Valid emergency access
            const validEmergency = {
                expiresAt: new Date(Date.now() + 3600000).toISOString() // 1 hour from now
            };
            stub.getState.resolves(Buffer.from(JSON.stringify(validEmergency)));
            stub.createCompositeKey.returns('emergency_key');

            const hasAccess = await contract.HasEmergencyAccess(ctx, 'ER001', 'P001');
            expect(hasAccess).to.be.true;

            // Expired emergency access
            const expiredEmergency = {
                expiresAt: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
            };
            stub.getState.resolves(Buffer.from(JSON.stringify(expiredEmergency)));

            const hasExpiredAccess = await contract.HasEmergencyAccess(ctx, 'ER001', 'P001');
            expect(hasExpiredAccess).to.be.false;
        });
    });

    describe('Audit Trail Tests', () => {
        it('should log all access attempts', async () => {
            // Mock patient data
            const mockIterator = {
                next: sinon.stub(),
                close: sinon.stub().resolves()
            };

            const patientData = {
                patientId: 'P001',
                dataType: 'bloodType',
                encryptedData: 'encrypted',
                iv: 'iv123',
                algorithm: 'aes-128-cbc',
                privacyLevel: '1'
            };

            mockIterator.next.onFirstCall().resolves({
                value: { value: Buffer.from(JSON.stringify(patientData)) },
                done: false
            });
            mockIterator.next.onSecondCall().resolves({ done: true });

            stub.getStateByPartialCompositeKey.resolves(mockIterator);
            stub.putState.resolves();
            stub.getState.withArgs('ACCESS_RULES').resolves(Buffer.from(JSON.stringify({
                'DOCTOR': { maxLevel: '2', needsConsent: ['3', '4'] }
            })));

            await contract.QueryPatientData(ctx, 'P001', 'D001', 'DOCTOR');

            // Verify audit log was created
            expect(stub.putState.called).to.be.true;
        });

        it('should retrieve complete audit trail', async () => {
            const mockIterator1 = {
                next: sinon.stub(),
                close: sinon.stub().resolves()
            };
            
            const mockIterator2 = {
                next: sinon.stub(),
                close: sinon.stub().resolves()
            };

            const auditRecord = {
                doctorId: 'D001',
                patientId: 'P001',
                timestamp: '2024-01-01T10:00:00Z',
                eventType: 'BREAK_GLASS_ACCESS'
            };

            mockIterator1.next.onFirstCall().resolves({
                value: { value: Buffer.from(JSON.stringify(auditRecord)) },
                done: false
            });
            mockIterator1.next.onSecondCall().resolves({ done: true });
            
            mockIterator2.next.onFirstCall().resolves({ done: true });

            stub.getStateByPartialCompositeKey
                .onFirstCall().resolves(mockIterator1)
                .onSecondCall().resolves(mockIterator2);

            const result = await contract.GetAuditTrail(ctx, 'P001');
            const auditTrail = JSON.parse(result);

            expect(auditTrail).to.be.an('array');
            expect(auditTrail.length).to.equal(1);
        });
    });

    describe('Patient Data Query Tests', () => {
        it('should decrypt data for authorized access', async () => {
            const mockIterator = {
                next: sinon.stub(),
                close: sinon.stub().resolves()
            };

            // Encrypt test data
            const originalData = 'Blood Type: A+';
            const encrypted = contract.encryptData(ctx, originalData, '1');

            const patientRecord = {
                patientId: 'P001',
                dataType: 'bloodType',
                encryptedData: encrypted.encrypted,
                iv: encrypted.iv,
                algorithm: encrypted.algorithm,
                privacyLevel: '1',
                timestamp: '2024-01-01T10:00:00Z'
            };

            mockIterator.next.onFirstCall().resolves({
                value: { value: Buffer.from(JSON.stringify(patientRecord)) },
                done: false
            });
            mockIterator.next.onSecondCall().resolves({ done: true });

            stub.getStateByPartialCompositeKey.resolves(mockIterator);
            stub.getState.withArgs('ACCESS_RULES').resolves(Buffer.from(JSON.stringify({
                'DOCTOR': { maxLevel: '2', needsConsent: ['3', '4'] }
            })));
            stub.putState.resolves();

            const result = await contract.QueryPatientData(ctx, 'P001', 'D001', 'DOCTOR');
            const records = JSON.parse(result);

            expect(records).to.be.an('array');
            expect(records[0].decrypted).to.be.true;
            expect(records[0].data).to.equal(originalData);
        });

        it('should return encrypted data for unauthorized access', async () => {
            const mockIterator = {
                next: sinon.stub(),
                close: sinon.stub().resolves()
            };

            const patientRecord = {
                patientId: 'P001',
                dataType: 'hivStatus',
                encryptedData: 'encrypted_data',
                iv: 'iv123',
                algorithm: 'aes-256-cbc',
                privacyLevel: '4',
                timestamp: '2024-01-01T10:00:00Z'
            };

            mockIterator.next.onFirstCall().resolves({
                value: { value: Buffer.from(JSON.stringify(patientRecord)) },
                done: false
            });
            mockIterator.next.onSecondCall().resolves({ done: true });

            stub.getStateByPartialCompositeKey.resolves(mockIterator);
            stub.getState.withArgs('ACCESS_RULES').resolves(Buffer.from(JSON.stringify({
                'NURSE': { maxLevel: '1', needsConsent: ['2', '3', '4'] }
            })));
            stub.putState.resolves();

            const result = await contract.QueryPatientData(ctx, 'P001', 'N001', 'NURSE');
            const records = JSON.parse(result);

            expect(records[0].decrypted).to.be.false;
            expect(records[0].accessDenied).to.be.true;
            expect(records[0].data).to.equal('[ENCRYPTED - Access Denied]');
        });
    });

    describe('Timestamp Functions Tests', () => {
        it('should generate deterministic timestamp as string', () => {
            const timestamp = contract.getDeterministicTimestampAsString(ctx);
            expect(timestamp).to.be.a('string');
            expect(timestamp).to.equal('1640995200000');
        });

        it('should generate deterministic ISO timestamp', () => {
            const isoTimestamp = contract.getDeterministicTimestampAsISOString(ctx);
            expect(isoTimestamp).to.be.a('string');
            expect(isoTimestamp).to.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        });

        it('should apply offset to ISO timestamp', () => {
            const baseTime = contract.getDeterministicTimestampAsISOString(ctx);
            const offsetTime = contract.getDeterministicTimestampAsISOString(ctx, 3600);
            
            const base = new Date(baseTime);
            const offset = new Date(offsetTime);
            const diff = offset - base;

            expect(diff).to.equal(3600000); // 3600 seconds in milliseconds
        });
    });
});