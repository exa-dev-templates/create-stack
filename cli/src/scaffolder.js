const fs = require('fs-extra');
const path = require('path');
const { TEMPLATES_ROOT } = require('./constants');
const {
  copyTemplateDir,
  customizeTemplateFiles,
  initGitRepo
} = require('./utils');

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
    if (createEnv && await fs.pathExists(path.join(dest, '.env.example'))) {
      await fs.copy(path.join(dest, '.env.example'), path.join(dest, '.env'));
    }
    installedServices.push({ role: 'Backend', info: backend, folder: backend.defaultFolder || 'backend' });
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

  // 4. Generate Root README.md
  await generateRootReadme(targetDir, projectName, installedServices);

  // 5. Generate Root .gitignore
  await generateRootGitignore(targetDir);

  // 6. Generate Root package.json for convenience runner scripts
  await generateRootPackageJson(targetDir, projectName, installedServices);

  // 7. Git Init
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
    createEnv = true,
    initGit = true
  } = options;

  await fs.ensureDir(targetDir);
  const src = path.join(TEMPLATES_ROOT, template.id);

  // Copy directly to root of targetDir
  await copyTemplateDir(src, targetDir);
  await customizeTemplateFiles(targetDir, projectName, '');

  if (createEnv && await fs.pathExists(path.join(targetDir, '.env.example'))) {
    await fs.copy(path.join(targetDir, '.env.example'), path.join(targetDir, '.env'));
  }

  let gitInitialized = false;
  if (initGit) {
    gitInitialized = initGitRepo(targetDir);
  }

  return {
    installedServices: [{ role: 'Service', info: template, folder: '.' }],
    gitInitialized
  };
}

/**
 * Creates root README.md for fullstack projects
 */
async function generateRootReadme(targetDir, projectName, services) {
  let content = `# ${projectName}\n\n`;
  content += `> Fullstack project scaffolded via **Create Stack CLI**\n\n`;
  content += `## 🏗️ Architecture Overview\n\n`;

  for (const s of services) {
    content += `### 🔹 ${s.role}: \`${s.info.name}\`\n`;
    content += `- **Location:** \`./${s.folder}\`\n`;
    content += `- **Stack:** ${s.info.framework || s.info.name}\n`;
    content += `- **Description:** ${s.info.description || '-'}\n`;
    if (s.info.devPort) {
      content += `- **Default Port:** \`http://localhost:${s.info.devPort}\`\n`;
    }
    content += `\n`;
  }

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

  for (const s of services) {
    if (s.role === 'Frontend') {
      scripts['dev:fe'] = `cd ${s.folder} && npm run dev`;
      scripts['build:fe'] = `cd ${s.folder} && npm run build`;
    } else if (s.role === 'Backend') {
      if (s.info.id === 'template-express') {
        scripts['dev:be'] = `cd ${s.folder} && npm run dev`;
      } else if (s.info.id === 'template-golang') {
        scripts['dev:be'] = `cd ${s.folder} && go run main.go`;
      } else if (s.info.id === 'template-fastapi-async') {
        scripts['dev:be'] = `cd ${s.folder} && uvicorn app:app --reload`;
      } else if (s.info.id === 'template-java') {
        scripts['dev:be'] = `cd ${s.folder} && ./mvnw spring-boot:run`;
      }
    } else if (s.role === 'Worker') {
      if (s.info.id === 'template-worker-typescript') {
        scripts['dev:worker'] = `cd ${s.folder} && npm run dev`;
      }
    }
  }

  const rootPkg = {
    name: projectName,
    version: '0.1.0',
    private: true,
    description: `Root workspace for ${projectName}`,
    scripts
  };

  await fs.writeJson(path.join(targetDir, 'package.json'), rootPkg, { spaces: 2 });
}

module.exports = {
  scaffoldFullstackProject,
  scaffoldSingleProject
};
