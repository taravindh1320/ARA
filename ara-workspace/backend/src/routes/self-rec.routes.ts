import { Router } from 'express';
import { SelfRecController } from '../controllers/self-rec.controller';
import { SelfRecMappingController } from '../controllers/self-rec-mapping.controller';
import { SelfRecPassesController } from '../controllers/self-rec-passes.controller';
import { SelfRecViewController } from '../controllers/self-rec-view.controller';
import { SelfRecRunController } from '../controllers/self-rec-run.controller';
import { SelfRecResultsController } from '../controllers/self-rec-results.controller';

const router = Router();

// POST /api/ara-self-rec/uploads
router.post('/uploads', SelfRecController.multerSingle, SelfRecController.uploadFile);

// POST /api/ara-self-rec/mapping/suggest
router.post('/mapping/suggest', SelfRecMappingController.suggest);

// POST /api/ara-self-rec/mapping
router.post('/mapping', SelfRecMappingController.saveMapping);

// GET  /api/ara-self-rec/passes
router.get('/passes', SelfRecPassesController.getPasses);

// POST /api/ara-self-rec/passes
router.post('/passes', SelfRecPassesController.savePasses);

// GET  /api/ara-self-rec/view
router.get('/view', SelfRecViewController.getView);

// POST /api/ara-self-rec/view
router.post('/view', SelfRecViewController.saveView);

// POST /api/ara-self-rec/run
router.post('/run', SelfRecRunController.runRecon);

// GET  /api/ara-self-rec/results/:runId
router.get('/results/:runId', SelfRecResultsController.getResults);

export default router;
