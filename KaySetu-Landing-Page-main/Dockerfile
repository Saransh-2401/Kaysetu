# KaySetu marketing site (kaysetu.in).
#
# Runs `next start` against a normal build rather than the smaller `standalone`
# output, because next.config.ts does not set `output: "standalone"`. If that is
# ever enabled, switch the runner to copy .next/standalone + .next/static and
# run `node server.js` instead — the image gets a lot smaller.
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Baked into the client bundle at BUILD time — the browser posts leads here.
ARG NEXT_PUBLIC_API_BASE_URL=https://api.kaysetu.in/api
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
# Production deps only — dev toolchain has no business in the runtime image.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.ts ./next.config.ts
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/ || exit 1
CMD ["npx", "next", "start"]
