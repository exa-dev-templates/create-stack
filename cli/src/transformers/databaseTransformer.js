const fs = require('fs-extra');
const path = require('path');

/**
 * Transforms a scaffolded backend service directory for MySQL if requested.
 *
 * @param {string} targetDir - Directory where template was scaffolded
 * @param {string} templateId - e.g. 'template-express', 'template-java', 'template-golang', 'template-fastapi-async', 'template-rust'
 * @param {string} database - 'postgres' | 'mysql'
 */
async function transformBackendDatabase(targetDir, templateId, database) {
  if (!database || database === 'postgres') {
    // Default is PostgreSQL, nothing to transform
    return;
  }

  if (database === 'mysql') {
    // 1. Transform docker-compose.yml if present
    await transformDockerCompose(targetDir);

    // 2. Transform environment files (.env.example & .env)
    await transformEnvFiles(targetDir, templateId);

    // 3. Stack-specific adaptations (code, driver, configs, & migrations)
    if (templateId === 'template-express') {
      await transformExpress(targetDir);
    } else if (templateId === 'template-java') {
      await transformJava(targetDir);
    } else if (templateId === 'template-golang') {
      await transformGolang(targetDir);
    } else if (templateId === 'template-fastapi-async') {
      await transformFastAPI(targetDir);
    } else if (templateId === 'template-rust') {
      await transformRust(targetDir);
    }

    // 4. Adapt scaffolded .agents skills for MySQL context
    await transformAgentsSkills(targetDir);
  }
}

/**
 * Transform docker-compose.yml from PostgreSQL to MySQL 8.4
 */
async function transformDockerCompose(targetDir) {
  const composePath = path.join(targetDir, 'docker-compose.yml');
  if (!await fs.pathExists(composePath)) return;

  let content = await fs.readFile(composePath, 'utf8');

  // Replace postgres service block with mysql service block
  const postgresBlockRegex = /  postgres:[\s\S]*?(?=\n  [a-zA-Z0-9_-]+:|\nvolumes:|$)/;
  const mysqlBlock = `  mysql:
    image: mysql:8.4
    container_name: mysql-dev
    environment:
      MYSQL_ROOT_PASSWORD: password
      MYSQL_DATABASE: mydb
      MYSQL_USER: user
      MYSQL_PASSWORD: password
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    healthcheck:
      test: [ "CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "root", "-ppassword" ]
      interval: 10s
      timeout: 5s
      retries: 5
`;

  if (postgresBlockRegex.test(content)) {
    content = content.replace(postgresBlockRegex, mysqlBlock);
  } else {
    // Fallback for differently-indented postgres service
    const altRegex = /postgres:[\s\S]*?(?=\n\s\s[a-zA-Z0-9_-]+:|\nvolumes:|$)/;
    if (altRegex.test(content)) {
      content = content.replace(altRegex, mysqlBlock.trimStart());
    }
  }

  // Replace depends_on: postgres -> depends_on: mysql
  content = content.replace(/depends_on:\s*\n(\s*)postgres:/g, 'depends_on:\n$1mysql:');

  // Replace app DATABASE_URL in docker-compose
  content = content.replace(
    /DATABASE_URL=postgres:\/\/postgres:postgres@postgres:5432\/app_db\?sslmode=disable/g,
    'DATABASE_URL=mysql://root:password@mysql:3306/app_db'
  );
  content = content.replace(
    /DATABASE_URL=postgresql:\/\/postgres:password@postgres:5432\/fastapi_db/g,
    'DATABASE_URL=mysql+asyncmy://root:password@mysql:3306/fastapi_db'
  );
  content = content.replace(/DB_HOST:\s*postgres/g, 'DB_HOST: mysql');
  content = content.replace(/DB_PORT:\s*5432/g, 'DB_PORT: 3306');
  content = content.replace(/DB_USER:\s*postgres/g, 'DB_USER: root');

  // Replace volumes
  content = content.replace(/postgres_data:/g, 'mysql_data:');

  await fs.writeFile(composePath, content, 'utf8');
}

/**
 * Transform environment variables (.env.example and .env)
 */
