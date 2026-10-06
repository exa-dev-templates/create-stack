const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const { TEMPLATES_ROOT, TEMPLATES, IGNORED_ENTRIES } = require('./constants');

/**
 * Validates and sanitizes a project name for folder and package names
 */
function sanitizeProjectName(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/^[._]/, '')
    .replace(/[^a-z0-9-_]/g, '');
}

/**
 * Checks whether a directory is empty or not
 */
async function isDirEmpty(dirPath) {
  if (!await fs.pathExists(dirPath)) return true;
  const files = await fs.readdir(dirPath);
  return files.length === 0 || (files.length === 1 && files[0] === '.git');
}

/**
 * Recursively copies a directory while skipping ignored items
 */
async function copyTemplateDir(srcDir, destDir) {
  await fs.ensureDir(destDir);
  const items = await fs.readdir(srcDir);

  for (const item of items) {
    if (IGNORED_ENTRIES.has(item)) continue;

    const srcItem = path.join(srcDir, item);
    // npm pack renames .gitignore to .npmignore in packages; restore it here
    const destItemName = (item === '.npmignore') ? '.gitignore' : item;
    const destItem = path.join(destDir, destItemName);
    const stat = await fs.stat(srcItem);

    if (stat.isDirectory()) {
      await copyTemplateDir(srcItem, destItem);
    } else {
      await fs.copyFile(srcItem, destItem);
    }
  }
}

/**
 * Rewrites package.json, go.mod, pom.xml with the project name
 */
async function customizeTemplateFiles(targetDir, projectName, roleSuffix = '') {
  const finalName = roleSuffix ? `${projectName}-${roleSuffix}` : projectName;

  // 1. Update package.json if present
  const pkgPath = path.join(targetDir, 'package.json');
  if (await fs.pathExists(pkgPath)) {
    try {
      const pkg = await fs.readJson(pkgPath);
      pkg.name = finalName;
      pkg.version = '0.1.0';
      if (pkg.description) {
        pkg.description = `${finalName} generated from template`;
      }
      await fs.writeJson(pkgPath, pkg, { spaces: 2 });
    } catch {
      // Ignore json read errors
    }
  }

  // 2. Update go.mod if present
  const goModPath = path.join(targetDir, 'go.mod');
  if (await fs.pathExists(goModPath)) {
    try {
      let content = await fs.readFile(goModPath, 'utf8');
      content = content.replace(/^module\s+[^\r\n]+/m, `module ${finalName}`);
      await fs.writeFile(goModPath, content, 'utf8');
    } catch {
      // Ignore read errors
    }
  }

  // 3. Update pom.xml if present
  const pomPath = path.join(targetDir, 'pom.xml');
  if (await fs.pathExists(pomPath)) {
    try {
      let content = await fs.readFile(pomPath, 'utf8');
      // replace first occurrence of <artifactId>...</artifactId> inside project root or name
      content = content.replace(/<artifactId>[^<]+<\/artifactId>/, `<artifactId>${finalName}</artifactId>`);
      content = content.replace(/<name>[^<]+<\/name>/, `<name>${finalName}</name>`);
      await fs.writeFile(pomPath, content, 'utf8');
    } catch {
      // Ignore read errors
    }
  }

  // 4. Update .env.example if present (replace default db name)
  const envExamplePath = path.join(targetDir, '.env.example');
  if (await fs.pathExists(envExamplePath)) {
    try {
      let content = await fs.readFile(envExamplePath, 'utf8');
      const cleanDbName = projectName.replace(/[^a-zA-Z0-9_]/g, '_');
      content = content.replace(/DATABASE_NAME=\w+/g, `DATABASE_NAME=${cleanDbName}_db`);
      content = content.replace(/\/mydb(\b|\?)/g, `/${cleanDbName}_db$1`);
      await fs.writeFile(envExamplePath, content, 'utf8');
    } catch {
      // Ignore
    }
  }
}

/**
 * Initializes a new git repo
 */
function initGitRepo(targetDir) {
  try {
    execSync('git init', { cwd: targetDir, stdio: 'ignore' });
    execSync('git add -A', { cwd: targetDir, stdio: 'ignore' });
    execSync('git commit -m "feat: initial commit from project generator"', { cwd: targetDir, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Scans workspace to discover any templates that might not be in the hardcoded list
 */
async function discoverAllTemplates() {
  const result = {
    frontend: [...TEMPLATES.frontend],
    backend: [...TEMPLATES.backend],
    worker: [...TEMPLATES.worker]
  };

  try {
    const entries = await fs.readdir(TEMPLATES_ROOT, { withFileTypes: true });
    const knownIds = new Set([
      ...result.frontend.map(t => t.id),
      ...result.backend.map(t => t.id),
      ...result.worker.map(t => t.id)
    ]);

    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith('template-') && !knownIds.has(entry.name)) {
        const id = entry.name;
        const name = id.replace(/^template-/, '');
        const item = {
          id,
          name,
          framework: 'Custom',
          description: `Custom template found at ${id}`,
          defaultFolder: name,
          commands: { dev: 'Check README' }
        };

        if (id.includes('worker')) {
          result.worker.push(item);
        } else if (id.includes('react') || id.includes('vue') || id.includes('angular') || id.includes('svelte') || id.includes('next')) {
          result.frontend.push(item);
        } else {
          result.backend.push(item);
        }
      }
    }
  } catch {
    // Fallback to static list
  }

  return result;
}

module.exports = {
  sanitizeProjectName,
  isDirEmpty,
  copyTemplateDir,
  customizeTemplateFiles,
  initGitRepo,
  discoverAllTemplates
};
