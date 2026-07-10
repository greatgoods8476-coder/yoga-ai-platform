require('dotenv').config();
const createApp = require('./app');
const { port } = require('./config');

const app = createApp();
app.listen(port, () => console.log(`yoga-ai-backend listening on :${port}`));
