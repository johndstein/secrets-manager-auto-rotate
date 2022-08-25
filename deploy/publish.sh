#!/usr/bin/env bash

dir=$(cd -P -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
cd "${dir}"
cd ..

# function name defaults to the name of the directory this script is in.
lambda_name="${PWD##*/}"
lambda_name=jdssecretrotate

echo "lambda_name: ${lambda_name}"

aws lambda update-function-code \
  --function-name "${lambda_name}"  \
  --region "${AWS_REGION}" \
  --zip-file "fileb://./lambda.zip"
