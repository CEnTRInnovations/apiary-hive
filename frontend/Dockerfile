# Build context: frontend/ (see docker-compose.yml). @centrinnovations/design is now a git
# dependency (github.com/CEnTRInnovations/centr-design) resolved by pnpm directly — no local
# packages/design/ to copy in anymore.
FROM node:20-slim AS build
RUN npm install -g pnpm
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
