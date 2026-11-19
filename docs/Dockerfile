# Stage 1: Build static assets with Node.js 22
FROM node:22-alpine AS builder
WORKDIR /app

ENV CUSTOM_DOMAIN=stack.eka-dev.cloud

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Minimalist Nginx runtime
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
STOPSIGNAL SIGQUIT
CMD ["nginx", "-g", "daemon off;"]
