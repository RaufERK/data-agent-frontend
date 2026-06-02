FROM sberworks.ru/base/docker.io/nginx:1.29.3-alpine3.22

COPY nginx.conf /etc/nginx/nginx.conf
COPY index.html /usr/share/nginx/html/index.html