async function transformEnvFiles(targetDir, templateId) {
  const envFiles = ['.env.example', '.env'];

  for (const envFile of envFiles) {
    const filePath = path.join(targetDir, envFile);
    if (!await fs.pathExists(filePath)) continue;

    let content = await fs.readFile(filePath, 'utf8');

    // Replace Database URLs
    content = content.replace(
      /DATABASE_URL=postgresql:\/\/postgres:password@localhost:5432\/mydb/g,
      'DATABASE_URL=mysql://root:password@localhost:3306/mydb'
    );
    content = content.replace(
      /DATABASE_URL=postgresql:\/\/postgres:postgres@localhost:5432\/fastapi_db/g,
      'DATABASE_URL=mysql+asyncmy://root:password@localhost:3306/fastapi_db'
    );
    content = content.replace(
      /DATABASE_URL=postgres:\/\/postgres:postgres@localhost:5432\/app_db\?sslmode=disable/g,
      'DATABASE_URL=mysql://root:password@localhost:3306/app_db'
    );
    content = content.replace(
      /DATABASE_URL=postgres:\/\/postgres:postgres@localhost:5432\/mydb\?sslmode=disable/g,
      'DATABASE_URL=mysql://root:password@localhost:3306/mydb'
    );

    // Replace ports
    content = content.replace(/DATABASE_PORT=5432/g, 'DATABASE_PORT=3306');
    content = content.replace(/DB_PORT=5432/g, 'DB_PORT=3306');
    content = content.replace(/POSTGRES_PORT=5432/g, 'POSTGRES_PORT=3306');

    // Replace default usernames
    content = content.replace(/DATABASE_USER=postgres/g, 'DATABASE_USER=root');
    content = content.replace(/DB_USER=postgres/g, 'DB_USER=root');
    content = content.replace(/POSTGRES_USER=postgres/g, 'POSTGRES_USER=root');

    // Replace PostgreSQL header comments
    content = content.replace(/# PostgreSQL Configuration/g, '# MySQL Configuration');

    await fs.writeFile(filePath, content, 'utf8');
  }
}

/**
 * Express stack adaptation:
 * - Update package.json (replace pg with mysql2, replace migration runner)
 * - Swap database.ts to MySQL-compatible wrapper
 * - Provide native scripts/migrate.js for MySQL
 */
async function transformExpress(targetDir) {
  // 1. Update package.json
  const pkgPath = path.join(targetDir, 'package.json');
  if (await fs.pathExists(pkgPath)) {
    try {
      const pkg = await fs.readJson(pkgPath);
      if (pkg.dependencies) {
        delete pkg.dependencies.pg;
        delete pkg.dependencies['node-pg-migrate'];
        pkg.dependencies.mysql2 = '^3.11.3';
      }
      if (pkg.devDependencies) {
        delete pkg.devDependencies['@types/pg'];
        delete pkg.devDependencies['@testcontainers/postgresql'];
        delete pkg.devDependencies['node-pg-migrate'];
      }
      if (pkg.scripts) {
        pkg.scripts['migrate:up'] = 'dotenv -e .env -- node scripts/migrate.js up';
        pkg.scripts['migrate:down'] = 'dotenv -e .env -- node scripts/migrate.js down';
      }
      await fs.writeJson(pkgPath, pkg, { spaces: 2 });
    } catch {}
  }

  // 2. Overwrite src/config/database.ts with MySQL implementation
  const dbConfigPath = path.join(targetDir, 'src', 'config', 'database.ts');
  const mysqlDbContent = `import type { PoolConnection, PoolOptions } from 'mysql2/promise';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import logger from '../utils/logger';
import { isRequestAborted } from '../utils/requestContext';
import { AppError } from '../types/errors';

dotenv.config();

// Export type alias for PoolClient compatibility
export type PoolClient = PoolConnection;

export interface QueryResultLike<T = any> {
  rows: T[];
  rowCount: number;
}

const poolConfig: PoolOptions = process.env.DATABASE_URL
  ? {
      uri: process.env.DATABASE_URL,
      waitForConnections: true,
      connectionLimit: 20,
      queueLimit: 0
    }
  : {
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '3306', 10),
      database: process.env.DATABASE_NAME || 'mydb',
      user: process.env.DATABASE_USER || 'root',
      password: process.env.DATABASE_PASSWORD || 'password',
      waitForConnections: true,
      connectionLimit: 20,
      queueLimit: 0
    };

class Database {
  private pool: mysql.Pool;
  private static instance: Database;

  private constructor() {
    this.pool = mysql.createPool(poolConfig);
  }

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  public getPool(): mysql.Pool {
    return this.pool;
  }

  /**
   * Helper to convert PostgreSQL $1, $2 query syntax to MySQL ? syntax
   */
  private translateQuery(text: string): string {
    let translated = text.replace(/\\$\\d+/g, '?');
    translated = translated.replace(/\\s+RETURNING\\s+\\*/gi, '');
    return translated;
  }

  public async query(text: string, params?: unknown[]): Promise<QueryResultLike> {
    if (isRequestAborted()) {
      logger.warn('Skipping query execution, request was aborted by client', { text });
      throw new AppError('Client aborted request', 499 as any, 'CLIENT_CLOSED_REQUEST' as any);
    }

    const start = Date.now();
    const formattedQuery = this.translateQuery(text);

    try {
      const [result] = await this.pool.query(formattedQuery, params as any);
      const duration = Date.now() - start;

      const rows = Array.isArray(result) ? result : [];
      const rowCount = Array.isArray(result)
        ? result.length
        : (result as any)?.affectedRows || 0;

      logger.info('Executed query', { text: formattedQuery, duration, rows: rowCount });
      return { rows: rows as any[], rowCount };
    } catch (error) {
      logger.error('Database query error:', { error });
      throw error;
    }
  }

  public async getClient(): Promise<PoolConnection> {
    return await this.pool.getConnection();
  }

  public async withTransaction<T>(fn: (client: PoolConnection) => Promise<T>): Promise<T> {
    if (isRequestAborted()) {
      logger.warn('Skipping transaction, request was aborted by client');
      throw new AppError('Client aborted request', 499 as any, 'CLIENT_CLOSED_REQUEST' as any);
    }

    const client = await this.pool.getConnection();

    try {
      await client.query('START TRANSACTION');
      logger.info('Transaction started');

      const result = await fn(client);

      await client.query('COMMIT');
      logger.info('Transaction committed');

      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
        logger.info('Transaction rolled back');
      } catch (rollbackError) {
        logger.error('Failed to rollback transaction:', { rollbackError });
      }
      throw error;
    } finally {
      client.release();
    }
  }

  public async withReadOnlyTransaction<T>(fn: (client: PoolConnection) => Promise<T>): Promise<T> {
    if (isRequestAborted()) {
      logger.warn('Skipping read-only transaction, request was aborted by client');
      throw new AppError('Client aborted request', 499 as any, 'CLIENT_CLOSED_REQUEST' as any);
    }

    const client = await this.pool.getConnection();

    try {
      await client.query('START TRANSACTION READ ONLY');
      logger.info('Read-only transaction started');

      const result = await fn(client);

      await client.query('COMMIT');
      logger.info('Read-only transaction committed');

      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
        logger.info('Failed to rollback read-only transaction:', { error });
      } catch (rollbackError) {
        logger.error('Failed to rollback read-only transaction:', { rollbackError });
      }
      throw error;
    } finally {
      client.release();
    }
  }

  public async close() {
    await this.pool.end();
  }
}

export default Database;
`;

  await fs.writeFile(dbConfigPath, mysqlDbContent, 'utf8');

  // 3. Update files that import PoolClient from 'pg'
  const filesToUpdate = [
    path.join(targetDir, 'src', 'repositories', 'BaseRepository.ts'),
    path.join(targetDir, 'src', 'modules', 'auth', 'refreshTokenRepository.ts'),
    path.join(targetDir, 'src', 'modules', 'users', 'repository.ts')
  ];

  for (const f of filesToUpdate) {
    if (await fs.pathExists(f)) {
      let content = await fs.readFile(f, 'utf8');
      content = content.replace(/import type \{([^}]*)\}\s+from\s+'pg'/g, () => {
        return `import type { PoolClient } from '../../config/database'`;
      });
      content = content.replace(
        /import type \{ Pool, PoolClient, QueryResult \} from 'pg'/g,
        `import type { PoolClient } from '../config/database'`
      );
      await fs.writeFile(f, content, 'utf8');
    }
  }

  // 4. Generate native MySQL migration script: scripts/migrate.js
  const scriptsDir = path.join(targetDir, 'scripts');
  await fs.ensureDir(scriptsDir);

  const migrateScriptContent = `/**
 * Standalone MySQL Migration Runner
 * Usage: node scripts/migrate.js up | down
 */
const mysql = require('mysql2/promise');
require('dotenv').config();

const config = {
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '3306', 10),
  user: process.env.DATABASE_USER || 'root',
  password: process.env.DATABASE_PASSWORD || 'password',
  database: process.env.DATABASE_NAME || 'mydb'
};

async function migrate() {
  const action = process.argv[2] || 'up';
  const connection = await mysql.createConnection(config);

  console.log(\`Connected to MySQL (\${config.host}:\${config.port}/\${config.database})\`);

  if (action === 'up') {
    console.log('Running MySQL migrations UP...');

    await connection.query(\`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255),
        phone VARCHAR(50),
        role VARCHAR(50) NOT NULL DEFAULT 'user',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_users_email (email)
      );
    \`);

    await connection.query(\`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        token_hash VARCHAR(255) NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        revoked_at TIMESTAMP NULL,
        user_agent VARCHAR(500),
        ip_address VARCHAR(45),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_rf_user_id (user_id),
        CONSTRAINT fk_rf_users FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    \`);

    await connection.query(\`
      CREATE TABLE IF NOT EXISTS email_logs (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        recipient VARCHAR(255) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    \`);

    console.log('✅ MySQL migrations applied successfully.');
  } else if (action === 'down') {
    console.log('Reverting MySQL migrations DOWN...');
    await connection.query('DROP TABLE IF EXISTS email_logs;');
    await connection.query('DROP TABLE IF EXISTS refresh_tokens;');
    await connection.query('DROP TABLE IF EXISTS users;');
    console.log('✅ MySQL migrations reverted successfully.');
  }

  await connection.end();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
`;

  await fs.writeFile(path.join(scriptsDir, 'migrate.js'), migrateScriptContent, 'utf8');

  // 4b. Overwrite src/config/migrate.ts with MySQL implementation
  const migrateConfigPath = path.join(targetDir, 'src', 'config', 'migrate.ts');
  const mysqlMigrateConfigContent = `import mysql from 'mysql2/promise';
import logger from '../utils/logger';

export async function runAutoMigrations (): Promise<void> {
  const config = {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '3306', 10),
    user: process.env.DATABASE_USER || 'root',
    password: process.env.DATABASE_PASSWORD || 'password',
    database: process.env.DATABASE_NAME || 'mydb'
  };

  logger.info('Executing MySQL database auto-migrations...');

  let connection;
  try {
    connection = await mysql.createConnection(config);

    await connection.query(\`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255),
        phone VARCHAR(50),
        role VARCHAR(50) NOT NULL DEFAULT 'user',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_users_email (email)
      );
    \`);

    await connection.query(\`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        token_hash VARCHAR(255) NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        revoked_at TIMESTAMP NULL,
        user_agent VARCHAR(500),
        ip_address VARCHAR(45),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_rf_user_id (user_id),
        CONSTRAINT fk_rf_users FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    \`);

    await connection.query(\`
      CREATE TABLE IF NOT EXISTS email_logs (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        recipient VARCHAR(255) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    \`);

    logger.info('MySQL database auto-migrations applied successfully');
  } catch (error) {
    logger.error('MySQL database auto-migration failed', { error });
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}
`;
  await fs.writeFile(migrateConfigPath, mysqlMigrateConfigContent, 'utf8');

  // 5. Update errorHandler.ts to recognize MySQL error codes
  const errHandlerPath = path.join(targetDir, 'src', 'middleware', 'errorHandler.ts');
  if (await fs.pathExists(errHandlerPath)) {
    let content = await fs.readFile(errHandlerPath, 'utf8');
    content = content.replace(
      /case PG_ERROR_CODES\.UNIQUE_VIOLATION:/g,
      "case PG_ERROR_CODES.UNIQUE_VIOLATION:\n    case 'ER_DUP_ENTRY':\n    case '1062':"
    );
    content = content.replace(
      /case PG_ERROR_CODES\.FOREIGN_KEY_VIOLATION:/g,
      "case PG_ERROR_CODES.FOREIGN_KEY_VIOLATION:\n    case 'ER_NO_REFERENCED_ROW_2':\n    case '1452':"
    );
    content = content.replace(
      /case PG_ERROR_CODES\.NOT_NULL_VIOLATION:/g,
      "case PG_ERROR_CODES.NOT_NULL_VIOLATION:\n    case 'ER_BAD_NULL_ERROR':\n    case '1048':"
    );
    await fs.writeFile(errHandlerPath, content, 'utf8');
  }
}

