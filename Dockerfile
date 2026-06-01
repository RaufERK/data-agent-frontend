ARG NODE_IMAGE=node:20-alpine
ARG NGINX_IMAGE=nginx:alpine

FROM ${NODE_IMAGE} AS build

ARG NPM_REGISTRY=https://registry.npmjs.org

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --registry="${NPM_REGISTRY}"

COPY index.html vite.config.ts tsconfig.json tsconfig.node.json ./
COPY public ./public
COPY src ./src
RUN npm run build

FROM ${NGINX_IMAGE}

COPY --from=build /app/dist /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
