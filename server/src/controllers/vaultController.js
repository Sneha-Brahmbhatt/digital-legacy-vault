import VaultItem from '../models/VaultItem.js';

export const getVaultItems = async (req, res, next) => {
  try {
    const { category } = req.query;
    const filter = { ownerId: req.user._id };

    if (category) {
      filter.category = category;
    }

    const items = await VaultItem.find(filter).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: items.length,
      data: items
    });
  } catch (error) {
    next(error);
  }
};

export const getVaultItemById = async (req, res, next) => {
  try {
    const item = await VaultItem.findById(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Vault entry not found.'
      });
    }

    // Server-side ownership verification
    if (!item.ownerId.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not own this vault entry.'
      });
    }

    res.status(200).json({
      success: true,
      data: item
    });
  } catch (error) {
    next(error);
  }
};

export const createVaultItem = async (req, res, next) => {
  try {
    const {
      category,
      encryptedTitle,
      titleIv,
      encryptedData,
      dataIv,
      encryptedKeyForOwner,
      fileMetadata,
      tags
    } = req.body;

    const item = new VaultItem({
      ownerId: req.user._id,
      category,
      encryptedTitle,
      titleIv,
      encryptedData,
      dataIv,
      encryptedKeyForOwner,
      fileMetadata: fileMetadata || undefined,
      tags: tags || []
    });

    await item.save();

    res.status(201).json({
      success: true,
      message: 'Encrypted vault entry created successfully.',
      data: item
    });
  } catch (error) {
    next(error);
  }
};

export const updateVaultItem = async (req, res, next) => {
  try {
    const item = await VaultItem.findById(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Vault entry not found.'
      });
    }

    if (!item.ownerId.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not own this vault entry.'
      });
    }

    const {
      category,
      encryptedTitle,
      titleIv,
      encryptedData,
      dataIv,
      encryptedKeyForOwner,
      fileMetadata,
      tags
    } = req.body;

    if (category) item.category = category;
    if (encryptedTitle) item.encryptedTitle = encryptedTitle;
    if (titleIv) item.titleIv = titleIv;
    if (encryptedData) item.encryptedData = encryptedData;
    if (dataIv) item.dataIv = dataIv;
    if (encryptedKeyForOwner) item.encryptedKeyForOwner = encryptedKeyForOwner;
    if (fileMetadata) item.fileMetadata = fileMetadata;
    if (tags) item.tags = tags;

    await item.save();

    res.status(200).json({
      success: true,
      message: 'Vault entry updated successfully.',
      data: item
    });
  } catch (error) {
    next(error);
  }
};

export const deleteVaultItem = async (req, res, next) => {
  try {
    const item = await VaultItem.findById(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Vault entry not found.'
      });
    }

    if (!item.ownerId.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not own this vault entry.'
      });
    }

    await VaultItem.deleteOne({ _id: item._id });

    res.status(200).json({
      success: true,
      message: 'Vault entry deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
};
