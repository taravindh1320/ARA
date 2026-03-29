import multer from 'multer';
import { Request, Response } from 'express';

// ── Multer — memory storage (no disk writes) ─────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max
});

export interface UploadResult {
  source: string;
  name: string;
  size: number;
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

    const { columns, preview } = parseCSVPreview(req.file.buffer);

    const result: UploadResult = {
      source,
      name: req.file.originalname,
      size: req.file.size,
      columns,
      preview,
    };

    res.status(200).json(result);
  };
}
