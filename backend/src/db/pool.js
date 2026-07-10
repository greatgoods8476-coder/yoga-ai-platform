const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ||
    'postgres://yoga_app:yoga_dev_pw@localhost:5432/yoga_ai_platform',
});

module.exports = pool;
