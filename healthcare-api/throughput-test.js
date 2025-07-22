const axios = require('axios');
const fs = require('fs');

// Configuration
const API_BASE_URL = 'http://localhost:3000/api';
const WARMUP_DURATION = 5000; // 5 second warmup
const TEST_DURATION = 30000; // 30 second test

class LoadTester {
    constructor(concurrentUsers) {
        this.concurrentUsers = concurrentUsers;
        this.activeRequests = 0;
        this.completedRequests = 0;
        this.errors = 0;
        this.responseTimes = [];
        this.startTime = null;
        this.tpsSnapshots = [];
    }
    
    async runUser(userId) {
        while (Date.now() - this.startTime < TEST_DURATION) {
            // Only proceed if we're not overloading
            if (this.activeRequests >= this.concurrentUsers * 2) {
                await new Promise(resolve => setTimeout(resolve, 10));
                continue;
            }
            
            this.activeRequests++;
            const requestStart = Date.now();
            
            try {
                if (Math.random() > 0.5) {
                    await axios.post(`${API_BASE_URL}/patient/add`, {
                        patientId: `P${Math.floor(Math.random() * 1000)}`,
                        dataType: 'medication',
                        data: `Test data ${Date.now()}`,
                        privacyLevel: Math.ceil(Math.random() * 4).toString()
                    });
                } else {
                    await axios.get(`${API_BASE_URL}/patient/P001`, {
                        params: {
                            requesterId: `D${userId}`,
                            requesterRole: 'DOCTOR'
                        }
                    });
                }
                
                const responseTime = Date.now() - requestStart;
                this.responseTimes.push(responseTime);
                this.completedRequests++;
                
            } catch (error) {
                this.errors++;
            }
            
            this.activeRequests--;
        }
    }
    
    async measureTPS() {
        let lastCount = 0;
        const measureInterval = setInterval(() => {
            const currentCount = this.completedRequests;
            const tps = currentCount - lastCount; // TPS in last second
            this.tpsSnapshots.push(tps);
            lastCount = currentCount;
            
            // Log real-time TPS
            // console.log(`Real-time TPS: ${tps}, Active Requests: ${this.activeRequests}`);
            
            if (Date.now() - this.startTime >= TEST_DURATION) {
                clearInterval(measureInterval);
            }
        }, 1000);
    }
    

    async run() {
        console.log(`Starting test with ${this.concurrentUsers} concurrent users...`);
        // console.log('Warming up...');
        
        // Warmup period
        await new Promise(resolve => setTimeout(resolve, WARMUP_DURATION));
        
        // console.log('Starting measurement...');
        this.startTime = Date.now();
        
        // Start TPS measurement
        this.measureTPS();
        
        // Start concurrent users
        const userPromises = [];
        for (let i = 0; i < this.concurrentUsers; i++) {
            userPromises.push(this.runUser(i));
        }
        
        // Wait for test completion
        await Promise.all(userPromises);
        
        // Calculate results
        const avgResponseTime = this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
        
        // Use steady-state TPS (exclude first and last 5 seconds)
        const steadyStateTPS = this.tpsSnapshots.slice(5, -5);
        const avgTPS = steadyStateTPS.reduce((a, b) => a + b, 0) / steadyStateTPS.length;
        
        return {
            concurrentUsers: this.concurrentUsers,
            totalRequests: this.completedRequests,
            avgTPS: avgTPS.toFixed(2),
            avgResponseTime: avgResponseTime.toFixed(2),
            p95ResponseTime: this.percentile(this.responseTimes, 95).toFixed(2),
            p99ResponseTime: this.percentile(this.responseTimes, 99).toFixed(2),
            errors: this.errors,
            errorRate: ((this.errors / (this.completedRequests + this.errors)) * 100).toFixed(2)
        };
    }
    
    percentile(arr, p) {
        const sorted = arr.sort((a, b) => a - b);
        const index = Math.ceil((p / 100) * sorted.length) - 1;
        return sorted[index];
    }
}

async function runThroughputTest() {
    console.log('=== Throughput Test ===\n');
    
    const userCounts = [10, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
    const results = [];
    
    for (const userCount of userCounts) {
        const tester = new LoadTester(userCount);
        const result = await tester.run();
        results.push(result);
        
        console.log(`\nResults for ${userCount} users:`);
        console.log(`  Average TPS: ${result.avgTPS}, Error Rate: ${result.errorRate}%, Avg Response Time: ${result.avgResponseTime}ms, P95 Response Time: ${result.p95ResponseTime}ms`);
        
        // Wait between tests
        await new Promise(resolve => setTimeout(resolve, 10000));
    }
    
    console.log('\n=== FINAL RESULTS ===');
    console.table(results);
    
    // Save results
    fs.writeFileSync('corrected-throughput-results.json', JSON.stringify(results, null, 2));
}

runThroughputTest().catch(console.error);