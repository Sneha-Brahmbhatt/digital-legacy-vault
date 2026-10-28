import express from 'express';
import { 
  getOwnerTrustees, 
  lookupTrusteeByEmail, 
  addTrustee, 
  updateTrusteePermissions, 
  revokeTrustee,
  getDesignatedVaultsForTrustee
} from '../controllers/trusteeController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();

router.use(authenticate);

// Owner management routes
router.get('/', authorize(ROLES.OWNER), getOwnerTrustees);
router.get('/lookup', authorize(ROLES.OWNER), lookupTrusteeByEmail);
router.post('/', authorize(ROLES.OWNER), addTrustee);
router.put('/:id/permissions', authorize(ROLES.OWNER), updateTrusteePermissions);
router.delete('/:id', authorize(ROLES.OWNER), revokeTrustee);

// Trustee perspective route
router.get('/my-designations', authorize(ROLES.TRUSTEE, ROLES.BOTH), getDesignatedVaultsForTrustee);

export default router;
