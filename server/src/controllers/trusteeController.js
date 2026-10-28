import TrusteeAssignment from '../models/TrusteeAssignment.js';
import User from '../models/User.js';
import VaultItem from '../models/VaultItem.js';
import { TRUSTEE_STATUS } from '../config/constants.js';

export const getOwnerTrustees = async (req, res, next) => {
  try {
    const trustees = await TrusteeAssignment.find({ ownerId: req.user._id })
      .populate('trusteeId', 'name email publicKey')
      .populate('assignedItems.itemId', 'category encryptedTitle titleIv createdAt')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: trustees.length,
      data: trustees
    });
  } catch (error) {
    next(error);
  }
};

export const lookupTrusteeByEmail = async (req, res, next) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email query parameter is required.'
      });
    }

    const trusteeUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (!trusteeUser) {
      return res.status(200).json({
        success: true,
        exists: false,
        message: 'No registered user found with this email. Trustee must create an account to receive keys.'
      });
    }

    if (!trusteeUser.publicKey) {
      return res.status(200).json({
        success: true,
        exists: true,
        hasPublicKey: false,
        message: 'User exists but has not generated an RSA public key yet.'
      });
    }

    res.status(200).json({
      success: true,
      exists: true,
      hasPublicKey: true,
      data: {
        _id: trusteeUser._id,
        name: trusteeUser.name,
        email: trusteeUser.email,
        publicKey: trusteeUser.publicKey
      }
    });
  } catch (error) {
    next(error);
  }
};

export const addTrustee = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Trustee email is required.'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Prevent owner from designating themselves as trustee
    if (normalizedEmail === req.user.email) {
      return res.status(400).json({
        success: false,
        message: 'You cannot designate yourself as a trustee for your own vault.'
      });
    }

    // Check if trustee is already registered
    const trusteeUser = await User.findOne({ email: normalizedEmail });

    // Check if assignment already exists
    let assignment = await TrusteeAssignment.findOne({
      ownerId: req.user._id,
      trusteeEmail: normalizedEmail
    });

    if (assignment) {
      if (assignment.status === TRUSTEE_STATUS.REVOKED) {
        assignment.status = TRUSTEE_STATUS.ACTIVE;
        if (trusteeUser) assignment.trusteeId = trusteeUser._id;
        await assignment.save();
        return res.status(200).json({
          success: true,
          message: 'Trustee access reactivated.',
          data: assignment
        });
      }
      return res.status(409).json({
        success: false,
        message: 'Trustee already assigned to your vault.'
      });
    }

    assignment = new TrusteeAssignment({
      ownerId: req.user._id,
      trusteeEmail: normalizedEmail,
      trusteeId: trusteeUser ? trusteeUser._id : null,
      assignedItems: [],
      status: TRUSTEE_STATUS.ACTIVE
    });

    await assignment.save();

    res.status(201).json({
      success: true,
      message: 'Trustee designated successfully.',
      data: assignment
    });
  } catch (error) {
    next(error);
  }
};

export const updateTrusteePermissions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { assignedItems } = req.body;

    const assignment = await TrusteeAssignment.findOne({
      _id: id,
      ownerId: req.user._id
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Trustee assignment not found.'
      });
    }

    if (assignment.status === TRUSTEE_STATUS.REVOKED) {
      return res.status(400).json({
        success: false,
        message: 'Cannot update permissions for a revoked trustee. Reactivate first.'
      });
    }

    // Validate that all assigned item IDs actually belong to the authenticated owner
    if (Array.isArray(assignedItems) && assignedItems.length > 0) {
      const itemIds = assignedItems.map(a => a.itemId);
      const ownerItems = await VaultItem.find({
        _id: { $in: itemIds },
        ownerId: req.user._id
      });

      if (ownerItems.length !== itemIds.length) {
        return res.status(403).json({
          success: false,
          message: 'One or more assigned vault items do not belong to you.'
        });
      }

      assignment.assignedItems = assignedItems;
    } else {
      assignment.assignedItems = [];
    }

    await assignment.save();

    res.status(200).json({
      success: true,
      message: 'Trustee permissions and wrapped keys updated successfully.',
      data: assignment
    });
  } catch (error) {
    next(error);
  }
};

export const revokeTrustee = async (req, res, next) => {
  try {
    const { id } = req.params;

    const assignment = await TrusteeAssignment.findOne({
      _id: id,
      ownerId: req.user._id
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Trustee assignment not found.'
      });
    }

    assignment.status = TRUSTEE_STATUS.REVOKED;
    assignment.assignedItems = []; // Remove wrapped keys
    await assignment.save();

    res.status(200).json({
      success: true,
      message: 'Trustee permissions revoked and wrapped keys purged.',
      data: assignment
    });
  } catch (error) {
    next(error);
  }
};

export const getDesignatedVaultsForTrustee = async (req, res, next) => {
  try {
    // Finds active assignments where trusteeEmail matches current user email or trusteeId matches
    const designations = await TrusteeAssignment.find({
      $or: [
        { trusteeId: req.user._id },
        { trusteeEmail: req.user.email }
      ],
      status: TRUSTEE_STATUS.ACTIVE
    })
      .populate('ownerId', 'name email gracePeriodHours')
      .select('ownerId status createdAt assignedItems');

    res.status(200).json({
      success: true,
      count: designations.length,
      data: designations
    });
  } catch (error) {
    next(error);
  }
};
