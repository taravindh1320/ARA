import multer from 'multer';
import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// ── Upload directory — shared with the Python engine ────────────────────────
// Resolved relative to the backend package root so it works regardless of
// the working directory the process is started from.
const UPLOAD_DIR = path.resolve(__dirname, '..', '..', '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// In-memory index: uploadId → absolute file path on disk
// (good enough for the current single-process dev setup)
const uploadStore = new Map<string, string>();

export function resolveUploadPath(uploadId: string): string | undefined {
  return uploadStore.get(uploadId);
}

// ── Multer — disk storage so Python can read the file ───────────────────────
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const id = crypto.randomUUID();
      // Preserve the original extension
      const ext = path.extname(file.originalname).toLowerCase() || '.csv';
      cb(null, `${id}${ext}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max
});

export interface UploadResult {
  source: string;
  name: string;
  size: number;
  uploadId: string;
  columns: string[];
  preview: string[][];
}

// ── CSV preview parser ────────────────────────────────────────────────────────
function parseCSVPreview(buffer: Buffer): Pick<UploadResult, 'columns' | 'preview'> {
  const text = buffer.toString('utf8');
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);

  const parseLine = (line: string): string[] =>
    line.split(',').map(cell => cell.replace(/^"|"$/g, '').trim());

  const columns = parseLine(lines[0] ?? '');
  const preview = lines.slice(1, 6).map(parseLine);

  return { columns, preview };
}

export class SelfRecController {

  // Multer middleware — single file field named "file"
  static readonly multerSingle = upload.single('file');

  // POST /api/ara-self-rec/uploads
  static uploadFile = (req: Request, res: Response): void => {
    const source = req.body?.source as string;

    if (!source || !['A', 'B'].includes(source)) {
      res.status(400).json({ error: 'source must be "A" or "B"' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'No file provided.' });
      return;
    }

    // req.file.path is the absolute path written by multer disk storage.
    // Derive the uploadId from the generated filename (UUID portion).
    const uploadId = path.basename(req.file.filename, path.extname(req.file.filename));
    uploadStore.set(uploadId, req.file.path);

    console.log(`[Upload] source=${source} uploadId=${uploadId} path=${req.file.path}`);

    // Read the saved file from disk for the CSV preview
    const buffer = fs.readFileSync(req.file.path);
    const { columns, preview } = parseCSVPreview(buffer);

    const result: UploadResult = {
      source,
      name: req.file.originalname,
      size: req.file.size,
      uploadId,
      columns,
      preview,
    };

    res.status(200).json(result);
  };
}
