// redis.js
const redis = require('redis');
const { redisUrl } = require('./config');

const client = redis.createClient({ url: redisUrl });
client.on('error', err => console.error('Redis error:', err));
client.on('connect', () => console.log('Redis connected (helper)'));
client.connect();

module.exports = client;
