// index.js – Helper Bot (MongoDB)
const { Client, GatewayIntentBits, Partials } = require("discord.js");
const { token } = require("./config");
const db = require("./database");            // MongoDB wrapper (same as main bot)
const connectDB = require("./mongoose");      // MongoDB connection
const { startStatusUpdater } = require("./utils/status");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
  ]
});

// Load events – pass db instead of redis
const fs = require("fs");
const path = require("path");
const eventsPath = path.join(__dirname, "events");
if (fs.existsSync(eventsPath)) {
  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith(".js"));
  for (const file of eventFiles) {
    const event = require(path.join(eventsPath, file));
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client, db));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client, db));
    }
  }
}

client.once('ready', () => {
  console.log('Helper bot ready!');
  startStatusUpdater(client, db);   // pass db to status updater as well
});

// Wait for MongoDB, then login
(async () => {
  await connectDB();
  await client.login(token);
})();
