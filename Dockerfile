# Stage 1: Build SvelteKit static SPA
FROM node:22-slim AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY svelte.config.js vite.config.ts tsconfig.json ./
COPY src/ src/
COPY static/ static/
RUN npm run build

# Stage 2: Python backend serving API + static files
FROM python:3.11-slim
WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn

COPY backend/*.py ./
COPY --from=frontend /app/build /app/static

ENV PORT=8080
CMD ["gunicorn", "app:app", "-b", "0.0.0.0:8080", "-w", "2", "--timeout", "120"]
