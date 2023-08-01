#!/bin/bash

echo "COMPILE L1 CONTRACTS"

cd ./l1

npm run compile

echo "COMPILE L2 CONTRACTS"

cd ../l2

npm run compile

