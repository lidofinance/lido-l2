#!/bin/bash

# Load environment variables from the .env file
source .env

ENV_LOCATION="../.env"

set -e

echo "DEPLOYING LIDO BRIDGE"
echo "======================="

formatAndAppendOrUpdate(){
	line=$(echo "$1" | grep "$2")
	address=$(echo "$line" | awk -F'=' '{print $2}')
	echo "$2=$address"
	appendOrUpdate "$2" "$address" "$ENV_LOCATION"
}

appendOrUpdate(){
	# Check if the line exists in .env
	if grep -q "$1=" "$3"; then
		# Update the line in .env
		if [[ "$OSTYPE" == "darwin"* ]]; then
			# sed -i is case insensitive in OSX thats why single quotes are added
			sed -i '' "s|^$1=.*$|$1=$2|" "$3"
		else
			sed -i "s|^$1=.*$|$1=$2|" "$3"
		fi
	else
		# Append the line to .env
		echo "$1=$address" >> "$3"
	fi
}

cd ./l1

# DEPLOY MOCK AGENT
if [ "$NODE_ENV" = "local" ]; then
    output=$(npm run deploy-mock-agent)
    formatAndAppendOrUpdate "$output" "CONTRACTS_L1_GOVERNANCE_AGENT_ADDR"
else
    echo 'Skipping agent deployment'
fi

echo "==============================="
echo "DEPLOYING L1 EXECUTOR"
# DEPLOY L1 EXECUTOR
output=$(npm run deploy-l1-executor)
echo $output
formatAndAppendOrUpdate "$output" "L1_EXECUTOR_ADDR"

cd ../l2

echo "==============================="
echo "DEPLOY L2 BRIDGE EXECUTOR"
# DEPLOY L2 BRIDGE EXECUTOR
output=$(npm run deploy-governance-bridge)
echo $output
formatAndAppendOrUpdate "$output" "L2_BRIDGE_EXECUTOR_ADDR"

cd ../l1

echo "==============================="
echo "DEPLOYING L1 BRIDGE"
# DEPLOY L1 BRIDGE
output=$(npm run deploy-bridges)

## CONTRACTS_L1_LIDO_TOKEN_ADDR
if [ "$NODE_ENV" = "local" ]; then
	formatAndAppendOrUpdate "$output" "CONTRACTS_L1_LIDO_TOKEN_ADDR"
else
    echo 'Skipping CONTRACTS_L1_LIDO_TOKEN_ADDR deployment'
fi

## CONTRACTS_L1_LIDO_BRIDGE_IMPL_ADDR
formatAndAppendOrUpdate "$output" "CONTRACTS_L1_LIDO_BRIDGE_IMPL_ADDR"

## CONTRACTS_L1_LIDO_BRIDGE_PROXY_ADDR
formatAndAppendOrUpdate "$output" "CONTRACTS_L1_LIDO_BRIDGE_PROXY_ADDR"

cd ../l2

echo "==============================="
echo "DEPLOYING wstETH TOKEN"
# DEPLOY wstETH TOKEN
output=$(npm run deploy-wsteth-token)
echo $output
formatAndAppendOrUpdate "$output" "CONTRACTS_L2_LIDO_TOKEN_ADDR"

cd ../l1

echo "==============================="
echo "INITIALIZING BRIDGES"
# INITIALIZE BRIDGES
output=$(npm run initialize-bridges)
formatAndAppendOrUpdate "$output" "CONTRACTS_L2_LIDO_BRIDGE_PROXY_ADDR"

cd ../l2

echo "==============================="
echo "CONNECTING L2 BRIDGE TO L2 TOKEN"
# CONNECT L2 BRIDGE TO L2 TOKEN
npm run connect-token-to-bridge

cd ../l1

echo "==============================="
echo "INITIALIZING BRIDGE ROLES"
# INITIALIZE BRIDGE ROLES
npm run init-bridge-roles