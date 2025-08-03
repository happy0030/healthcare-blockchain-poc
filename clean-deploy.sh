#!/bin/bash

echo "Clean deployment of Healthcare Privacy Contract..."

cd ~/blockchain-healthcare/fabric-samples/test-network
export PATH=${PWD}/../bin:$PATH
export FABRIC_CFG_PATH=$PWD/../config/

# Clean up old containers and images
echo "Cleaning up old chaincode containers..."
docker rm -f $(docker ps -aq -f name=healthcare-privacy) 2>/dev/null || true
docker rmi -f $(docker images -q dev-peer*healthcare-privacy*) 2>/dev/null || true

# Remove old packages
rm -f healthcare-privacy*.tar.gz

# Package with new version
echo "Packaging chaincode v1.0..."
peer lifecycle chaincode package healthcare-privacy-v1.0.tar.gz \
  --path ~/blockchain-healthcare/healthcare-privacy-poc/contracts \
  --lang node \
  --label healthcare-privacy_1.0

# Function to set peer env
setOrg1Env() {
    export CORE_PEER_TLS_ENABLED=true
    export CORE_PEER_LOCALMSPID="Org1MSP"
    ORG1_BASE_PATH="$PWD/organizations/peerOrganizations/org1.example.com"
    export CORE_PEER_TLS_ROOTCERT_FILE="${ORG1_BASE_PATH}/peers/peer0.org1.example.com/tls/ca.crt"
    export CORE_PEER_MSPCONFIGPATH="${ORG1_BASE_PATH}/users/Admin@org1.example.com/msp"
    export CORE_PEER_ADDRESS=localhost:7051
}

setOrg2Env() {
    export CORE_PEER_TLS_ENABLED=true
    export CORE_PEER_LOCALMSPID="Org2MSP"
    ORG2_BASE_PATH="$PWD/organizations/peerOrganizations/org2.example.com"
    export CORE_PEER_TLS_ROOTCERT_FILE="${ORG2_BASE_PATH}/peers/peer0.org2.example.com/tls/ca.crt"
    export CORE_PEER_MSPCONFIGPATH="${ORG2_BASE_PATH}/users/Admin@org2.example.com/msp"
    export CORE_PEER_ADDRESS=localhost:9051
}

# Install on both orgs
echo "Installing on Org1..."
setOrg1Env
peer lifecycle chaincode install healthcare-privacy-v1.0.tar.gz

echo "Installing on Org2..."
setOrg2Env
peer lifecycle chaincode install healthcare-privacy-v1.0.tar.gz

# Get package ID
PACKAGE_ID=$(peer lifecycle chaincode queryinstalled | grep "healthcare-privacy_1.0" | awk '{print $3}' | cut -d',' -f1)
echo "Package ID: $PACKAGE_ID"

# Get current sequence
CURRENT_SEQ=$(peer lifecycle chaincode querycommitted --channelID healthchannel --name healthcare-privacy 2>/dev/null | grep -oP 'Sequence: \K[0-9]+' || echo "0")
NEW_SEQ=$((CURRENT_SEQ + 1))
echo "Using sequence: $NEW_SEQ"

ORDERER_CERT_AUTH_PATH="$PWD/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem"
ORG1_CERT_AUTH_PATH="$PWD/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt"
ORG2_CERT_AUTH_PATH="$PWD/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt"

# Approve for both orgs
echo "Approving for Org2..."
peer lifecycle chaincode approveformyorg -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com --channelID healthchannel --name healthcare-privacy --version 1.1 --package-id $PACKAGE_ID --sequence $NEW_SEQ --tls --cafile "${ORDERER_CERT_AUTH_PATH}"

echo "Approving for Org1..."
setOrg1Env
peer lifecycle chaincode approveformyorg -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com --channelID healthchannel --name healthcare-privacy --version 1.1 --package-id $PACKAGE_ID --sequence $NEW_SEQ --tls --cafile "${ORDERER_CERT_AUTH_PATH}"

# Check commit readiness
echo "Checking commit readiness..."
peer lifecycle chaincode checkcommitreadiness --channelID healthchannel --name healthcare-privacy --version 1.1 --sequence $NEW_SEQ --tls --cafile "${ORDERER_CERT_AUTH_PATH}" --output json

# Commit
echo "Committing chaincode..."
peer lifecycle chaincode commit -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com --channelID healthchannel --name healthcare-privacy --version 1.1 --sequence $NEW_SEQ --tls --cafile "${ORDERER_CERT_AUTH_PATH}" --peerAddresses localhost:7051 --tlsRootCertFiles "${ORG1_CERT_AUTH_PATH}" --peerAddresses localhost:9051 --tlsRootCertFiles "${ORG2_CERT_AUTH_PATH}"

echo "Deployment complete! Testing..."

# Test
sleep 3
peer chaincode invoke -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com --tls --cafile "${ORDERER_CERT_AUTH_PATH}" -C healthchannel -n healthcare-privacy --peerAddresses localhost:7051 --tlsRootCertFiles "${ORG1_CERT_AUTH_PATH}" --peerAddresses localhost:9051 --tlsRootCertFiles "${ORG2_CERT_AUTH_PATH}" -c '{"function":"InitLedger","Args":[]}'

echo "Success!"
