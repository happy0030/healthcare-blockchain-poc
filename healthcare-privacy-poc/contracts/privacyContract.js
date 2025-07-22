'use strict';

const { Contract } = require('fabric-contract-api');
const crypto = require('crypto');

class HealthcarePrivacyContract extends Contract {

    // Get Deterministic Timestamp based on Orderer's proposal timing as String
    getDeterministicTimestampAsString(ctx){
        const txTimestamp = ctx.stub.getTxTimestamp();
        const seconds = txTimestamp.seconds.low;
        const nanos = txTimestamp.nanos;
        const deterministicNow = (seconds * 1000 + nanos / 1e6).toString();
        return deterministicNow;
    }
    
    // Get Deterministic Timestamp based on Orderer's proposal timing as ISO String
    getDeterministicTimestampAsISOString(ctx, offsetSeconds = 0){
        const txTimestamp = ctx.stub.getTxTimestamp();
        const seconds = txTimestamp.seconds.low;
        const nanos = txTimestamp.nanos;
        const millis = (seconds + offsetSeconds) * 1000 + nanos / 1e6;
        const txTime = new Date(millis).toISOString();
        return txTime;

    }


    // Simulated encryption keys for each level (in production, use key management service)
    getEncryptionKey(level) {
        const keys = {
            '1': 'LEVEL1KEY128BITEMERGENCYACCESS!', // 32 chars = 256 bits
            '2': 'LEVEL2KEY192BITGENERALACCESSOK!', 
            '3': 'LEVEL3KEY256BITSENSITIVEDATAPRO',
            '4': 'LEVEL4KEY256BITHIGHLYSENSITIVE!'
        };
        return keys[level];
    }

    // Encrypt data based on privacy level
    encryptData(ctx, data, privacyLevel) {
        const algorithm = privacyLevel <= '2' ? 'aes-128-cbc' : 'aes-256-cbc';
        const key = crypto.scryptSync(this.getEncryptionKey(privacyLevel), 'salt', privacyLevel <= '2' ? 16 : 32);
        const ivSource = ctx.stub.getTxID(); // sufficient for determinism
        const iv = crypto.createHash('sha256').update(ivSource).digest().subarray(0, 16);
        
        const cipher = crypto.createCipheriv(algorithm, key, iv);
        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        return {
            encrypted: encrypted,
            iv: iv.toString('hex'),
            algorithm: algorithm
        };
    }

    // Decrypt data - only if authorized
    decryptData(encryptedData, iv, privacyLevel, algorithm) {
        const keyLength = algorithm === 'aes-128-cbc' ? 16 : 32;
        const key = crypto.scryptSync(this.getEncryptionKey(privacyLevel), 'salt', keyLength);
        const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(iv, 'hex'));
        
