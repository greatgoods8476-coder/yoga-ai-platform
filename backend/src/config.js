if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production — refusing to start with the dev default.');
}

module.exports = {
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-in-production',
  port: process.env.PORT || 4000,
};
