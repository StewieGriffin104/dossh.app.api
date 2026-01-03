import jwt from "jsonwebtoken";

/**
 * Generate a JWT access token for authentication.
 *
 * @function
 * @param {Object} params - Parameters required to generate the token.
 * @param {string|number} params.customerId - Unique user identifier (customerId), used as JWT subject (sub).
 * @param {string} params.email - User email address.
 * @param {string} [params.deviceId] - Device unique identifier (optional).
 * @returns {string} JWT access token string.
 *
 * @example
 * const token = generateAccessToken({ customerId: 123, email: 'user@example.com', deviceId: 'device-001' });
 */
export const generateAccessToken = ({ customerId, email, deviceId }) => {
  const payload = {
    sub: customerId,
    email,
    deviceId,
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
};

/**
 * Generate a JWT refresh token for obtaining new access tokens.
 *
 * Refresh tokens have a longer lifespan and should be stored securely.
 * Consider storing refresh tokens in the database to enable revocation.
 *
 * @function
 * @param {Object} params - Parameters required to generate the refresh token.
 * @param {string|number} params.customerId - Unique user identifier (customerId), used as JWT subject (sub).
 * @param {string} [params.tokenId] - Unique token identifier (jti) for tracking and revocation (optional).
 * @returns {string} JWT refresh token string.
 *
 * @example
 * const refreshToken = generateRefreshToken({ customerId: 123, tokenId: 'uuid-v4-token-id' });
 */
export const generateRefreshToken = ({ customerId, tokenId }) => {
  const payload = {
    sub: customerId,
    type: "refresh",
  };

  if (tokenId) {
    payload.jti = tokenId;
  }

  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: "7d",
  });
};

/**
 * Verify and decode a JWT access token.
 *
 * @function
 * @param {string} token - JWT access token string to verify.
 * @returns {Object} Decoded token payload containing customerId, email, and deviceId.
 * @throws {Error} If token is invalid, expired, or malformed.
 *
 * @example
 * try {
 *   const decoded = verifyAccessToken(token);
 *   console.log(decoded.customerId, decoded.email, decoded.deviceId);
 * } catch (error) {
 *   console.error('Invalid token:', error.message);
 * }
 */
export const verifyAccessToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (typeof decoded === "string") {
      throw new Error("Invalid token payload");
    }

    return {
      customerId: decoded.sub,
      email: decoded.email,
      deviceId: decoded.deviceId,
      iat: decoded.iat,
      exp: decoded.exp,
    };
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw new Error("Access token has expired");
    }
    if (error.name === "JsonWebTokenError") {
      throw new Error("Invalid access token");
    }
    throw error;
  }
};

/**
 * Verify and decode a JWT refresh token.
 *
 * @function
 * @param {string} token - JWT refresh token string to verify.
 * @returns {Object} Decoded token payload containing customerId and optional tokenId.
 * @throws {Error} If token is invalid, expired, or malformed.
 *
 * @example
 * try {
 *   const decoded = verifyRefreshToken(refreshToken);
 *   console.log(decoded.customerId, decoded.tokenId);
 * } catch (error) {
 *   console.error('Invalid refresh token:', error.message);
 * }
 */
export const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);

    if (typeof decoded === "string") {
      throw new Error("Invalid token payload");
    }

    return {
      customerId: decoded.sub,
      tokenId: decoded.jti,
      type: decoded.type,
      iat: decoded.iat,
      exp: decoded.exp,
    };
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw new Error("Refresh token has expired");
    }
    if (error.name === "JsonWebTokenError") {
      throw new Error("Invalid refresh token");
    }
    throw error;
  }
};
