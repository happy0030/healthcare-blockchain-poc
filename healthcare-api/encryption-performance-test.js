const crypto = require('crypto');
const fs = require('fs');

// Encryption functions matching your implementation
function getEncryptionKey(level) {
    const keys = {
        '1': 'LEVEL1KEY128BITEMERGENCYACCESS!',
        '2': 'LEVEL2KEY128BITGENERALACCESSOK!',
        '3': 'LEVEL3KEY256BITSENSITIVEDATAPRO',
        '4': 'LEVEL4KEY256BITHIGHLYSENSITIVE!'
    };
    return keys[level];
}

function encryptData(data, privacyLevel) {
    const algorithm = privacyLevel <= 2 ? 'aes-128-cbc' : 'aes-256-cbc';
    const keyLength = privacyLevel <= 2 ? 16 : 32;
    const key = crypto.scryptSync(getEncryptionKey(privacyLevel.toString()), 'salt', keyLength);

    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return { encrypted, iv: iv.toString('hex'), algorithm };
}

function decryptData(encryptedData, iv, privacyLevel) {
    const algorithm = privacyLevel <= 2 ? 'aes-128-cbc' : 'aes-256-cbc';
    const keyLength = privacyLevel <= 2 ? 16 : 32;
    const key = crypto.scryptSync(getEncryptionKey(privacyLevel.toString()), 'salt', keyLength);
    
    const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(iv, 'hex'));
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
}

// Test data generation (1MB of data)
function generateTestData(sizeMB) {
    const size = sizeMB * 1024 * 1024;
    return Buffer.allocUnsafe(size).fill('A').toString(); // More efficient generation
}

// Performance test function
async function runPerformanceTest() {
    console.log('=== Encryption/Decryption Performance Test ===\n');
    
    const testSizes = [1, 5, 10, 50, 100]; // Test with different sizes
    const iterations = 100; // Fewer iterations but more sizes
    
    for (const sizeMB of testSizes) {
        console.log(`\nTesting with ${sizeMB}MB data:`);
        const testData = generateTestData(sizeMB);
        const results = [];
        
        for (let level = 1; level <= 4; level++) {
            const encryptionTimes = [];
            const decryptionTimes = [];
            
            // Warm-up run
            encryptData(testData, level);
            
            for (let i = 0; i < iterations; i++) {
                // Force garbage collection if available
                if (global.gc) global.gc();
                
                // Encryption test
                const encStart = process.hrtime.bigint();
                const encrypted = encryptData(testData, level);
                const encEnd = process.hrtime.bigint();
                encryptionTimes.push(Number(encEnd - encStart) / 1000000);
                
                // Decryption test
                const decStart = process.hrtime.bigint();
                decryptData(encrypted.encrypted, encrypted.iv, level);
                const decEnd = process.hrtime.bigint();
                decryptionTimes.push(Number(decEnd - decStart) / 1000000);
            }
            
            const avgEnc = encryptionTimes.reduce((a, b) => a + b) / iterations;
            const avgDec = decryptionTimes.reduce((a, b) => a + b) / iterations;
            
            results.push({
                level,
                algorithm: level <= 2 ? 'AES-128' : 'AES-256',
                sizeMB,
                avgEncryptionMs: avgEnc.toFixed(2),
                avgDecryptionMs: avgDec.toFixed(2),
                encPerMB: (avgEnc / sizeMB).toFixed(2),
                decPerMB: (avgDec / sizeMB).toFixed(2)
            });
        }
        
        console.table(results);
    }
    
    // Compare graduated vs uniform approach
    console.log('\n=== Graduated vs Uniform Encryption Comparison ===');
    const level1_2Avg = (parseFloat(results[0].avgEncryptionTime) + parseFloat(results[1].avgEncryptionTime)) / 2;
    const level3_4Avg = (parseFloat(results[2].avgEncryptionTime) + parseFloat(results[3].avgEncryptionTime)) / 2;
    const uniformAvg = level3_4Avg; // If using AES-256 for all
    
    console.log(`\nGraduated Approach:`);
    console.log(`  Level 1-2 Average: ${level1_2Avg.toFixed(2)}ms`);
    console.log(`  Level 3-4 Average: ${level3_4Avg.toFixed(2)}ms`);
    console.log(`\nUniform AES-256 Approach:`);
    console.log(`  All Levels: ${uniformAvg.toFixed(2)}ms`);
    console.log(`\nPerformance Improvement for Level 1-2 Data: ${((1 - level1_2Avg/uniformAvg) * 100).toFixed(1)}%`);
    
    // Save results to file
    fs.writeFileSync('encryption-test-results.json', JSON.stringify(results, null, 2));
    console.log('\nResults saved to encryption-test-results.json');
}

// Run the test
runPerformanceTest().catch(console.error);