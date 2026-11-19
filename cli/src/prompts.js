const p = require('@clack/prompts');
const pc = require('picocolors');
const path = require('path');
const fs = require('fs-extra');
const {
  sanitizeProjectName,
  isDirEmpty,
  discoverAllTemplates
} = require('./utils');
const { SUPPORTED_DATABASES } = require('./constants');

async function runInteractiveWizard(cliArgs = {}) {
  p.intro(pc.bgCyan(pc.black(' 🚀 PROJECT TEMPLATE WIZARD ')));

  // Discover available templates
  const allTemplates = await discoverAllTemplates();

  // 1. Project Name / Target Directory
  let projectName = cliArgs.name;
  if (!projectName) {
    const rawName = await p.text({
      message: 'Masukkan nama project:',
      placeholder: 'my-awesome-app',
      defaultValue: 'my-project',
      validate(val) {
        if (!val || val.trim().length === 0) return 'Nama project tidak boleh kosong!';
        const sanitized = sanitizeProjectName(val);
        if (sanitized.length === 0) return 'Nama project mengandung karakter tidak valid.';
      }
    });

    if (p.isCancel(rawName)) {
      p.cancel('Operasi dibatalkan.');
      process.exit(0);
    }
    projectName = sanitizeProjectName(rawName);
  } else {
    projectName = sanitizeProjectName(projectName);
  }

  const targetDir = path.resolve(process.cwd(), projectName);

  // Check if directory exists and is not empty
  if (!await isDirEmpty(targetDir)) {
    const shouldOverwrite = await p.confirm({
      message: `Folder ${pc.yellow(projectName)} sudah ada dan tidak kosong. Lanjutkan & overwrite file?`,
      initialValue: false
    });

    if (p.isCancel(shouldOverwrite) || !shouldOverwrite) {
      p.cancel('Pembuatan project dibatalkan.');
      process.exit(0);
    }
  }

  // 2. Select Project Mode
  let mode = cliArgs.mode;
  if (!mode) {
    mode = await p.select({
      message: 'Pilih jenis project yang ingin dibuat:',
      options: [
        {
          value: 'fullstack',
          label: '🌟 Fullstack Project (Backend + Frontend + Worker)',
          hint: 'Membuat folder frontend/, backend/, dll dalam 1 workspace'
        },
        {
          value: 'single',
          label: '⚡ Single Service (Hanya 1 Template)',
          hint: 'Hanya BE, FE, atau Worker langsung di root folder'
        }
      ]
    });

    if (p.isCancel(mode)) {
      p.cancel('Operasi dibatalkan.');
      process.exit(0);
    }
  }

  // === MODE: FULLSTACK ===
  if (mode === 'fullstack') {
    // A. Frontend Choice
    const feOptions = allTemplates.frontend.map(t => ({
      value: t.id,
      label: t.name,
      hint: t.description
    }));
    feOptions.push({
      value: 'none',
      label: '🚫 Skip (Tanpa Frontend)',
      hint: 'Tidak menyertakan frontend'
    });

    const chosenFeId = await p.select({
      message: 'Pilih Frontend (FE):',
      options: feOptions
    });
    if (p.isCancel(chosenFeId)) {
      p.cancel('Operasi dibatalkan.');
      process.exit(0);
    }

    // B. Backend Choice
    const beOptions = allTemplates.backend.map(t => ({
      value: t.id,
      label: t.name,
      hint: t.description
    }));
    beOptions.push({
      value: 'none',
      label: '🚫 Skip (Tanpa Backend)',
      hint: 'Tidak menyertakan backend'
    });

    const chosenBeId = await p.select({
      message: 'Pilih Backend (BE):',
      options: beOptions
    });
    if (p.isCancel(chosenBeId)) {
      p.cancel('Operasi dibatalkan.');
      process.exit(0);
    }

    // C. Worker Choice
    const workerOptions = [
      {
        value: 'none',
        label: '🚫 Skip (Tanpa Worker)',
        hint: 'Tidak perlu background service'
      },
      ...allTemplates.worker.map(t => ({
        value: t.id,
        label: t.name,
        hint: t.description
      }))
    ];

    const chosenWorkerId = await p.select({
      message: 'Pilih Worker / Background Service (Opsional):',
      options: workerOptions
    });
    if (p.isCancel(chosenWorkerId)) {
      p.cancel('Operasi dibatalkan.');
      process.exit(0);
    }

    // Validate that at least one component was picked
    if (chosenFeId === 'none' && chosenBeId === 'none' && chosenWorkerId === 'none') {
      p.cancel('Anda harus memilih setidaknya salah satu template (Frontend, Backend, atau Worker).');
      process.exit(1);
    }

    // D. Database Choice (only if Backend was chosen)
    let database = 'postgres';
    if (chosenBeId !== 'none') {
      if (cliArgs.database && ['postgres', 'mysql'].includes(cliArgs.database.toLowerCase())) {
        database = cliArgs.database.toLowerCase();
      } else {
        database = await p.select({
          message: 'Pilih Database Utama (Primary Database):',
          options: SUPPORTED_DATABASES.map(db => ({
            value: db.id,
            label: db.label,
            hint: db.hint
          })),
          initialValue: 'postgres'
        });
        if (p.isCancel(database)) {
          p.cancel('Operasi dibatalkan.');
          process.exit(0);
        }
      }
    }

    // E. Message Broker Choice (if Backend or Worker was chosen)
    let messageBroker = 'both';
    if (chosenBeId !== 'none' || chosenWorkerId !== 'none') {
      if (cliArgs.broker && ['rabbitmq', 'kafka', 'both', 'none'].includes(cliArgs.broker.toLowerCase())) {
        messageBroker = cliArgs.broker.toLowerCase();
      } else {
        messageBroker = await p.select({
          message: 'Pilih Message Broker / Event Streaming:',
          options: [
            { value: 'both', label: '🐰 + ⚡ Both (RabbitMQ + Apache Kafka)', hint: 'Rekomendasi fleksibel' },
            { value: 'rabbitmq', label: '🐰 RabbitMQ 3', hint: 'AMQP queue & RPC lightweight' },
            { value: 'kafka', label: '⚡ Apache Kafka (KRaft)', hint: 'Distributed event streaming' },
            { value: 'none', label: '🚫 Tanpa Message Broker', hint: 'Nonaktifkan messaging' }
          ],
          initialValue: 'both'
        });
        if (p.isCancel(messageBroker)) {
          p.cancel('Operasi dibatalkan.');
          process.exit(0);
        }
      }
    }

    // Extra options
    const createEnv = await p.confirm({
      message: 'Generate file .env otomatis dari .env.example?',
      initialValue: true
    });
    if (p.isCancel(createEnv)) {
      p.cancel('Operasi dibatalkan.');
      process.exit(0);
    }

    const initGit = await p.confirm({
      message: 'Inisialisasi git repository baru (git init)?',
      initialValue: true
    });
    if (p.isCancel(initGit)) {
      p.cancel('Operasi dibatalkan.');
      process.exit(0);
    }

    return {
      mode: 'fullstack',
      projectName,
      targetDir,
      frontend: allTemplates.frontend.find(t => t.id === chosenFeId) || null,
      backend: allTemplates.backend.find(t => t.id === chosenBeId) || null,
      worker: allTemplates.worker.find(t => t.id === chosenWorkerId) || null,
      database,
      messageBroker,
      createEnv,
      initGit
    };
  }

  // === MODE: SINGLE TEMPLATE ===
  if (mode === 'single') {
    const category = await p.select({
      message: 'Pilih kategori template:',
      options: [
        { value: 'frontend', label: '🎨 Frontend (React / Vue)' },
        { value: 'backend', label: '⚙️  Backend (Express / FastAPI / Go / Java)' },
        { value: 'worker', label: '🔄 Worker / Queue Consumer (Go / Java / Python / TS)' }
      ]
    });
    if (p.isCancel(category)) {
      p.cancel('Operasi dibatalkan.');
      process.exit(0);
    }

    const available = allTemplates[category] || [];
    const chosenTemplateId = await p.select({
      message: `Pilih template ${category}:`,
      options: available.map(t => ({
        value: t.id,
        label: t.name,
        hint: t.description
      }))
    });
    if (p.isCancel(chosenTemplateId)) {
      p.cancel('Operasi dibatalkan.');
      process.exit(0);
    }

    const template = available.find(t => t.id === chosenTemplateId);

    // Prompt for Database if category is backend
    let database = 'postgres';
    if (category === 'backend') {
      if (cliArgs.database && ['postgres', 'mysql'].includes(cliArgs.database.toLowerCase())) {
        database = cliArgs.database.toLowerCase();
      } else {
        database = await p.select({
          message: 'Pilih Database Utama (Primary Database):',
          options: SUPPORTED_DATABASES.map(db => ({
            value: db.id,
            label: db.label,
            hint: db.hint
          })),
          initialValue: 'postgres'
        });
        if (p.isCancel(database)) {
          p.cancel('Operasi dibatalkan.');
          process.exit(0);
        }
      }
    }

    let messageBroker = 'both';
    if (category === 'backend' || category === 'worker') {
      if (cliArgs.broker && ['rabbitmq', 'kafka', 'both', 'none'].includes(cliArgs.broker.toLowerCase())) {
        messageBroker = cliArgs.broker.toLowerCase();
      } else {
        messageBroker = await p.select({
          message: 'Pilih Message Broker / Event Streaming:',
          options: [
            { value: 'both', label: '🐰 + ⚡ Both (RabbitMQ + Apache Kafka)', hint: 'Rekomendasi fleksibel' },
            { value: 'rabbitmq', label: '🐰 RabbitMQ 3', hint: 'AMQP queue & RPC lightweight' },
            { value: 'kafka', label: '⚡ Apache Kafka (KRaft)', hint: 'Distributed event streaming' },
            { value: 'none', label: '🚫 Tanpa Message Broker', hint: 'Nonaktifkan messaging' }
          ],
          initialValue: 'both'
        });
        if (p.isCancel(messageBroker)) {
          p.cancel('Operasi dibatalkan.');
          process.exit(0);
        }
      }
    }

    const createEnv = await p.confirm({
      message: 'Generate file .env otomatis dari .env.example?',
      initialValue: true
    });
    if (p.isCancel(createEnv)) {
      p.cancel('Operasi dibatalkan.');
      process.exit(0);
    }

    const initGit = await p.confirm({
      message: 'Inisialisasi git repository baru (git init)?',
      initialValue: true
    });
    if (p.isCancel(initGit)) {
      p.cancel('Operasi dibatalkan.');
      process.exit(0);
    }

    return {
      mode: 'single',
      projectName,
      targetDir,
      template,
      database,
      messageBroker,
      createEnv,
      initGit
    };
  }
}

module.exports = {
  runInteractiveWizard
};