        let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    }

    async InitLedger(ctx) {
        console.info('============= START : Initialize Ledger ===========');
        
        const privacyLevels = [
            {
                level: '1',
                name: 'Emergency',
                description: 'Blood type, allergies - Always accessible',
                encryptionType: 'AES-128-CBC'
            },
            {
                level: '2', 
                name: 'General',
                description: 'Chronic conditions, medications',
                encryptionType: 'AES-128-CBC'
            },
            {
                level: '3',
                name: 'Sensitive',
                description: 'Mental health, reproductive health',
                encryptionType: 'AES-256-CBC'
            },
            {
                level: '4',
                name: 'Highly Sensitive',
                description: 'HIV status, substance abuse',
                encryptionType: 'AES-256-CBC'
            }
        ];

        for (const level of privacyLevels) {
            await ctx.stub.putState('LEVEL_' + level.level, Buffer.from(JSON.stringify(level)));
        }

        const accessRules = {
            'DOCTOR': { maxLevel: '2', needsConsent: ['3', '4'] },
            'EMERGENCY_BREAK_GLASS': { maxLevel: '4', needsConsent: [] },
            'EMERGENCY_DOCTOR': { maxLevel: '2', needsConsent: ['3', '4'] },
            'NURSE': { maxLevel: '1', needsConsent: ['2', '3', '4'] },
            'RESEARCHER': { maxLevel: '0', needsConsent: ['1', '2', '3', '4'] }
        };

        await ctx.stub.putState('ACCESS_RULES', Buffer.from(JSON.stringify(accessRules)));
        
        console.info('============= END : Initialize Ledger ===========');
    }

    // Add patient data with encryption
    async AddPatientData(ctx, patientId, dataType, data, privacyLevel) {
        console.info('============= START : Add Patient Data ===========');
        
        if (!['1', '2', '3', '4'].includes(privacyLevel)) {
            throw new Error(`Invalid privacy level: ${privacyLevel}`);
        }

        // Encrypt the data based on privacy level
        const encryptionResult = this.encryptData(ctx, data, privacyLevel);

        const record = {
            patientId,
            dataType,
            encryptedData: encryptionResult.encrypted,
            iv: encryptionResult.iv,
            algorithm: encryptionResult.algorithm,
            privacyLevel,
            timestamp: this.getDeterministicTimestampAsISOString(ctx),
            docType: 'patientData',
            isEncrypted: true
        };

        const compositeKey = ctx.stub.createCompositeKey('patient', [patientId, dataType]);
        await ctx.stub.putState(compositeKey, Buffer.from(JSON.stringify(record)));
        
        const indexKey = ctx.stub.createCompositeKey('patientIndex', [patientId, privacyLevel, dataType]);
        await ctx.stub.putState(indexKey, Buffer.from(''));
        
        console.info('============= END : Add Patient Data ===========');
        return JSON.stringify({
            patientId,
            dataType,
            privacyLevel,
            isEncrypted: true,
            timestamp: record.timestamp
        });
    }

    // Check if requester can access this privacy level
    async CanAccessLevel(ctx, requesterId, requesterRole, patientId, privacyLevel, dataType) {
        // Get access rules
        const rulesBytes = await ctx.stub.getState('ACCESS_RULES');
        const accessRules = JSON.parse(rulesBytes.toString());
        const roleRules = accessRules[requesterRole] || { maxLevel: '0', needsConsent: ['1', '2', '3', '4'] };
        
        // Check for emergency access
        const hasEmergency = await this.HasEmergencyAccess(ctx, requesterId, patientId);
        
        if (hasEmergency || requesterRole === 'EMERGENCY') {
            return true;
        }
        
        if (parseInt(privacyLevel) <= parseInt(roleRules.maxLevel)) {
            return true;
        }
        
        if (roleRules.needsConsent.includes(privacyLevel)) {
            const consentKey = ctx.stub.createCompositeKey('consent', [patientId, requesterId, dataType]);
            const consentBytes = await ctx.stub.getState(consentKey);
            
            if (consentBytes && consentBytes.length > 0) {
                const consent = JSON.parse(consentBytes.toString());
                if (consent.status === 'ACTIVE') {
                    return true;
                }
            }
        }
        
        return false;
    }

    // Query patient data with decryption based on access rights
    async QueryPatientData(ctx, patientId, requesterId, requesterRole) {
        console.info('============= START : Query Patient Data ===========');
        
        const iterator = await ctx.stub.getStateByPartialCompositeKey('patient', [patientId]);
        const results = [];
        
        while (true) {
            const result = await iterator.next();
            
            if (result.value && result.value.value.toString()) {
                const record = JSON.parse(result.value.value.toString('utf8'));
                
                // Check access permission
                const canAccess = await this.CanAccessLevel(
                    ctx, 
                    requesterId, 
                    requesterRole, 
                    patientId, 
                    record.privacyLevel, 
                    record.dataType
                );
                
                if (canAccess) {
                    // Decrypt data for authorized access
                    try {
                        const decryptedData = this.decryptData(
                            record.encryptedData, 
                            record.iv, 
                            record.privacyLevel,
                            record.algorithm
                        );
                        
                        results.push({
                            patientId: record.patientId,
                            dataType: record.dataType,
                            data: decryptedData,
                            privacyLevel: record.privacyLevel,
                            timestamp: record.timestamp,
                            decrypted: true
                        });
                    } catch (error) {
                        console.error('Decryption error:', error);
                        results.push({
                            patientId: record.patientId,
                            dataType: record.dataType,
                            data: '[ENCRYPTED - Decryption Failed]',
                            privacyLevel: record.privacyLevel,
                            timestamp: record.timestamp,
                            decrypted: false
                        });
                    }
                } else {
                    // Return metadata only for unauthorized access
                    results.push({
                        patientId: record.patientId,
                        dataType: record.dataType,
                        data: '[ENCRYPTED - Access Denied]',
                        privacyLevel: record.privacyLevel,
                        timestamp: record.timestamp,
                        decrypted: false,
                        accessDenied: true
                    });
                }
            }
            
            if (result.done) {
                await iterator.close();
                break;
            }
        }
        
        //Log access attempt
        const accessLog = {
            requesterId,
            requesterRole,
            patientId,
            timestamp: this.getDeterministicTimestampAsISOString(ctx),
            recordsAccessed: results.filter(r => r.decrypted).length,
            recordsDenied: results.filter(r => r.accessDenied).length,
            totalRecords: results.length,
            eventType: 'NORMAL_ACCESS',
        };
        
        const logKey = ctx.stub.createCompositeKey('accessLog', [patientId, requesterId, this.getDeterministicTimestampAsString(ctx)]);
        await ctx.stub.putState(logKey, Buffer.from(JSON.stringify(accessLog)));
        
        console.info('============= END : Query Patient Data ===========');
        return JSON.stringify(results);
    }

    // Grant consent remains the same
    async GrantConsent(ctx, patientId, granteeId, dataType, expiryDate) {
        console.info('============= START : Grant Consent ===========');
        
        const consent = {
            patientId,
            granteeId,
            dataType,
            grantedAt: this.getDeterministicTimestampAsISOString(ctx),
            expiryDate,
            status: 'ACTIVE',
            docType: 'consent'
        };

        const consentKey = ctx.stub.createCompositeKey('consent', [patientId, granteeId, dataType]);
        await ctx.stub.putState(consentKey, Buffer.from(JSON.stringify(consent)));
        
        console.info('============= END : Grant Consent ===========');
        return JSON.stringify(consent);
    }

    // Emergency break-glass access remains the same
    async BreakGlassAccess(ctx, doctorId, patientId, reason) {
        console.info('============= START : Break Glass Access ===========');
        
        const auditRecord = {
            doctorId,
            patientId,
            reason,
            timestamp: this.getDeterministicTimestampAsISOString(ctx),
            eventType: 'BREAK_GLASS_ACCESS',
            accessGranted: true,
            expiresAt: this.getDeterministicTimestampAsISOString(ctx, 3600) // 1 hour access
        };

        const auditKey = ctx.stub.createCompositeKey('audit', [patientId, doctorId, this.getDeterministicTimestampAsString(ctx)]);
        await ctx.stub.putState(auditKey, Buffer.from(JSON.stringify(auditRecord)));
        
        const emergencyKey = ctx.stub.createCompositeKey('emergency', [doctorId, patientId]);
        await ctx.stub.putState(emergencyKey, Buffer.from(JSON.stringify(auditRecord)));
        
        console.info('Break-glass access granted for emergency');
        
        console.info('============= END : Break Glass Access ===========');
        return JSON.stringify(auditRecord);
    }

    async HasEmergencyAccess(ctx, requesterId, patientId) {
        const emergencyKey = ctx.stub.createCompositeKey('emergency', [requesterId, patientId]);
        const emergencyBytes = await ctx.stub.getState(emergencyKey);
        
        if (!emergencyBytes || emergencyBytes.length === 0) {
            return false;
        }
        
        const emergency = JSON.parse(emergencyBytes.toString());
        const now = new Date();
        const expiresAt = new Date(emergency.expiresAt);
        
        return now < expiresAt;
    }

    async GetAuditTrail(ctx, patientId) {
        console.info('============= START : Get Audit Trail ===========');
        
        const results = [];
        
        const auditIterator = await ctx.stub.getStateByPartialCompositeKey('audit', [patientId]);
        while (true) {
            const result = await auditIterator.next();
            if (result.value && result.value.value.toString()) {
                results.push(JSON.parse(result.value.value.toString('utf8')));
            }
            if (result.done) {
                await auditIterator.close();
                break;
            }
        }
        
        const logIterator = await ctx.stub.getStateByPartialCompositeKey('accessLog', [patientId]);
        while (true) {
            const result = await logIterator.next();
            if (result.value && result.value.value.toString()) {
                results.push(JSON.parse(result.value.value.toString('utf8')));
            }
            if (result.done) {
                await logIterator.close();
                break;
            }
        }
        
        results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        console.info('============= END : Get Audit Trail ===========');
        return JSON.stringify(results);
    }
}

module.exports = HealthcarePrivacyContract;