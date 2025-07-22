const { Gateway, Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const path = require('path');
const fs = require('fs');

class FabricNetwork {
    constructor() {
        this.gateway = new Gateway();
        this.network = null;
        this.contract = null;
    }

    async connect() {
        try {
            // Load connection profile
            const ccpPath = path.resolve(__dirname, '..', '..', process.env.CONNECTION_PROFILE_PATH);
            const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

            // Create wallet for managing identities
            const walletPath = path.join(process.cwd(), process.env.WALLET_PATH);
            const wallet = await Wallets.newFileSystemWallet(walletPath);

            // Check if user identity exists
            const identity = await wallet.get(process.env.IDENTITY);
            if (!identity) {
                console.log('Creating new identity...');
                await this.enrollAdmin(wallet, ccp);
                await this.registerUser(wallet, ccp);
            }

            // Connect to gateway
            await this.gateway.connect(ccp, {
                wallet,
                identity: process.env.IDENTITY,
                discovery: { enabled: true, asLocalhost: true }
            });

            // Get network and contract
            this.network = await this.gateway.getNetwork(process.env.CHANNEL_NAME);
            this.contract = this.network.getContract(process.env.CHAINCODE_NAME);

            console.log('Connected to Fabric network successfully');
        } catch (error) {
            console.error(`Failed to connect to network: ${error}`);
            throw error;
        }
    }

    async enrollAdmin(wallet, ccp) {
        try {
            // Create CA client
            const caInfo = ccp.certificateAuthorities['ca.org1.example.com'];
            const caTLSCACerts = caInfo.tlsCACerts.pem;
            const ca = new FabricCAServices(caInfo.url, { trustedRoots: caTLSCACerts, verify: false }, caInfo.caName);

            // Enroll admin
            const enrollment = await ca.enroll({ enrollmentID: 'admin', enrollmentSecret: 'adminpw' });
            const x509Identity = {
                credentials: {
                    certificate: enrollment.certificate,
                    privateKey: enrollment.key.toBytes(),
                },
                mspId: process.env.ORG_MSP,
                type: 'X.509',
            };
            await wallet.put('admin', x509Identity);
            console.log('Successfully enrolled admin user');
        } catch (error) {
            console.error(`Failed to enroll admin: ${error}`);
            throw error;
        }
    }

    async registerUser(wallet, ccp) {
        try {
            // Get admin identity
            const adminIdentity = await wallet.get('admin');
            if (!adminIdentity) {
                throw new Error('Admin identity not found');
            }

            // Build admin user context
            const provider = wallet.getProviderRegistry().getProvider(adminIdentity.type);
            const adminUser = await provider.getUserContext(adminIdentity, 'admin');

            // Create CA client
            const caInfo = ccp.certificateAuthorities['ca.org1.example.com'];
            const caTLSCACerts = caInfo.tlsCACerts.pem;
            const ca = new FabricCAServices(caInfo.url, { trustedRoots: caTLSCACerts, verify: false }, caInfo.caName);

            // Register user
            const secret = await ca.register({
                affiliation: 'org1.department1',
                enrollmentID: process.env.IDENTITY,
                role: 'client'
            }, adminUser);

            // Enroll user
            const enrollment = await ca.enroll({
                enrollmentID: process.env.IDENTITY,
                enrollmentSecret: secret
            });

            const x509Identity = {
                credentials: {
                    certificate: enrollment.certificate,
                    privateKey: enrollment.key.toBytes(),
                },
                mspId: process.env.ORG_MSP,
                type: 'X.509',
            };

            await wallet.put(process.env.IDENTITY, x509Identity);
            console.log(`Successfully registered and enrolled user ${process.env.IDENTITY}`);
        } catch (error) {
            console.error(`Failed to register user: ${error}`);
            throw error;
        }
    }

    async disconnect() {
        if (this.gateway) {
            await this.gateway.disconnect();
        }
    }

    getContract() {
        return this.contract;
    }
}

module.exports = FabricNetwork;
