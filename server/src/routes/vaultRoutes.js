import express from 'express';
import { 
  getVaultItems, 
  getVaultItemById, 
  createVaultItem, 
  updateVaultItem, 
  deleteVaultItem,
  uploadEncryptedDocument,
  downloadEncryptedDocument
} from '../controllers/vaultController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validateVaultItem } from '../validators/vaultValidator.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();

// All vault routes require authentication
router.use(authenticate);

router.get('/', authorize(ROLES.OWNER), getVaultItems);
router.post('/', authorize(ROLES.OWNER), validateVaultItem, createVaultItem);
router.post('/upload-document', authorize(ROLES.OWNER), uploadEncryptedDocument);
router.get('/:id/document', authorize(ROLES.OWNER), downloadEncryptedDocument);
router.get('/:id', authorize(ROLES.OWNER), getVaultItemById);
router.put('/:id', authorize(ROLES.OWNER), updateVaultItem);
router.delete('/:id', authorize(ROLES.OWNER), deleteVaultItem);

export default router;
