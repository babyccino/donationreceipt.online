# This dockerfile is solely to build locally in vercel's env to cache builds for turbo

FROM amazonlinux:2023 as base
RUN yum install nodejs20 npm -y

# The web Dockerfile is copy-pasted into our main docs at /docs/handbook/deploying-with-docker.
# Make sure you update this Dockerfile, the Dockerfile in the web workspace and copy that over to Dockerfile in the docs.

FROM base AS builder
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
# Set working directory
WORKDIR /usr/app
RUN npm i turbo -g
COPY . .
RUN npx turbo prune web --docker

# Add lockfile and package.json's of isolated subworkspace
FROM base AS installer
WORKDIR /usr/app
RUN npm i turbo -g

# First install dependencies (as they change less often)
COPY --from=builder /usr/app/out/json/ .
COPY --from=builder /usr/app/out/package-lock.json ./package-lock.json
RUN npm i
RUN npm run patch

# Build the project and its dependencies
COPY --from=builder /usr/app/out/full/ .
COPY turbo.json turbo.json

# Uncomment and use build args to enable remote caching
ARG TURBO_TEAM
ENV TURBO_TEAM=$TURBO_TEAM

ARG TURBO_TOKEN
ENV TURBO_TOKEN=$TURBO_TOKEN

RUN npx turbo build --filter=web...
