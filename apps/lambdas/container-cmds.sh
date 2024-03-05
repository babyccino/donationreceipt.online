# build
docker build --build-arg TURBO_TEAM=babyccino,TURBO_TOKEN=RzOeTr289p6T6ksMCFBwlRC5 --platform linux/arm64 \
    -f ./apps/lambdas/Dockerfile -t AWS_ID.dkr.ecr.us-east-2.amazonaws.com/donationreceipt-online:latest .

# test build
docker build --build-arg TURBO_TEAM=babyccino,TURBO_TOKEN=RzOeTr289p6T6ksMCFBwlRC5 --platform linux/arm64 \
    -f ./Dockerfile -t dono-test .

# run
docker run -m 1024m --rm --env-file ./apps/lambdas/.env --platform linux/arm64 -p 9000:8080 -it \
    AWS_ID.dkr.ecr.us-east-2.amazonaws.com/donationreceipt-online:latest

# test run
docker run -m 1024m --rm --env-file ./apps/lambdas/.env --platform linux/arm64 -p 9000:8080 -it \
    dono-test


# login
aws ecr get-login-password --region us-east-2 | docker login --username AWS --password-stdin \
    AWS_ID.dkr.ecr.us-east-2.amazonaws.com

# tag
docker tag dono-lambda:0.1 AWS_ID.dkr.ecr.us-east-2.amazonaws.com/donationreceipt-online:latest

# push
docker push AWS_ID.dkr.ecr.us-east-2.amazonaws.com/donationreceipt-online:latest
