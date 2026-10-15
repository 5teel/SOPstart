# ADR-0017: The app is hosted in Sydney, next to its database

- **Status:** Accepted
- **Date:** 2026-10-15
- **Decided by:** Simon ("yes move hosting to sydney"; Fly.io chosen after Railway was found to have no Australian region)
- **Supersedes:** hosting on Railway (Singapore)
- **Enforced by:** `fly.toml` (`primary_region = 'syd'`), `.github/workflows/fly-deploy.yml`

## Context
The Supabase database is in Sydney (ap-southeast-2). Railway ran the app in Singapore and has no Australian region, so every database call cost ~300 ms; Send for sign-off took ~2 s, a photo ~10 s.

## Decision
1. The app runs on **Fly.io in Sydney (`syd`)** as an always-on Node server from the `Dockerfile` (no serverless: parse, the clear version and the sign-off ledger finish after the response).
2. **Push to master deploys** through the GitHub Action; the image carries `GIT_SHA` for `/api/version`.
3. Secrets live in Fly (`fly secrets`); the three `NEXT_PUBLIC_*` values are build args in `fly.toml`.
4. DNS: `sopstart.com` A/AAAA → Fly (Cloudflare, DNS only); www redirects at Cloudflare.

## Consequences
- Measured on the deployed site: start 2.9 s → 1.0 s, photo 10 s → 3 s, Send 1.9 s → 0.9 s.
- Two machines in `syd` for zero-downtime deploys (~US$20–25/month).
- Any new host or region must sit in the database's region.

## How to comply
- Never move the app or the database out of the same region.
- New environment variables: `fly secrets set` (server) or `fly.toml [build.args]` (public, browser).
