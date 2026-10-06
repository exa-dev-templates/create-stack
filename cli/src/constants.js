const path = require('path');

// Root path to the templates directory (parent of cli/)
const TEMPLATES_ROOT = path.resolve(__dirname, '../../');

const TEMPLATES = {
  frontend: [
    {
      id: 'template-react',
      name: 'React 19 + TypeScript',
      framework: 'React / Vite',
      description: 'SPA Client (Vite, TypeScript, Tailwind, ESLint)',
      defaultFolder: 'frontend',
      devPort: 5173,
      commands: {
        install: 'npm install',
        dev: 'npm run dev',
        build: 'npm run build'
      }
    },
    {
      id: 'template-vue',
      name: 'Vue 3 + TypeScript',
      framework: 'Vue / Vite',
      description: 'SPA Client (Vite, TypeScript, Tailwind, ESLint)',
      defaultFolder: 'frontend',
      devPort: 5173,
      commands: {
        install: 'npm install',
        dev: 'npm run dev',
        build: 'npm run build'
      }
    }
  ],
  backend: [
    {
      id: 'template-express',
      name: 'Express.js (TypeScript)',
      framework: 'Node.js / Express',
      description: 'Clean Architecture, PostgreSQL, Redis, RabbitMQ, JWT, Realtime (WS/SSE)',
      defaultFolder: 'backend',
      devPort: 5000,
      commands: {
        install: 'npm install',
        dev: 'npm run dev',
        build: 'npm run build'
      }
    },
    {
      id: 'template-fastapi-async',
      name: 'FastAPI Async (Python 3)',
      framework: 'Python / FastAPI',
      description: 'Clean Architecture, PostgreSQL, Redis, RabbitMQ, JWT, Realtime (WS/SSE)',
      defaultFolder: 'backend',
      devPort: 8000,
      commands: {
        install: 'python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt',
        dev: 'source .venv/bin/activate && uvicorn app:app --reload'
      }
    },
    {
      id: 'template-golang',
      name: 'Golang (Fiber v2)',
      framework: 'Go / Fiber',
      description: 'Clean Architecture, PostgreSQL, Redis, RabbitMQ, JWT, Realtime (WS)',
      defaultFolder: 'backend',
      devPort: 8080,
      commands: {
        install: 'go mod download',
        dev: 'go run main.go'
      }
    },
    {
      id: 'template-java',
      name: 'Java (Spring Boot 3)',
      framework: 'Java / Spring Boot',
      description: 'Clean Architecture, PostgreSQL, Redis, RabbitMQ, JWT, Realtime (WS/SSE)',
      defaultFolder: 'backend',
      devPort: 8080,
      commands: {
        install: './mvnw clean install -DskipTests',
        dev: './mvnw spring-boot:run'
      }
    }
  ],
  worker: [
    {
      id: 'template-worker-golang',
      name: 'Golang Worker',
      framework: 'Go / RabbitMQ',
      description: 'RabbitMQ Consumer (Ack/Nack, QoS Prefetch, Graceful Shutdown)',
      defaultFolder: 'worker',
      commands: {
        install: 'go mod download',
        dev: 'go run main.go'
      }
    },
    {
      id: 'template-worker-java',
      name: 'Java Worker',
      framework: 'Java / RabbitMQ',
      description: 'RabbitMQ Consumer (Ack/Nack, QoS Prefetch, Graceful Shutdown)',
      defaultFolder: 'worker',
      commands: {
        install: './mvnw clean install',
        dev: './mvnw compile exec:java'
      }
    },
    {
      id: 'template-worker-python',
      name: 'Python Worker',
      framework: 'Python / RabbitMQ',
      description: 'RabbitMQ Consumer (Ack/Nack, QoS Prefetch, Graceful Shutdown)',
      defaultFolder: 'worker',
      commands: {
        install: 'python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt',
        dev: 'source .venv/bin/activate && python main.py'
      }
    },
    {
      id: 'template-worker-typescript',
      name: 'TypeScript Worker',
      framework: 'Node.js / RabbitMQ',
      description: 'RabbitMQ Consumer (Ack/Nack, QoS Prefetch, Graceful Shutdown)',
      defaultFolder: 'worker',
      commands: {
        install: 'npm install',
        dev: 'npm run dev'
      }
    }
  ]
};

// Files & directories to exclude when copying template
const IGNORED_ENTRIES = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'target',
  '.venv',
  'venv',
  '__pycache__',
  '.DS_Store',
  '.idea',
  '.vscode'
]);

module.exports = {
  TEMPLATES_ROOT,
  TEMPLATES,
  IGNORED_ENTRIES
};
