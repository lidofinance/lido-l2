#!/bin/bash

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
output=$(npm run deploy-mock-agent)
formatAndAppendOrUpdate "$output" "CONTRACTS_L1_GOVERNANCE_AGENT_ADDR"

# DEPLOY L1 EXECUTOR
output=$(npm run deploy-l1-executor)
formatAndAppendOrUpdate "$output" "L1_EXECUTOR_ADDR"

cd ../l2

# DEPLOY L2 BRIDGE EXECUTOR
output=$(npm run deploy-governance-bridge)
formatAndAppendOrUpdate "$output" "L2_BRIDGE_EXECUTOR_ADDR"

cd ../l1

# DEPLOY L1 BRIDGE
output=$(npm run deploy-bridges)

## CONTRACTS_L1_LIDO_TOKEN_ADDR
formatAndAppendOrUpdate "$output" "CONTRACTS_L1_LIDO_TOKEN_ADDR"

## CONTRACTS_L1_LIDO_BRIDGE_IMPL_ADDR
formatAndAppendOrUpdate "$output" "CONTRACTS_L1_LIDO_BRIDGE_IMPL_ADDR"

## CONTRACTS_L1_LIDO_BRIDGE_PROXY_ADDR
formatAndAppendOrUpdate "$output" "CONTRACTS_L1_LIDO_BRIDGE_PROXY_ADDR"

cd ../l2

# DEPLOY wstETH TOKEN
output=$(npm run deploy-wsteth-token)
formatAndAppendOrUpdate "$output" "CONTRACTS_L2_LIDO_TOKEN_ADDR"

cd ../l1

# INITIALIZE BRIDGES
output=$(npm run initialize-bridges)
formatAndAppendOrUpdate "$output" "CONTRACTS_L2_LIDO_BRIDGE_PROXY_ADDR"

cd ../l2

# CONNECT L2 BRIDGE TO L2 TOKEN
npm run connect-token-to-bridge

cd ../l1

# INITIALIZE BRIDGE ROLES
npm run init-bridge-roles

# ENABLE DEPOSITS
npm run enable-deposits

# ENABLE WITHDRAWALS
npm run enable-withdrawals
