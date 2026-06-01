ARG NODE_IMAGE
ARG NGINX_IMAGE

FROM ${NODE_IMAGE} AS build

ARG NPM_REGISTRY
ENV NPM_CONFIG_REGISTRY=${NPM_REGISTRY}
ENV NPM_CONFIG_REPLACE_REGISTRY_HOST=always

WORKDIR /app

COPY package.json ./
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc,required=false \
    test -n "${NPM_REGISTRY}" \
    && npm install --no-package-lock

COPY index.html vite.config.ts tsconfig.json tsconfig.node.json ./
COPY public ./public
COPY src ./src
RUN npm run build

FROM ${NGINX_IMAGE}

COPY --from=build /app/dist /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
