FROM node:20-alpine AS base
WORKDIR /app
# Prisma's CLI (used for `migrate deploy` at boot) needs OpenSSL on Alpine.
RUN apk add --no-cache openssl

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
# node_modules comes from `build`, not `deps`: `prisma generate` writes the
# client into node_modules/.prisma, so copying from `deps` would ship an
# ungenerated client and fail at runtime.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
# prisma/seed.ts imports the catalogues from src/, so the sources ship too.
COPY --from=build /app/src ./src
COPY package.json tsconfig.json ./

# DATABASE_URL and DIRECT_URL come from the environment — the database is a
# Supabase project, not anything this image can carry.

EXPOSE 3000
# Migrations and reference data are idempotent, so running them on every boot
# keeps a fresh machine and a redeployed one on the same schema.
CMD ["sh", "-c", "npx prisma migrate deploy && npx ts-node prisma/seed.ts && node dist/main"]
