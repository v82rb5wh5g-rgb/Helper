// config.js
const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  token: process.env.HELPER_TOKEN,
  clientId: process.env.HELPER_CLIENT_ID || "1517368811609788488",
  devId: process.env.DEV_ID || "1303357369622990889",
  mongoUri: process.env.MONGO_URI
};
