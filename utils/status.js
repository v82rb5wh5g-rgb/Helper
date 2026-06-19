// utils/status.js – Manages status channel updates
const { EmbedBuilder } = require("discord.js");

async function updateStatusChannel(guildId, client, redis) {
  const channelId = await redis.get(`status:channel:${guildId}`);
  if (!channelId) return;

  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;

  const channel = guild.channels.cache.get(channelId);
  if (!channel) {
    await redis.del(`status:channel:${guildId}`);
    await redis.del(`status:baseName:${guildId}`);
    return;
  }

  const maintenance = await redis.get(`maintenance:${guildId}`);
  const isMaintenance = maintenance === "true";

  const heartbeat = await redis.get('bot:heartbeat');
  const isOnline = heartbeat && (Date.now() - Number(heartbeat) < 120000);

  let statusText, statusColor;
  if (isMaintenance) {
    statusText = "🔧 Under Maintenance";
    statusColor = "#F1C40F";
  } else if (isOnline) {
    statusText = "🟢 Online";
    statusColor = "#57F287";
  } else {
    statusText = "🔴 Offline";
    statusColor = "#ED4245";
  }

  if (channel.type === 2) { // Voice channel
    const baseName = await redis.get(`status:baseName:${guildId}`) || "Bot Status";
    const newName = `${baseName} • ${statusText}`;
    if (channel.name !== newName) {
      await channel.setName(newName).catch(() => {});
    }
  } else if (channel.type === 0) { // Text channel
    const embed = new EmbedBuilder()
      .setColor(statusColor)
      .setTitle("🤖 Bot Status")
      .setDescription(`The main bot is currently **${statusText}**.`)
      .setTimestamp();

    const messages = await channel.messages.fetch({ limit: 10 });
    const statusMsg = messages.find(msg => msg.author.id === client.user.id && msg.embeds.length && msg.embeds[0].title === "🤖 Bot Status");
    if (statusMsg) {
      await statusMsg.edit({ embeds: [embed] });
    } else {
      await channel.send({ embeds: [embed] });
    }
  }
}

function startStatusUpdater(client, redis) {
  setInterval(async () => {
    const keys = await redis.keys('status:channel:*');
    for (const key of keys) {
      const guildId = key.split(':')[2];
      await updateStatusChannel(guildId, client, redis);
    }
  }, 30000);
}

module.exports = { updateStatusChannel, startStatusUpdater };
