# KaySetu frontend — Next.js standalone build (small runtime image, K8s-ready).
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* is inlined into the client bundle at BUILD time.
ARG NEXT_PUBLIC_API_BASE=http://localhost:8000/api
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE
# Where tenant-facing links (signup success, brand link) send people.
ARG NEXT_PUBLIC_PORTAL_URL=http://localhost:3001
ENV NEXT_PUBLIC_PORTAL_URL=$NEXT_PUBLIC_PORTAL_URL
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/ || exit 1
CMD ["node", "server.js"]
