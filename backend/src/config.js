module.exports = {
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-in-production',
  port: process.env.PORT || 4000,
};
