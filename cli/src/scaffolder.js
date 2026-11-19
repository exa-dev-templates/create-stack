const fs = require('fs-extra');
const path = require('path');
const { TEMPLATES_ROOT } = require('./constants');
const {
  copyTemplateDir,
  customizeTemplateFiles,
  initGitRepo
} = require('./utils');
const { transformBackendDatabase } = require('./transformers/databaseTransformer');

/**
 * Generates a fullstack project combining multiple templates
 */
async function scaffoldFullstackProject(options) {
  const {
    targetDir,
    projectName,
    frontend,
    backend,
    worker,
    database = 'postgres',
    messageBroker = 'both',
    createEnv = true,
    initGit = true
  } = options;

  await fs.ensureDir(targetDir);

  const installedServices = [];

  // 1. Copy Frontend
  if (frontend) {
    const src = path.join(TEMPLATES_ROOT, frontend.id);
    const dest = path.join(targetDir, frontend.defaultFolder || 'frontend');
    await copyTemplateDir(src, dest);
    await customizeTemplateFiles(dest, projectName, 'frontend');
    if (createEnv && await fs.pathExists(path.join(dest, '.env.example'))) {
      await fs.copy(path.join(dest, '.env.example'), path.join(dest, '.env'));
    }
    installedServices.push({ role: 'Frontend', info: frontend, folder: frontend.defaultFolder || 'frontend' });
  }

  // 2. Copy Backend
  if (backend) {
    const src = path.join(TEMPLATES_ROOT, backend.id);
    const dest = path.join(targetDir, backend.defaultFolder || 'backend');
    await copyTemplateDir(src, dest);
    await customizeTemplateFiles(dest, projectName, 'backend');
    if (database && database !== 'postgres') {
      await transformBackendDatabase(dest, backend.id, database);
    }
    if (createEnv && await fs.pathExists(path.join(dest, '.env.example'))) {
      await fs.copy(path.join(dest, '.env.example'), path.join(dest, '.env'));
    }
    installedServices.push({ role: 'Backend', info: backend, folder: backend.defaultFolder || 'backend', database });
  }

  // 3. Copy Worker
  if (worker) {
    const src = path.join(TEMPLATES_ROOT, worker.id);
    const dest = path.join(targetDir, worker.defaultFolder || 'worker');
    await copyTemplateDir(src, dest);
    await customizeTemplateFiles(dest, projectName, 'worker');
    if (createEnv && await fs.pathExists(path.join(dest, '.env.example'))) {
      await fs.copy(path.join(dest, '.env.example'), path.join(dest, '.env'));
    }
    installedServices.push({ role: 'Worker', info: worker, folder: worker.defaultFolder || 'worker' });
  }

  // 4. Merge service .agents to root .agents so root workspace has all AI skills
  for (const s of installedServices) {
    const serviceAgents = path.join(targetDir, s.folder, '.agents');
    if (await fs.pathExists(serviceAgents)) {
      await fs.copy(serviceAgents, path.join(targetDir, '.agents'), { overwrite: false });
    }
  }

  // 5. Generate docker-compose.infra.yml
  await generateDockerComposeInfra(targetDir, { database, backend, worker, messageBroker });

  // 6. Generate Root README.md
  await generateRootReadme(targetDir, projectName, installedServices, { messageBroker });

  // 7. Generate Root .gitignore
  await generateRootGitignore(targetDir);

  // 8. Generate Root package.json for convenience runner scripts
  await generateRootPackageJson(targetDir, projectName, installedServices);

  // 9. Git Init
  let gitInitialized = false;
  if (initGit) {
    gitInitialized = initGitRepo(targetDir);
  }

  return { installedServices, gitInitialized };
}

/**
 * Generates a standalone single-template project
 */
async function scaffoldSingleProject(options) {
  const {
    targetDir,
    projectName,
    template,
    database = 'postgres',
    createEnv = true,
    initGit = true
  } = options;

  await fs.ensureDir(targetDir);
  const src = path.join(TEMPLATES_ROOT, template.id);

  // Copy directly to root of targetDir
  await copyTemplateDir(src, targetDir);
  await customizeTemplateFiles(targetDir, projectName, '');

  // Transform database if backend and non-default database
  const isBackend = template.id.startsWith('template-') &&
    !template.id.includes('worker') &&
    !template.id.includes('react') &&
    !template.id.includes('vue');

  if (database && database !== 'postgres' && isBackend) {
    await transformBackendDatabase(targetDir, template.id, database);
  }

  if (createEnv && await fs.pathExists(path.join(targetDir, '.env.example'))) {
    await fs.copy(path.join(targetDir, '.env.example'), path.join(targetDir, '.env'));
  }

  let gitInitialized = false;
  if (initGit) {
    gitInitialized = initGitRepo(targetDir);
  }

  return {
    installedServices: [{ role: 'Service', info: template, folder: '.', database }],
    gitInitialized
  };
}