/**
 * Java Spring Boot stack adaptation:
 * - Update pom.xml (replace postgresql with mysql-connector-j)
 * - Update application.properties (switch datasource to MySQL driver & dialect)
 * - Update Liquibase changesets (BIGSERIAL -> BIGINT AUTO_INCREMENT)
 */
async function transformJava(targetDir) {
  // 1. Update pom.xml
  const pomPath = path.join(targetDir, 'pom.xml');
  if (await fs.pathExists(pomPath)) {
    let content = await fs.readFile(pomPath, 'utf8');

    content = content.replace(
      /<groupId>org\.postgresql<\/groupId>\s*<artifactId>postgresql<\/artifactId>/g,
      '<groupId>com.mysql</groupId>\n            <artifactId>mysql-connector-j</artifactId>'
    );

    content = content.replace(/org\.postgresql\.Driver/g, 'com.mysql.cj.jdbc.Driver');
    content = content.replace(/jdbc:postgresql:\/\/localhost:5432\/mydb/g, 'jdbc:mysql://localhost:3306/mydb');

    await fs.writeFile(pomPath, content, 'utf8');
  }

  // 2. Update application.properties
  const appPropsPath = path.join(targetDir, 'src', 'main', 'resources', 'application.properties');
  if (await fs.pathExists(appPropsPath)) {
    let content = await fs.readFile(appPropsPath, 'utf8');

    content = content.replace(
      /spring\.datasource\.url=jdbc:postgresql:\/\/[\s\S]*?spring\.jpa\.properties\.hibernate\.format_sql=true/m,
      `spring.datasource.url=jdbc:mysql://\${DB_HOST:localhost}:\${DB_PORT:3306}/\${DB_NAME:mydb}?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC
spring.datasource.username=\${DB_USER:root}
spring.datasource.password=\${DB_PASSWORD:password}
spring.datasource.driver-class-name=com.mysql.cj.jdbc.Driver
spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=true
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.MySQLDialect
spring.jpa.properties.hibernate.format_sql=true`
    );

    await fs.writeFile(appPropsPath, content, 'utf8');
  }

  // 3. Update Liquibase SQL changesets if present (BIGSERIAL -> BIGINT AUTO_INCREMENT)
  const changesDir = path.join(targetDir, 'src', 'main', 'resources', 'db', 'changelog', 'changes');
  if (await fs.pathExists(changesDir)) {
    const files = await fs.readdir(changesDir);
    for (const file of files) {
      if (file.endsWith('.sql')) {
        const fullPath = path.join(changesDir, file);
        let content = await fs.readFile(fullPath, 'utf8');
        content = content.replace(/\bBIGSERIAL\s+PRIMARY\s+KEY\b/gi, 'BIGINT AUTO_INCREMENT PRIMARY KEY');
        await fs.writeFile(fullPath, content, 'utf8');
      }
    }
  }
}

