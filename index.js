// index.js – Helper Bot
const { Client, GatewayIntentBits, Partials } = require("discord.js");
const { token } = require("./config");
const redis = require("./redis");
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

// Load events
const fs = require("fs");
const path = require("path");
const eventsPath = path.join(__dirname, "events");
if (fs.existsSync(eventsPath)) {
  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith(".js"));
  for (const file of eventFiles) {
    const event = require(path.join(eventsPath, file));
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client, redis));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client, redis));
    }
  }
}

client.once('ready', () => {
  console.log('Helper bot ready!');
  startStatusUpdater(client, redis);
});

client.login(token);
