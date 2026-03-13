const cron = require("node-cron");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

const BACKUPS_DIR = path.join(__dirname, "../../backups");
const TEMP_DIR = path.join(__dirname, "../../backup-temp");

const DB_NAME = process.env.DB_NAME || "school_db";
const MONGO_URL = process.env.MONGO_URL || "";
const ZIP_PASSWORD = process.env.BACKUP_PASSWORD || "BLIMSbackup123";
const SEVEN_ZIP_PATH = `"C:\\Program Files\\7-Zip\\7z.exe"`;

// backup time
const CRON_SCHEDULE = "* * */10 * *";

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getTimestamp() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}_${hh}-${mi}-${ss}`;
}

function execCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (stdout) console.log(stdout.trim());
      if (stderr) console.log(stderr.trim());

      if (error) {
        return reject(new Error(stderr || error.message));
      }

      resolve(stdout);
    });
  });
}

async function runBackup(source = "manual") {
  ensureDir(BACKUPS_DIR);
  ensureDir(TEMP_DIR);

  const timestamp = getTimestamp();
  const dumpFolder = path.join(TEMP_DIR, `dump_${timestamp}`);
  const archiveFile = path.join(
    BACKUPS_DIR,
    `blims_backup_${source}_${timestamp}.7z`
  );

  ensureDir(dumpFolder);

  let dumpCommand = "";
  if (MONGO_URL) {
    dumpCommand = `mongodump --uri="${MONGO_URL}" --out="${dumpFolder}"`;
  } else {
    dumpCommand = `mongodump --db="${DB_NAME}" --out="${dumpFolder}"`;
  }

  const zipCommand = `${SEVEN_ZIP_PATH} a -t7z "${archiveFile}" "${dumpFolder}\\*" -p"${ZIP_PASSWORD}" -mhe`;

  try {
    console.log(`📦 Starting ${source} backup...`);
    console.log(`📁 Dump folder: ${dumpFolder}`);
    console.log(`🗜️ Archive file: ${archiveFile}`);

    await execCommand(dumpCommand);
    await execCommand(zipCommand);

    if (fs.existsSync(dumpFolder)) {
      fs.rmSync(dumpFolder, { recursive: true, force: true });
    }

    console.log(`✅ Backup created: ${archiveFile}`);
    return archiveFile;
  } catch (err) {
    console.error("❌ Backup error:", err.message);

    if (fs.existsSync(dumpFolder)) {
      fs.rmSync(dumpFolder, { recursive: true, force: true });
    }

    throw err;
  }
}

function startBackupScheduler() {
  cron.schedule(CRON_SCHEDULE, async () => {
    try {
      await runBackup("auto");
    } catch (err) {
      console.error("❌ Scheduled backup failed:", err.message);
    }
  });

  console.log(`⏰ Backup scheduler started (${CRON_SCHEDULE})`);
}

module.exports = {
  startBackupScheduler,
  runBackup,
};