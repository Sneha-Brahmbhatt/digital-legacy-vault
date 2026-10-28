import { VAULT_CATEGORIES } from '../config/constants.js';

export const validateVaultItem = (req, res, next) => {
  const { category, encryptedTitle, titleIv, encryptedData, dataIv, encryptedKeyForOwner } = req.body;
  const errors = [];

  if (!category || !Object.values(VAULT_CATEGORIES).includes(category)) {
    errors.push(`Category must be one of: ${Object.values(VAULT_CATEGORIES).join(', ')}.`);
  }

  if (!encryptedTitle || typeof encryptedTitle !== 'string') {
    errors.push('Encrypted title ciphertext is required.');
  }

  if (!titleIv || typeof titleIv !== 'string') {
    errors.push('Title IV is required.');
  }

  if (!encryptedData || typeof encryptedData !== 'string') {
    errors.push('Encrypted payload ciphertext is required.');
  }

  if (!dataIv || typeof dataIv !== 'string') {
    errors.push('Data IV is required.');
  }

  if (!encryptedKeyForOwner || typeof encryptedKeyForOwner !== 'string') {
    errors.push('Owner wrapped key envelope is required.');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Vault item validation failed.',
      errors
    });
  }

  next();
};
