# SOPstart on Fly.io (Sydney, next to the Supabase database). An always-on Node server:
# parse, the clear version and the sign-off ledger keep working after the response.
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY scripts/copy-ffmpeg.js scripts/copy-ffmpeg.js
RUN npm ci
COPY . .
# Public values baked into the browser bundle (fly.toml [build.args]).
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-bookworm-slim
WORKDIR /app
COPY --from=build /app ./
# The commit being served, for /api/version (the deployed-eval runner waits on it).
ARG GIT_SHA
ENV NODE_ENV=production PORT=8080 GIT_SHA=$GIT_SHA NEXT_TELEMETRY_DISABLED=1
EXPOSE 8080
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "8080"]
