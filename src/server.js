require('dotenv').config();
const createApp = require('./app');

const app = createApp();
const port = Number(process.env.PORT || 3000);

app.listen(port, '0.0.0.0', () => {
  console.log(`Team Task & Project Tracker running at http://localhost:${port}`);
});