/**
 * Generates docker-compose.infra.yml for backend & worker infrastructure
 */
async function generateDockerComposeInfra(targetDir, options = {}) {
  const { database = 'postgres', backend, worker, messageBroker = 'both' } = options;
  if (!backend && !worker) return;

  const isMysql = database === 'mysql';

  let dbService = '';
  let volumes = '';

  if (isMysql) {
    dbService = `  mysql:
    image: mysql:8.4
    container_name: \${COMPOSE_PROJECT_NAME:-app}_mysql
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: app_db
      MYSQL_USER: app_user
      MYSQL_PASSWORD: app_password
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 5s
      timeout: 5s
      retries: 5
`;
    volumes += '  mysql_data:\n';
  } else {
    dbService = `  postgres:
    image: postgres:16-alpine
    container_name: \${COMPOSE_PROJECT_NAME:-app}_postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: app_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d app_db"]
      interval: 5s
      timeout: 5s
      retries: 5
`;
    volumes += '  postgres_data:\n';
  }

  let brokerServices = '';
  const includeRabbit = messageBroker === 'rabbitmq' || messageBroker === 'both';
  const includeKafka = messageBroker === 'kafka' || messageBroker === 'both';

  if (includeRabbit) {
    brokerServices += `  rabbitmq:
    image: rabbitmq:3-management-alpine
    container_name: \${COMPOSE_PROJECT_NAME:-app}_rabbitmq
    restart: unless-stopped
    environment:
      RABBITMQ_DEFAULT_USER: guest
      RABBITMQ_DEFAULT_PASS: guest
    ports:
      - "5672:5672"
      - "15672:15672"
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "-q", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

`;
    volumes += '  rabbitmq_data:\n';
  }

  if (includeKafka) {
    brokerServices += `  kafka:
    image: apache/kafka:3.7.0
    container_name: \${COMPOSE_PROJECT_NAME:-app}_kafka
    restart: unless-stopped
    ports:
      - "9092:9092"
    environment:
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: broker,controller
      KAFKA_LISTENERS: PLAINTEXT://:9092,CONTROLLER://:9093
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT
      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@localhost:9093
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1
      KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS: 0
      KAFKA_NUM_PARTITIONS: 3
    volumes:
      - kafka_data:/var/lib/kafka/data

  kafka-ui:
    image: provectuslabs/kafka-ui:latest
    container_name: \${COMPOSE_PROJECT_NAME:-app}_kafka_ui
    restart: unless-stopped
    ports:
      - "8085:8080"
    environment:
      KAFKA_CLUSTERS_0_NAME: local-cluster
      KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS: kafka:9092
    depends_on:
      - kafka

`;
    volumes += '  kafka_data:\n';
  }

  const composeContent = `services:
${dbService}  redis:
    image: redis:7-alpine
    container_name: \${COMPOSE_PROJECT_NAME:-app}_redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

${brokerServices}  mailpit:
    image: axllent/mailpit:latest
    container_name: \${COMPOSE_PROJECT_NAME:-app}_mailpit
    restart: unless-stopped
    ports:
      - "1025:1025"
      - "8025:8025"

volumes:
${volumes}  redis_data:
`;

  await fs.writeFile(path.join(targetDir, 'docker-compose.infra.yml'), composeContent, 'utf8');
}

/**
 * Creates root README.md for fullstack projects
 */
async function generateRootReadme(targetDir, projectName, services, options = {}) {
  const { messageBroker = 'both' } = options;
  let content = `# ${projectName}\n\n`;
  content += `> Fullstack project scaffolded via **Create Stack CLI**\n\n`;
  content += `## 🏗️ Architecture Overview\n\n`;

  for (const s of services) {
    content += `### 🔹 ${s.role}: \`${s.info.name}\`\n`;
    content += `- **Location:** \`./${s.folder}\`\n`;
    content += `- **Stack:** ${s.info.framework || s.info.name}\n`;
    if (s.database) {
      content += `- **Primary Database:** ${s.database === 'mysql' ? 'MySQL 8.4' : 'PostgreSQL'}\n`;
    }
    content += `- **Description:** ${s.info.description || '-'}\n`;
    if (s.info.devPort) {
      content += `- **Default Port:** \`http://localhost:${s.info.devPort}\`\n`;
    }
    content += `\n`;
  }

  content += `## 🐳 Local Infrastructure (Docker Compose)\n\n`;
  content += `Start all backing services (Database, Redis, Message Brokers, Mailpit) with a single command:\n\n`;
  content += `\`\`\`bash\nnpm run infra:up    # Start backing infrastructure\nnpm run infra:logs  # View logs\nnpm run infra:down  # Stop infrastructure\n\`\`\`\n\n`;
  if (messageBroker === 'kafka' || messageBroker === 'both') {
    content += `- **Kafka UI Dashboard:** [http://localhost:8085](http://localhost:8085)\n`;
    content += `- **Kafka Broker:** \`localhost:9092\`\n`;
  }
  if (messageBroker === 'rabbitmq' || messageBroker === 'both') {
    content += `- **RabbitMQ Management Dashboard:** [http://localhost:15672](http://localhost:15672) (User/Pass: \`guest\` / \`guest\`)\n`;
  }
  content += `- **Mailpit Webmail UI:** [http://localhost:8025](http://localhost:8025)\n\n`;

  content += `## 🚀 Quick Start Guide\n\n`;

  for (const s of services) {
    content += `### 🛠️ Setup ${s.role} (\`${s.folder}\`)\n\n\`\`\`bash\ncd ${s.folder}\n`;
    if (s.info.commands?.install) content += `${s.info.commands.install}\n`;
    if (s.info.commands?.dev) content += `${s.info.commands.dev}\n`;
    content += `\`\`\`\n\n`;
  }

  await fs.writeFile(path.join(targetDir, 'README.md'), content, 'utf8');
}

