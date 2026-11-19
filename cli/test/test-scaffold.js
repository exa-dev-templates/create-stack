const path = require('path');
const fs = require('fs-extra');
const assert = require('assert');
const { scaffoldSingleProject, scaffoldFullstackProject } = require('../src/scaffolder');
const { discoverAllTemplates } = require('../src/utils');

async function runTests() {
  console.log('🧪 Starting Create Stack CLI Test Suite...\n');
  const allTemplates = await discoverAllTemplates();
  const testBaseDir = path.resolve('/tmp/create-stack-test-suite');

  await fs.remove(testBaseDir);
  await fs.ensureDir(testBaseDir);

  try {
    // 1. Single Template Tests with MySQL for all 5 Backends
    const backends = ['template-express', 'template-java', 'template-golang', 'template-fastapi-async', 'template-rust'];

    for (const beId of backends) {
      console.log(`Checking ${beId} (MySQL)...`);
      const tpl = allTemplates.backend.find(t => t.id === beId);
      assert(tpl, `Template ${beId} must exist`);

      const target = path.join(testBaseDir, beId + '-mysql');
      await scaffoldSingleProject({
        targetDir: target,
        projectName: 'test-' + beId,
        template: tpl,
        database: 'mysql',
        createEnv: true,
        initGit: false
      });

      const envContent = await fs.readFile(path.join(target, '.env'), 'utf8');
      const composeContent = await fs.readFile(path.join(target, 'docker-compose.yml'), 'utf8');

      assert(composeContent.includes('mysql-dev'), `${beId} must contain mysql-dev container`);
      assert(envContent.includes('3306'), `${beId} .env must contain port 3306`);
      assert(envContent.includes('AUTO_MIGRATE=true'), `${beId} .env must contain AUTO_MIGRATE=true`);

      if (beId === 'template-express') {
        const pkg = await fs.readJson(path.join(target, 'package.json'));
        const dbTs = await fs.readFile(path.join(target, 'src/config/database.ts'), 'utf8');
        const migrateTs = await fs.readFile(path.join(target, 'src/config/migrate.ts'), 'utf8');
        const hasMigrateJs = await fs.pathExists(path.join(target, 'scripts/migrate.js'));
        assert(pkg.dependencies.mysql2, 'Express must depend on mysql2');
        assert(!pkg.dependencies.pg, 'Express must not depend on pg');
        assert(!pkg.dependencies['node-pg-migrate'], 'Express MySQL must not depend on node-pg-migrate');
        assert(dbTs.includes("from 'mysql2/promise'"), 'Express database.ts must import mysql2');
        assert(migrateTs.includes("from 'mysql2/promise'"), 'Express migrate.ts must import mysql2 for auto-migration');
        assert(hasMigrateJs, 'Express must provide scripts/migrate.js');
      }

      if (beId === 'template-java') {
        const pom = await fs.readFile(path.join(target, 'pom.xml'), 'utf8');
        const props = await fs.readFile(path.join(target, 'src/main/resources/application.properties'), 'utf8');
        assert(pom.includes('mysql-connector-j'), 'Java pom.xml must depend on mysql-connector-j');
        assert(props.includes('MySQLDialect'), 'Java application.properties must use MySQLDialect');
        assert(props.includes('spring.liquibase.enabled=${AUTO_MIGRATE:true}'), 'Java props must set liquibase auto migrate');
      }

      if (beId === 'template-golang') {
        const configGo = await fs.readFile(path.join(target, 'config/config.go'), 'utf8');
        const pgGo = await fs.readFile(path.join(target, 'database/postgres.go'), 'utf8');
        const migrateGo = await fs.readFile(path.join(target, 'database/migrate/migrate.go'), 'utf8');
        const authRepo = await fs.readFile(path.join(target, 'internal/module/auth/repository.go'), 'utf8');
        assert(configGo.includes('AutoMigrate'), 'Golang config must contain AutoMigrate field');
        assert(configGo.includes('@tcp'), 'Golang DSN must format @tcp socket');
        assert(pgGo.includes('github.com/go-sql-driver/mysql'), 'Golang database must import mysql driver');
        assert(migrateGo.includes('database/mysql'), 'Golang migrate must import mysql database driver');
        assert(authRepo.includes('WHERE email = ?'), 'Golang query must use ? placeholder');
      }

      if (beId === 'template-fastapi-async') {
        const reqTxt = await fs.readFile(path.join(target, 'requirements.txt'), 'utf8');
        const dbPy = await fs.readFile(path.join(target, 'lib/database.py'), 'utf8');
        const alembicEnv = await fs.readFile(path.join(target, 'alembic/env.py'), 'utf8');
        const settingsPy = await fs.readFile(path.join(target, 'config/settings.py'), 'utf8');
        assert(reqTxt.includes('asyncmy'), 'FastAPI requirements must include asyncmy');
        assert(dbPy.includes('mysql+asyncmy://'), 'FastAPI database.py must configure mysql+asyncmy URL');
        assert(dbPy.includes('run_auto_migrations'), 'FastAPI database.py must define run_auto_migrations');
        assert(settingsPy.includes('AUTO_MIGRATE'), 'FastAPI settings must include AUTO_MIGRATE');
        assert(alembicEnv.includes('mysql+asyncmy://'), 'FastAPI alembic env.py must configure async URL');
      }

      if (beId === 'template-rust') {
        const cargoToml = await fs.readFile(path.join(target, 'Cargo.toml'), 'utf8');
        const hasMysqlRs = await fs.pathExists(path.join(target, 'src/database/mysql.rs'));
        const hasPgRs = await fs.pathExists(path.join(target, 'src/database/postgres.rs'));
        const libRs = await fs.readFile(path.join(target, 'src/lib.rs'), 'utf8');
        const configMod = await fs.readFile(path.join(target, 'src/config/mod.rs'), 'utf8');
        assert(cargoToml.includes('"mysql"'), 'Rust Cargo.toml must enable mysql sqlx feature');
        assert(hasMysqlRs && !hasPgRs, 'Rust database module must be mysql.rs');
        assert(libRs.includes('MySqlPool'), 'Rust lib.rs must use MySqlPool');
        assert(configMod.includes('auto_migrate'), 'Rust config must contain auto_migrate field');
      }

      console.log(`  ✓ ${beId} passed!`);
    }

    // 2. Default PostgreSQL Single Template Test
    console.log('\nChecking template-express (Default PostgreSQL)...');
    const pgTarget = path.join(testBaseDir, 'express-pg');
    await scaffoldSingleProject({
      targetDir: pgTarget,
      projectName: 'test-express-pg',
      template: allTemplates.backend.find(t => t.id === 'template-express'),
      database: 'postgres',
      createEnv: true,
      initGit: false
    });
    const pgPkg = await fs.readJson(path.join(pgTarget, 'package.json'));
    const pgCompose = await fs.readFile(path.join(pgTarget, 'docker-compose.yml'), 'utf8');
    const pgEnv = await fs.readFile(path.join(pgTarget, '.env'), 'utf8');
    const pgMigrateTs = await fs.readFile(path.join(pgTarget, 'src/config/migrate.ts'), 'utf8');
    assert(pgPkg.dependencies.pg, 'Default Express must keep pg dependency');
    assert(pgPkg.dependencies['node-pg-migrate'], 'Default Express must depend on node-pg-migrate');
    assert(pgMigrateTs.includes("from 'node-pg-migrate'"), 'Default Express migrate.ts must import node-pg-migrate');
    assert(pgCompose.includes('postgres-dev'), 'Default Express must use postgres-dev container');
    assert(pgEnv.includes('5432'), 'Default Express must keep port 5432');
    assert(pgEnv.includes('AUTO_MIGRATE=true'), 'Default Express .env must have AUTO_MIGRATE=true');
    console.log('  ✓ template-express (PostgreSQL) passed!');

    // 3. Fullstack Project Test with MySQL
    console.log('\nChecking Fullstack Project (React + Express + Go Worker with MySQL)...');
    const fullstackTarget = path.join(testBaseDir, 'fullstack-mysql');
    await scaffoldFullstackProject({
      targetDir: fullstackTarget,
      projectName: 'my-fullstack-app',
      frontend: allTemplates.frontend.find(t => t.id === 'template-react'),
      backend: allTemplates.backend.find(t => t.id === 'template-express'),
      worker: allTemplates.worker.find(t => t.id === 'template-worker-golang'),
      database: 'mysql',
      createEnv: true,
      initGit: false
    });
    const rootReadme = await fs.readFile(path.join(fullstackTarget, 'README.md'), 'utf8');
    const beEnv = await fs.readFile(path.join(fullstackTarget, 'backend/.env'), 'utf8');
    const fePkg = await fs.readJson(path.join(fullstackTarget, 'frontend/package.json'));
    const workerMod = await fs.readFile(path.join(fullstackTarget, 'worker/go.mod'), 'utf8');
    const hasReactAuthModule = await fs.pathExists(path.join(fullstackTarget, 'frontend/src/modules/auth/index.ts'));
    const hasReactUsersModule = await fs.pathExists(path.join(fullstackTarget, 'frontend/src/modules/users/index.ts'));
    const hasReactDashboardModule = await fs.pathExists(path.join(fullstackTarget, 'frontend/src/modules/dashboard/index.ts'));
    const hasInfraCompose = await fs.pathExists(path.join(fullstackTarget, 'docker-compose.infra.yml'));
    const infraCompose = await fs.readFile(path.join(fullstackTarget, 'docker-compose.infra.yml'), 'utf8');
    const rootPkg = await fs.readJson(path.join(fullstackTarget, 'package.json'));

    assert(hasInfraCompose, 'Fullstack project must generate docker-compose.infra.yml');
    assert(infraCompose.includes('mysql:8.4'), 'docker-compose.infra.yml must contain mysql:8.4');
    assert(infraCompose.includes('redis:7-alpine'), 'docker-compose.infra.yml must contain redis:7-alpine');
    assert(infraCompose.includes('rabbitmq:3-management-alpine'), 'docker-compose.infra.yml must contain rabbitmq');
    assert(rootPkg.scripts['infra:up'], 'package.json must contain infra:up script');
    assert(rootPkg.scripts['dev:all'], 'package.json must contain dev:all script');
    assert(rootReadme.includes('MySQL 8.4'), 'Root README must display MySQL 8.4');
    assert(beEnv.includes('3306'), 'Backend .env must have port 3306');
    assert(fePkg.name.includes('my-fullstack-app'), 'Frontend package name must be updated');
    assert(workerMod.includes('my-fullstack-app-worker'), 'Worker go.mod must be updated');
    assert(hasReactAuthModule, 'Frontend React must have modules/auth');
    assert(hasReactUsersModule, 'Frontend React must have modules/users');
    assert(hasReactDashboardModule, 'Frontend React must have modules/dashboard');
    console.log('  ✓ Fullstack project passed!');

    // 4. Single Frontend Test (Vue with modular structure)
    console.log('\nChecking template-vue (Modular architecture)...');
    const vueTarget = path.join(testBaseDir, 'vue-modular');
    await scaffoldSingleProject({
      targetDir: vueTarget,
      projectName: 'test-vue-modular',
      template: allTemplates.frontend.find(t => t.id === 'template-vue'),
      createEnv: false,
      initGit: false
    });
    const hasVueAuthModule = await fs.pathExists(path.join(vueTarget, 'src/modules/auth/index.ts'));
    const hasVueUsersModule = await fs.pathExists(path.join(vueTarget, 'src/modules/users/index.ts'));
    const hasVueDashboardModule = await fs.pathExists(path.join(vueTarget, 'src/modules/dashboard/index.ts'));
    assert(hasVueAuthModule, 'Frontend Vue must have modules/auth');
    assert(hasVueUsersModule, 'Frontend Vue must have modules/users');
    assert(hasVueDashboardModule, 'Frontend Vue must have modules/dashboard');
    console.log('  ✓ template-vue (Modular) passed!');

    console.log('\n✨ All tests passed with 100% success!\n');
  } finally {
    await fs.remove(testBaseDir);
  }
}

runTests().catch(err => {
  console.error('\n❌ Test failure:', err);
  process.exit(1);
});

