const p = require('@clack/prompts');
const pc = require('picocolors');
const path = require('path');
const { runInteractiveWizard } = require('./prompts');
const { scaffoldFullstackProject, scaffoldSingleProject } = require('./scaffolder');

function printHelp() {
  console.log(`
${pc.bold(pc.cyan('Create Stack CLI'))} - Project Scaffolder from Templates

${pc.bold('Penggunaan:')}
  ${pc.green('npx @exa31/create-stack')} [options]
  ${pc.green('node cli/bin/create-app.js')} [options]

${pc.bold('Options:')}
  --name, -n <nama>     Nama project yang akan dibuat
  --mode, -m <mode>     Mode project: 'fullstack' atau 'single'
  --db, -d <database>   Database utama: 'postgres' atau 'mysql'
  --help, -h            Tampilkan bantuan ini
  --version, -v         Tampilkan versi
  `);
}

async function main() {
  const args = process.argv.slice(2);

  // Check help or version
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  if (args.includes('--version') || args.includes('-v')) {
    const pkg = require('../package.json');
    console.log(`v${pkg.version}`);
    process.exit(0);
  }

  // Parse simple CLI flags
  const cliArgs = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' || args[i] === '-n') {
      cliArgs.name = args[++i];
    } else if (args[i] === '--mode' || args[i] === '-m') {
      cliArgs.mode = args[++i];
    } else if (args[i] === '--db' || args[i] === '-d' || args[i] === '--database') {
      cliArgs.database = args[++i];
    } else if (!args[i].startsWith('-') && !cliArgs.name) {
      cliArgs.name = args[i];
    }
  }

  try {
    const config = await runInteractiveWizard(cliArgs);

    const spinner = p.spinner();
    spinner.start(`Sedang menyiapkan project ${pc.cyan(config.projectName)}...`);

    let result;
    if (config.mode === 'fullstack') {
      result = await scaffoldFullstackProject(config);
    } else {
      result = await scaffoldSingleProject(config);
    }

    spinner.stop(pc.green(`✔ Project ${config.projectName} berhasil dibuat!`));

    // Display summary and next steps
    let instructions = `Langkah selanjutnya:\n\n`;
    instructions += `  ${pc.cyan(`cd ${config.projectName}`)}\n\n`;

    if (config.mode === 'fullstack') {
      instructions += pc.bold('Menjalankan service:\n');
      for (const s of result.installedServices) {
        instructions += `  ${pc.yellow(`[${s.role}]`)}: ${pc.cyan(`cd ${s.folder}`)}\n`;
        if (s.info.commands?.install) {
          instructions += `         ${pc.gray(s.info.commands.install)}\n`;
        }
        if (s.info.commands?.dev) {
          instructions += `         ${pc.green(s.info.commands.dev)}\n`;
        }
      }
    } else {
      const s = result.installedServices[0];
      if (s.info.commands?.install) {
        instructions += `  ${pc.gray(s.info.commands.install)}\n`;
      }
      if (s.info.commands?.dev) {
        instructions += `  ${pc.green(s.info.commands.dev)}\n`;
      }
    }

    if (result.gitInitialized) {
      instructions += `\n${pc.dim('✔ Git repository telah diinisialisasi otomatis.')}`;
    }

    p.note(instructions, pc.bold(pc.green('🎉 Setup Selesai!')));
    p.outro(pc.magenta('Selamat berkarya! ✨'));

  } catch (error) {
    p.cancel(pc.red(`Terjadi kesalahan: ${error.message}`));
    console.error(error);
    process.exit(1);
  }
}

module.exports = { main };
