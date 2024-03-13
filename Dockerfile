# This dockerfile is solely to build locally in vercel's env to cache builds for turbo

FROM amazonlinux:2023 as base

# The web Dockerfile is copy-pasted into our main docs at /docs/handbook/deploying-with-docker.
# Make sure you update this Dockerfile, the Dockerfile in the web workspace and copy that over to Dockerfile in the docs.

FROM base AS installer
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
# Set working directory
WORKDIR /usr/app
RUN yum install nodejs20 npm -y
RUN npm i turbo -g
COPY package*.json .
COPY apps/lambdas/package*.json apps/lambdas/
COPY apps/web/package*.json apps/web/
COPY packages/components/package*.json packages/components/
COPY packages/config-eslint/package*.json packages/config-eslint/
COPY packages/config-typescript/package*.json packages/config-typescript/
COPY packages/db/package*.json packages/db/
COPY packages/types/package*.json packages/types/
COPY packages/utils/package*.json packages/utils/
RUN npm i

FROM base as builder

COPY . .
COPY --from=installer . .

# Uncomment and use build args to enable remote caching
ARG TURBO_TEAM
ENV TURBO_TEAM=$TURBO_TEAM

ARG TURBO_TOKEN
ENV TURBO_TOKEN=$TURBO_TOKEN

RUN npx turbo build