/**
 * Creates root .gitignore
 */
async function generateRootGitignore(targetDir) {
  const gitignorePath = path.join(targetDir, '.gitignore');
  if (await fs.pathExists(gitignorePath)) return;

  const content = `# Dependencies
node_modules/
.venv/
venv/
target/

# Environment Variables
.env
.env.local

# Build outputs
dist/
build/
*.class

# Logs
*.log
npm-debug.log*

# OS / Editors
.DS_Store
.idea/
.vscode/
`;
  await fs.writeFile(gitignorePath, content, 'utf8');
}

/**
 * Creates root package.json with scripts to help run services
 */
async function generateRootPackageJson(targetDir, projectName, services) {
  const scripts = {};

  // Infrastructure lifecycle scripts
  if (await fs.pathExists(path.join(targetDir, 'docker-compose.infra.yml'))) {
    scripts['infra:up'] = 'docker compose -f docker-compose.infra.yml up -d';
    scripts['infra:down'] = 'docker compose -f docker-compose.infra.yml down';
    scripts['infra:logs'] = 'docker compose -f docker-compose.infra.yml logs -f';
  }

  const devNames = [];
  const devCommands = [];
  const colorPalette = ['cyan', 'magenta', 'yellow', 'blue'];

  for (const s of services) {
    if (s.role === 'Frontend') {
      scripts['dev:fe'] = `cd ${s.folder} && npm run dev`;
      scripts['build:fe'] = `cd ${s.folder} && npm run build`;
      devNames.push('fe');
      devCommands.push('"npm run dev:fe"');
    } else if (s.role === 'Backend') {
      if (s.info.id === 'template-express') {
        scripts['dev:be'] = `cd ${s.folder} && npm run dev`;
      } else if (s.info.id === 'template-golang') {
        scripts['dev:be'] = `cd ${s.folder} && go run main.go`;
      } else if (s.info.id === 'template-fastapi-async') {
        scripts['dev:be'] = `cd ${s.folder} && uvicorn app:app --reload`;
      } else if (s.info.id === 'template-java') {
        scripts['dev:be'] = `cd ${s.folder} && ./mvnw spring-boot:run`;
      } else if (s.info.id === 'template-rust') {
        scripts['dev:be'] = `cd ${s.folder} && cargo run`;
      }
      devNames.push('be');
      devCommands.push('"npm run dev:be"');
    } else if (s.role === 'Worker') {
      if (s.info.id === 'template-worker-typescript') {
        scripts['dev:worker'] = `cd ${s.folder} && npm run dev`;
      } else if (s.info.id === 'template-worker-golang') {
        scripts['dev:worker'] = `cd ${s.folder} && go run main.go`;
      } else if (s.info.id === 'template-worker-python') {
        scripts['dev:worker'] = `cd ${s.folder} && python worker.py`;
      } else if (s.info.id === 'template-worker-rust') {
        scripts['dev:worker'] = `cd ${s.folder} && cargo run`;
      } else if (s.info.id === 'template-worker-java') {
        scripts['dev:worker'] = `cd ${s.folder} && ./mvnw spring-boot:run`;
      }
      devNames.push('worker');
      devCommands.push('"npm run dev:worker"');
    }
  }

  // dev:all orchestrator when multiple runnable services exist
  if (devCommands.length > 1) {
    const nameStr = devNames.join(',');
    const colorStr = colorPalette.slice(0, devNames.length).join(',');
    scripts['dev:all'] = `concurrently -n "${nameStr}" -c "${colorStr}" ${devCommands.join(' ')}`;
  }

  const rootPkg = {
    name: projectName,
    version: '0.1.0',
    private: true,
    description: `Root workspace for ${projectName}`,
    scripts,
    devDependencies: {
      concurrently: '^9.1.2'
    }
  };

  await fs.writeJson(path.join(targetDir, 'package.json'), rootPkg, { spaces: 2 });
}

module.exports = {
  scaffoldFullstackProject,
  scaffoldSingleProject
};
