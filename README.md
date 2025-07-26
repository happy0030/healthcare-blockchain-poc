# PoC Setup

## Prerequisites

- Ubuntu 20.04+ LTS or Windows 10+ with WSL2
- Docker 20.10+
- Docker Compose 1.29+
- Node.js 16.x LTS
- Git 2.25+

## Installation

### 1. Install Hyperledger Fabric

```bash
# Create project directory
mkdir -p ~/blockchain-healthcare
cd ~/blockchain-healthcare

# Download Fabric samples, binaries and docker images
curl -sSL https://bit.ly/2ysbOFE | bash -s -- 2.2.0 1.5.0

# Add binaries to PATH
export PATH=$PATH:~/blockchain-healthcare/fabric-samples/bin
```

### 2. Clone the Repository

```bash
cd ~/blockchain-healthcare
git clone https://github.com/happy0030/healthcare-blockchain-poc.git
cd healthcare-blockchain-poc
```

### 3. Install Dependencies

```bash
# Install API dependencies
cd healthcare-api
npm install

# Install UI dependencies
cd ../healthcare-ui
npm install
```

## Starting the Application

### 1. Start Blockchain Network (please ensure Docker Desktop is up and running and linked with WSL)

```bash
# Navigate to Fabric test network
cd ~/blockchain-healthcare/fabric-samples/test-network

# Start the network
./network.sh up createChannel -ca -c healthchannel
```

### 2. Deploy Smart Contract

```bash
# Navigate to project directory
cd ~/blockchain-healthcare/healthcare-blockchain-poc

# Make deployment script executable
chmod +x clean-deploy.sh

# Deploy the chaincode
./clean-deploy.sh
```

### 3. Start Backend API

```bash
# In a new terminal
cd ~/blockchain-healthcare/healthcare-blockchain-poc/healthcare-api

# Start the API server
npm run dev
```

The API will run on http://localhost:3000

### 4. Start Frontend UI

```bash
# In another new terminal
cd ~/blockchain-healthcare/healthcare-blockchain-poc/healthcare-ui

# Start the React app
npm start
```

The UI will open automatically at http://localhost:3001

## Quick Test

To verify everything is working:

1. Open http://localhost:3001 in your browser
2. Initialize the ledger by running the below command in a new terminal:
```bash
# In a new terminal
cd ~/blockchain-healthcare/healthcare-blockchain-poc/healthcare-api

# Run Test Data for Ledger Initialization
node testData.js
``` 
3. Try adding patient data and accessing it with different roles

## Stopping the Application

```bash
# Stop the React app and API server with Ctrl+C in their respective terminals

# Stop the blockchain network
cd ~/blockchain-healthcare/fabric-samples/test-network
./network.sh down
```