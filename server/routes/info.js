import { Router } from 'express';
import { subsidiesData, exportStepsData } from '../data.js';

const router = Router();

export default function() {
  router.get('/', (req, res) => {
    res.json(subsidiesData);
  });

  router.get('/export-steps', (req, res) => {
    res.json(exportStepsData);
  });

  return router;
}
