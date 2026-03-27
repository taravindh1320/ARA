import { Router } from 'express';
import { NeuralController } from '../controllers/neural.controller';

const router = Router();

// GET /api/ara-neural/fullkeys?search=&region=&status=&page=&pageSize=
router.get('/fullkeys', NeuralController.listFullKeys);

// GET /api/ara-neural/fullkeys/:groupId
router.get('/fullkeys/:groupId', NeuralController.getFullKeyDetail);

export default router;
