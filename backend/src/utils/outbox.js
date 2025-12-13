import fs from 'fs';
import path from 'path';

const OUTBOX_DIR = path.resolve(process.cwd(), 'storage/mail-outbox');

function ensureOutboxDir() {
  if (!fs.existsSync(OUTBOX_DIR)) {
    fs.mkdirSync(OUTBOX_DIR, { recursive: true });
  }
}

export function writeMailToOutbox(payload) {
  ensureOutboxDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(OUTBOX_DIR, `mail-${timestamp}.json`);
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
  return filePath;
}

export function listOutbox() {
  ensureOutboxDir();
  const files = fs.readdirSync(OUTBOX_DIR).filter(f => f.endsWith('.json')).sort().reverse();
  return files.map(f => {
    const full = path.join(OUTBOX_DIR, f);
    const content = JSON.parse(fs.readFileSync(full, 'utf8'));
    return {
      file: f,
      createdAt: content.createdAt,
      to: content.to,
      subject: content.subject,
      statementId: content.statementId || null,
      invoiceNumber: content.invoiceNumber || null
    };
  });
}

export const OUTBOX_PATH = OUTBOX_DIR;
