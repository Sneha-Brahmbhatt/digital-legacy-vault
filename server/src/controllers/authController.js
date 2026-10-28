import User from '../models/User.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/tokenUtils.js';

export const register = async (req, res, next) => {
  try {
    const { 
      name, 
      email, 
      password, 
      role, 
      publicKey, 
      encryptedPrivateKey, 
      privateKeyIv, 
      privateKeySalt,
      gracePeriodHours 
    } = req.body;

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.'
      });
    }

    const passwordHash = await User.hashPassword(password);

    const user = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      role: role || 'owner',
      publicKey: publicKey || null,
      encryptedPrivateKey: encryptedPrivateKey || null,
      privateKeyIv: privateKeyIv || null,
      privateKeySalt: privateKeySalt || null,
      gracePeriodHours: gracePeriodHours || 48
    });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshTokens.push({ token: refreshToken });
    await user.save();

    res.status(201).json({
      success: true,
      message: 'Account registered successfully.',
      data: {
        user: user.toSafeObject(),
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    
    // Constant-time style generic failure to prevent account enumeration
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Keep up to 10 active sessions
    if (user.refreshTokens.length >= 10) {
      user.refreshTokens.shift();
    }
    user.refreshTokens.push({ token: refreshToken });
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Authentication successful.',
      data: {
        user: user.toSafeObject(),
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    next(error);
  }
};

export const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required.'
      });
    }

    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token expired or invalid.'
      });
    }

    const user = await User.findOne({
      _id: decoded.sub,
      'refreshTokens.token': refreshToken
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Session has been invalidated or does not exist.'
      });
    }

    const newAccessToken = generateAccessToken(user);

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully.',
      data: {
        accessToken: newAccessToken
      }
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken && req.user) {
      await User.updateOne(
        { _id: req.user._id },
        { $pull: { refreshTokens: { token: refreshToken } } }
      );
    }

    res.status(200).json({
      success: true,
      message: 'Logged out successfully.'
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        user: req.user.toSafeObject()
      }
    });
  } catch (error) {
    next(error);
  }
};

export const updateGracePeriod = async (req, res, next) => {
  try {
    const { gracePeriodHours } = req.body;
    const hours = parseInt(gracePeriodHours, 10);

    if (isNaN(hours) || hours < 1 || hours > 720) {
      return res.status(400).json({
        success: false,
        message: 'Grace period must be a valid number of hours between 1 and 720.'
      });
    }

    req.user.gracePeriodHours = hours;
    await req.user.save();

    res.status(200).json({
      success: true,
      message: 'Grace period updated successfully.',
      data: {
        gracePeriodHours: req.user.gracePeriodHours
      }
    });
  } catch (error) {
    next(error);
  }
};
