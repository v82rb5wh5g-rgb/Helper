// utils/status.js – Redis-based status updater (with robust logging)
const { EmbedBuilder } = require("discord.js");

async function updateStatusChannel(guildId, client, redis) {
  try {
    console.log(`[Status] Updating guild ${guildId}...`);
    const channelId = await redis.get(`status:channel:${guildId}`);
    if (!channelId) {
      console.log(`[Status] No channel set for ${guildId}`);
      return;
    }

    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      await redis.del(`status:channel:${guildId}`);
      await redis.del(`status:baseName:${guildId}`);
      console.log(`[Status] Guild ${guildId} not found, cleaned up.`);
      return;
    }

    const channel = guild.channels.cache.get(channelId);
    if (!channel) {
      await redis.del(`status:channel:${guildId}`);
      await redis.del(`status:baseName:${guildId}`);
      console.log(`[Status] Channel ${channelId} not found, cleaned up.`);
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

    const baseName = await redis.get(`status:baseName:${guildId}`) || "Bot Status";

    if (channel.type === 2) { // Voice channel
      const newName = `${baseName} • ${statusText}`;
      if (channel.name !== newName) {
        await channel.setName(newName).catch((e) => console.error(`[Status] Failed to rename voice: ${e.message}`));
        console.log(`[Status] Renamed voice channel to "${newName}"`);
      } else {
        console.log(`[Status] Voice channel already up-to-date`);
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
        console.log(`[Status] Updated text embed`);
      } else {
        await channel.send({ embeds: [embed] });
        console.log(`[Status] Sent new text embed`);
      }
    }
  } catch (error) {
    console.error(`[Status] Error updating status for guild ${guildId}:`, error);
  }
}

function startStatusUpdater(client, redis) {
  // Run immediately once
  console.log('[Status] Starting updater...');
  setInterval(async () => {
    try {
      const keys = await redis.keys('status:channel:*');
      console.log(`[Status] Found ${keys.length} status channels.`);
      for (const key of keys) {
        const guildId = key.split(':')[2];
        await updateStatusChannel(guildId, client, redis);
      }
    } catch (error) {
      console.error('[Status] Updater error:', error);
    }
  }, 30000); // every 30 seconds
}

async function forceStatusUpdate(guildId, client, redis) {
  await updateStatusChannel(guildId, client, redis);
}

module.exports = { updateStatusChannel, startStatusUpdater, forceStatusUpdate };
