# build
docker build --build-arg TURBO_TEAM=babyccino,TURBO_TOKEN=RzOeTr289p6T6ksMCFBwlRC5 --platform linux/arm64 \
    -f ./apps/lambdas/Dockerfile -t $ECR_REPO/$TAG

# run
docker run -m 1024m --rm --env-file ./apps/lambdas/.env --platform linux/arm64 -p 9000:8080 -it \
    $ECR_REPO/$TAG

# test run
docker run -m 1024m --rm --env-file ./apps/lambdas/.env --platform linux/arm64 -p 9000:8080 -it \
    dono-test

# login
aws ecr get-login-password --region us-east-2 | docker login --username AWS --password-stdin \
    $ECR_REPO

# tag
docker tag dono-lambda:0.1 $ECR_REPO/$TAG

# push
docker push $ECR_REPO/$TAG

# build & push
docker build --build-arg TURBO_TEAM=babyccino,TURBO_TOKEN=RzOeTr289p6T6ksMCFBwlRC5 --platform linux/arm64 \
    -f ./apps/lambdas/Dockerfile -t $ECR_REPO/$TAG . \
    && docker push $ECR_REPO/$TAG

# deploy
aws lambda update-function-code --function-name dono-lambda --image-uri $ECR_REPO/$TAG