/**
 * Golang Fiber stack adaptation:
 * - Update DSN in config.go to MySQL format
 * - Update database/postgres.go to use mysql driver
 * - Update database/migrate/migrate.go to use golang-migrate mysql driver & URL
 * - Update repository queries ($1, $2 -> ?) and handle RETURNING
 * - Update errors.go to parse MySQL error codes (1062, 1452, 1048)
 * - Update migration SQL files for MySQL compatibility
 */
async function transformGolang(targetDir) {
  // 1. Update config/config.go DSN method
  const configPath = path.join(targetDir, 'config', 'config.go');
  if (await fs.pathExists(configPath)) {
    let content = await fs.readFile(configPath, 'utf8');
    content = content.replace(
      /func \(d \*DatabaseConfig\) DSN\(\) string \{[\s\S]*?return fmt\.Sprintf\("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",[\s\S]*?d\.Host, d\.Port, d\.User, d\.Password, d\.DBName, d\.SSLMode\)[\s\S]*?\}/,
      `func (d *DatabaseConfig) DSN() string {
	return fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?parseTime=true",
		d.User, d.Password, d.Host, d.Port, d.DBName)
}`
    );
    await fs.writeFile(configPath, content, 'utf8');
  }

  // 2. Update database/postgres.go driver registration
  const dbGoPath = path.join(targetDir, 'database', 'postgres.go');
  if (await fs.pathExists(dbGoPath)) {
    let content = await fs.readFile(dbGoPath, 'utf8');
    content = content.replace(/_ "github\.com\/lib\/pq"/g, '_ "github.com/go-sql-driver/mysql"');
    content = content.replace(/sqlx\.Connect\("postgres", dsn\)/g, 'sqlx.Connect("mysql", dsn)');
    content = content.replace(/connected to PostgreSQL/g, 'connected to MySQL');
    await fs.writeFile(dbGoPath, content, 'utf8');
  }

  // 3. Update database/migrate/migrate.go for MySQL golang-migrate driver and URL
  const migrateGoPath = path.join(targetDir, 'database', 'migrate', 'migrate.go');
  if (await fs.pathExists(migrateGoPath)) {
    let content = await fs.readFile(migrateGoPath, 'utf8');
    content = content.replace(
      /_ "github\.com\/golang-migrate\/migrate\/v4\/database\/postgres"/g,
      '_ "github.com/golang-migrate/migrate/v4/database/mysql"'
    );
    // Replace all postgres URL format builders
    content = content.replace(
      /databaseURL := fmt\.Sprintf\("postgres:\/\/[\s\S]*?cfg\.SSLMode,\s*\)/g,
      `databaseURL := fmt.Sprintf("mysql://%s:%s@tcp(%s:%s)/%s",
		cfg.User,
		cfg.Password,
		cfg.Host,
		cfg.Port,
		cfg.DBName,
	)`
    );
    await fs.writeFile(migrateGoPath, content, 'utf8');
  }

  // 4. Update errors.go to handle MySQL error numbers
  const errorsPath = path.join(targetDir, 'pkg', 'errors', 'errors.go');
  if (await fs.pathExists(errorsPath)) {
    let content = await fs.readFile(errorsPath, 'utf8');
    if (!content.includes('github.com/go-sql-driver/mysql')) {
      content = content.replace(
        /"github\.com\/lib\/pq"/,
        `"github.com/go-sql-driver/mysql"\n\t"github.com/lib/pq"`
      );
      content = content.replace(
        /if pqErr, ok := err\.\(\*pq\.Error\); ok \{/,
        `if mysqlErr, ok := err.(*mysql.MySQLError); ok {
		switch mysqlErr.Number {
		case 1062:
			return ConflictWithCode(mysqlErr.Message, constants.CodeEmailAlreadyExists)
		case 1452:
			return BadRequestWithCode("Referenced record does not exist", constants.CodeBadRequest)
		case 1048:
			return BadRequestWithCode(mysqlErr.Message, constants.CodeBadRequest)
		default:
			return DatabaseError(mysqlErr.Message, mysqlErr)
		}
	}
	if pqErr, ok := err.(*pq.Error); ok {`
      );
      await fs.writeFile(errorsPath, content, 'utf8');
    }
  }

  // 5. Update repository query placeholders ($1, $2 -> ?)
  const repoFiles = [
    path.join(targetDir, 'internal', 'module', 'auth', 'repository.go'),
    path.join(targetDir, 'internal', 'module', 'user', 'repository.go')
  ];

  for (const rf of repoFiles) {
    if (await fs.pathExists(rf)) {
      let content = await fs.readFile(rf, 'utf8');
      content = content.replace(/\$[0-9]+/g, '?');
      await fs.writeFile(rf, content, 'utf8');
    }
  }

  // 6. Update migration files for MySQL
  const migrationsDir = path.join(targetDir, 'migrations');
  if (await fs.pathExists(migrationsDir)) {
    const userUp = path.join(migrationsDir, '000001_create_users_table.up.sql');
    if (await fs.pathExists(userUp)) {
      const mysqlUserDdl = `-- Create users table for MySQL
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
`;
      await fs.writeFile(userUp, mysqlUserDdl, 'utf8');
    }

    const fieldsUp = path.join(migrationsDir, '000002_add_user_fields.up.sql');
    if (await fs.pathExists(fieldsUp)) {
      const mysqlFieldsDdl = `-- Add additional user fields for MySQL
ALTER TABLE users ADD COLUMN phone VARCHAR(20);
ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN last_login TIMESTAMP;

CREATE INDEX idx_users_is_active ON users(is_active);
`;
      await fs.writeFile(fieldsUp, mysqlFieldsDdl, 'utf8');
    }

    const passUp = path.join(migrationsDir, '000003_add_user_password.up.sql');
    if (await fs.pathExists(passUp)) {
      const mysqlPassDdl = `-- Add password column for MySQL
ALTER TABLE users ADD COLUMN password VARCHAR(255);

CREATE INDEX idx_users_email_login ON users(email, is_active);
`;
      await fs.writeFile(passUp, mysqlPassDdl, 'utf8');
    }

    const tokenUp = path.join(migrationsDir, '000004_create_refresh_tokens_and_roles.up.sql');
    if (await fs.pathExists(tokenUp)) {
      const mysqlTokenDdl = `-- Add role and refresh_tokens for MySQL
ALTER TABLE users ADD COLUMN role VARCHAR(50) NOT NULL DEFAULT 'user';
CREATE INDEX idx_users_role ON users(role);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP NULL,
    user_agent VARCHAR(500),
    ip_address VARCHAR(45),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_refresh_tokens_user_id (user_id),
    CONSTRAINT fk_rf_users FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
`;
      await fs.writeFile(tokenUp, mysqlTokenDdl, 'utf8');
    }
  }
}

/**
 * FastAPI Async stack adaptation:
 * - Update requirements.txt to include asyncmy
 * - Update lib/database.py to use mysql+asyncmy://
 * - Update alembic/env.py to format MySQL async URL
 */
async function transformFastAPI(targetDir) {
  // 1. Update requirements.txt
  const reqPath = path.join(targetDir, 'requirements.txt');
  if (await fs.pathExists(reqPath)) {
    let content = await fs.readFile(reqPath, 'utf8');
    if (!content.includes('asyncmy')) {
      content = content.replace(/asyncpg.*/g, 'asyncmy>=0.2.9\ncryptography>=42.0.0');
      await fs.writeFile(reqPath, content, 'utf8');
    }
  }

  // 2. Update lib/database.py
  const dbPyPath = path.join(targetDir, 'lib', 'database.py');
  if (await fs.pathExists(dbPyPath)) {
    let content = await fs.readFile(dbPyPath, 'utf8');
    content = content.replace(
      /settings\.DATABASE_URL\.replace\("postgresql:\/\/", "postgresql\+asyncpg:\/\/"\)/g,
      'settings.DATABASE_URL.replace("postgresql://", "mysql+asyncmy://").replace("mysql://", "mysql+asyncmy://")'
    );
    await fs.writeFile(dbPyPath, content, 'utf8');
  }

  // 3. Update alembic/env.py
  const alembicEnvPath = path.join(targetDir, 'alembic', 'env.py');
  if (await fs.pathExists(alembicEnvPath)) {
    let content = await fs.readFile(alembicEnvPath, 'utf8');
    content = content.replace(
      /settings\.DATABASE_URL\.replace\("postgresql:\/\/", "postgresql\+asyncpg:\/\/"\)/g,
      'settings.DATABASE_URL.replace("postgresql://", "mysql+asyncmy://").replace("mysql://", "mysql+asyncmy://")'
    );
    await fs.writeFile(alembicEnvPath, content, 'utf8');
  }
}

/**
 * Rust Axum stack adaptation:
 * - Update Cargo.toml (sqlx feature postgres -> mysql)
 * - Rename & update database/postgres.rs -> database/mysql.rs
 * - Update database/mod.rs (pub mod mysql)
 * - Update lib.rs (PgPool -> MySqlPool, postgres -> mysql)
 * - Update modules (PgPool -> MySqlPool, Postgres -> MySql, $1.. -> ?)
 * - Update bin/migrate.rs
 * - Update pkg/errors/mod.rs (add MySQL 1062, 1452 error codes)
 * - Update migration SQL files for MySQL compatibility
 */
async function transformRust(targetDir) {
  // 1. Update Cargo.toml
  const cargoPath = path.join(targetDir, 'Cargo.toml');
  if (await fs.pathExists(cargoPath)) {
    let content = await fs.readFile(cargoPath, 'utf8');
    content = content.replace(/"postgres"/g, '"mysql"');
    await fs.writeFile(cargoPath, content, 'utf8');
  }

  // 2. Transform database/postgres.rs to database/mysql.rs
  const pgRsPath = path.join(targetDir, 'src', 'database', 'postgres.rs');
  const mysqlRsPath = path.join(targetDir, 'src', 'database', 'mysql.rs');

  const mysqlRsContent = `use sqlx::{mysql::MySqlPoolOptions, MySqlPool};
use std::time::Duration;

use crate::pkg::errors::AppError;

pub async fn create_mysql_pool(database_url: &str) -> Result<MySqlPool, AppError> {
    MySqlPoolOptions::new()
        .max_connections(20)
        .min_connections(2)
        .acquire_timeout(Duration::from_secs(5))
        .idle_timeout(Duration::from_secs(600))
        .connect(database_url)
        .await
        .map_err(AppError::Database)
}

pub async fn run_migrations(pool: &MySqlPool) -> Result<(), AppError> {
    sqlx::migrate!("./migrations")
        .run(pool)
        .await
        .map_err(|e| AppError::internal(format!("Database migration failed: {}", e)))?;

    Ok(())
}

pub async fn revert_migration(pool: &MySqlPool, target_version: i64) -> Result<(), AppError> {
    sqlx::migrate!("./migrations")
        .undo(pool, target_version)
        .await
        .map_err(|e| AppError::internal(format!("Database rollback failed: {}", e)))?;

    Ok(())
}

pub async fn revert_last_migration(pool: &MySqlPool) -> Result<(), AppError> {
    let migrator = sqlx::migrate!("./migrations");

    let row: Option<(i64,)> = sqlx::query_as(
        "SELECT version FROM _sqlx_migrations WHERE success = TRUE ORDER BY version DESC LIMIT 1",
    )
    .fetch_optional(pool)
    .await
    .unwrap_or(None);

    let current_version = match row {
        Some((v,)) => v,
        None => {
            tracing::info!("No applied migrations found to revert.");
            return Ok(());
        }
    };

    migrator
        .undo(pool, current_version)
        .await
        .map_err(|e| AppError::internal(format!("Failed to revert migration {}: {}", current_version, e)))?;

    tracing::info!("Reverted migration {}", current_version);
    Ok(())
}
`;

  await fs.writeFile(mysqlRsPath, mysqlRsContent, 'utf8');
  if (await fs.pathExists(pgRsPath)) {
    await fs.remove(pgRsPath);
  }

  // 3. Update database/mod.rs
  const dbModPath = path.join(targetDir, 'src', 'database', 'mod.rs');
  if (await fs.pathExists(dbModPath)) {
    await fs.writeFile(dbModPath, 'pub mod mysql;\n', 'utf8');
  }

  // 4. Update src/lib.rs
  const libPath = path.join(targetDir, 'src', 'lib.rs');
  if (await fs.pathExists(libPath)) {
    let content = await fs.readFile(libPath, 'utf8');
    content = content.replace(/use sqlx::PgPool;/g, 'use sqlx::MySqlPool;');
    content = content.replace(/PgPool/g, 'MySqlPool');
    content = content.replace(/database::postgres/g, 'database::mysql');
    content = content.replace(/create_postgres_pool/g, 'create_mysql_pool');
    await fs.writeFile(libPath, content, 'utf8');
  }

  // 5. Update src/bin/migrate.rs
  const migratePath = path.join(targetDir, 'src', 'bin', 'migrate.rs');
  if (await fs.pathExists(migratePath)) {
    let content = await fs.readFile(migratePath, 'utf8');
    content = content.replace(/database::postgres/g, 'database::mysql');
    content = content.replace(/create_postgres_pool/g, 'create_mysql_pool');
    content = content.replace(/PgPool/g, 'MySqlPool');
    await fs.writeFile(migratePath, content, 'utf8');
  }

  // 6. Update repositories & services
  const rustFilesToAdapt = [
    path.join(targetDir, 'src', 'modules', 'auth', 'service.rs'),
    path.join(targetDir, 'src', 'modules', 'auth', 'repository.rs'),
    path.join(targetDir, 'src', 'modules', 'user', 'service.rs'),
    path.join(targetDir, 'src', 'modules', 'user', 'repository.rs')
  ];

  for (const rf of rustFilesToAdapt) {
    if (await fs.pathExists(rf)) {
      let content = await fs.readFile(rf, 'utf8');
      content = content.replace(/PgPool/g, 'MySqlPool');
      content = content.replace(/PostgresAuthRepository/g, 'MySqlAuthRepository');
      content = content.replace(/PostgresUserRepository/g, 'MySqlUserRepository');
      content = content.replace(/Transaction<'_, Postgres>/g, "Transaction<'_, MySql>");
      content = content.replace(/use sqlx::\{([^}]*)\bPostgres\b([^}]*)\}/g, 'use sqlx::{$1MySql$2}');
      content = content.replace(/\$[0-9]+/g, '?');
      await fs.writeFile(rf, content, 'utf8');
    }
  }

  // 7. Update pkg/errors/mod.rs
  const errorsModPath = path.join(targetDir, 'src', 'pkg', 'errors', 'mod.rs');
  if (await fs.pathExists(errorsModPath)) {
    let content = await fs.readFile(errorsModPath, 'utf8');
    content = content.replace(/"23505"/g, '"23505" | "1062"');
    content = content.replace(/"23503"/g, '"23503" | "1452"');
    content = content.replace(/"23502"/g, '"23502" | "1048"');
    await fs.writeFile(errorsModPath, content, 'utf8');
  }

  // 8. Update migration SQL files for MySQL
  const rustMigrationsDir = path.join(targetDir, 'migrations');
  if (await fs.pathExists(rustMigrationsDir)) {
    const userUp = path.join(rustMigrationsDir, '000001_create_users_table.up.sql');
    if (await fs.pathExists(userUp)) {
      const mysqlRustUser = `-- Create users table for MySQL
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
`;
      await fs.writeFile(userUp, mysqlRustUser, 'utf8');
    }

    const tokenUp = path.join(rustMigrationsDir, '000002_create_refresh_tokens.up.sql');
    if (await fs.pathExists(tokenUp)) {
      const mysqlRustToken = `-- Create refresh_tokens table for MySQL
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP NULL,
    user_agent VARCHAR(500),
    ip_address VARCHAR(45),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_refresh_tokens_user_id (user_id),
    CONSTRAINT fk_rf_users FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
`;
      await fs.writeFile(tokenUp, mysqlRustToken, 'utf8');
    }

    const fieldsUp = path.join(rustMigrationsDir, '000003_add_user_fields.up.sql');
    if (await fs.pathExists(fieldsUp)) {
      const mysqlRustFields = `-- Add phone and is_active columns for MySQL
ALTER TABLE users ADD COLUMN phone VARCHAR(20);
ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX idx_users_is_active ON users(is_active);
`;
      await fs.writeFile(fieldsUp, mysqlRustFields, 'utf8');
    }
  }
}

/**
 * Update references in scaffolded .agents/skills/ so AI assistants
 * know this project uses MySQL instead of PostgreSQL.
 */
async function transformAgentsSkills(targetDir) {
  const agentsDir = path.join(targetDir, '.agents');
  if (!await fs.pathExists(agentsDir)) return;

  async function walkDir(currentPath) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        await walkDir(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.yaml') || entry.name.endsWith('.yml'))) {
        let content = await fs.readFile(fullPath, 'utf8');
        let updated = false;

        if (content.includes('PostgreSQL')) {
          content = content.replace(/PostgreSQL/g, 'MySQL');
          updated = true;
        }
        if (content.includes('PgPool')) {
          content = content.replace(/PgPool/g, 'MySqlPool');
          updated = true;
        }
        if (content.includes('PostgresDB')) {
          content = content.replace(/PostgresDB/g, 'DB');
          updated = true;
        }
        if (content.includes("Transaction<'_, Postgres>")) {
          content = content.replace(/Transaction<'_, Postgres>/g, "Transaction<'_, MySql>");
          updated = true;
        }

        if (updated) {
          await fs.writeFile(fullPath, content, 'utf8');
        }
      }
    }
  }

  await walkDir(agentsDir);
}

module.exports = {
  transformBackendDatabase
};
