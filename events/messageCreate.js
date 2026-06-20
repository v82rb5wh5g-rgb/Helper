// events/messageCreate.js – Helper bot (full)
const { Events, EmbedBuilder } = require("discord.js");
const { devId } = require("../config");
const { buildBlacklistEmbed } = require("../blacklist.js"); // only for embed builder

function durationToSeconds(input) {
  if (input === "perm") return -1;
  const match = input.match(/(\d+)(d|h|m)/);
  if (!match) return 0;
  const value = parseInt(match[1]);
  const type = match[2];
  if (type === "d") return value * 86400;
  if (type === "h") return value * 3600;
  if (type === "m") return value * 60;
  return 0;
}

module.exports = {
  name: Events.MessageCreate,
  async execute(message, client, redis) {
    if (message.author.bot || !message.guild) return;
    if (!message.content.startsWith("$")) return;

    const userId = message.author.id;
    const guildId = message.guild.id;
    const args = message.content.slice(1).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();

    // Only the developer can use these commands
    if (userId !== devId) {
      return message.reply("❌ You are not authorized to use this bot.");
    }

    // ---- BLACKLIST MANAGEMENT ----
    if (cmd === "blacklist" || cmd === "devblacklist") {
      const action = args[0]?.toLowerCase(); // add, remove, list
      const targetType = args[1]?.toLowerCase(); // 'user' or 'guild'
      const targetId = args[2];
      // Reason is everything after the duration (if any)
      const durationArg = args.slice(3).find(a => a.match(/^(\d+)(d|h|m)$/));
      const reason = args.slice(3).filter(a => !a.match(/^(\d+)(d|h|m)$/)).join(' ') || "No reason provided.";
      const duration = durationArg || "perm";

      if (!action || !targetType || !targetId) {
        return message.reply(
          "❌ Usage:\n" +
          "`$blacklist add user <userId> [reason] [duration]`\n" +
          "`$blacklist remove user <userId>`\n" +
          "`$blacklist list`\n" +
          "Duration: `5m`, `2h`, `7d`, `perm` (default: perm)"
        );
      }

      if (!['user', 'guild'].includes(targetType)) {
        return message.reply("❌ Type must be `user` or `guild`.");
      }

      // ---- ADD ----
      if (action === "add") {
        const seconds = durationToSeconds(duration);
        if (seconds === 0 && duration !== "perm") {
          return message.reply("❌ Invalid duration. Use `5m`, `2h`, `7d`, or `perm`.");
        }

        const key = `blacklist:${targetType}:${targetId}`;
        const data = {
          reason: reason,
          createdAt: Date.now()
        };
        if (seconds !== -1) {
          data.expiresAt = Date.now() + seconds * 1000;
        }

        await redis.set(key, JSON.stringify(data));
        if (seconds !== -1) {
          await redis.expire(key, seconds); // set TTL so Redis auto‑cleans
        }

        return message.reply(
          `✅ Blacklisted **${targetType}** \`${targetId}\` until ${duration}.\n` +
          `Reason: ${reason}`
        );
      }

      // ---- REMOVE ----
      if (action === "remove") {
        const key = `blacklist:${targetType}:${targetId}`;
        const exists = await redis.get(key);
        if (!exists) return message.reply(`❌ No blacklist entry found for ${targetType} ${targetId}.`);
        await redis.del(key);
        return message.reply(`✅ Removed blacklist for **${targetType}** \`${targetId}\`.`);
      }

      // ---- LIST ----
      if (action === "list") {
        const keys = await redis.keys(`blacklist:*`);
        if (keys.length === 0) return message.reply("📭 No blacklisted entries.");
        const list = [];
        for (const key of keys) {
          const raw = await redis.get(key);
          const data = JSON.parse(raw);
          const parts = key.split(':');
          const type = parts[1];
          const id = parts[2];
          const expires = data.expiresAt ? `<t:${Math.floor(data.expiresAt / 1000)}:R>` : 'Permanent';
          list.push(`**${type}** \`${id}\` — Expires: ${expires} — Reason: ${data.reason || 'None'}`);
        }
        return message.reply(list.join("\n"));
      }

      return message.reply("❌ Invalid action. Use `add`, `remove`, or `list`.");
    }

    // ---- DEBUG: Check if a user is blacklisted ----
    if (cmd === "checkblacklist") {
      const target = message.mentions.users.first();
      if (!target) return message.reply("❌ Mention a user to check.");
      const key = `blacklist:user:${target.id}`;
      const data = await redis.get(key);
      if (!data) return message.reply(`✅ User **${target.username}** is NOT blacklisted.`);
      const parsed = JSON.parse(data);
      return message.reply(
        `🔴 User **${target.username}** IS blacklisted.\n` +
        `Reason: ${parsed.reason}\n` +
        `Expires: ${parsed.expiresAt ? new Date(parsed.expiresAt).toLocaleString() : 'Permanent'}`
      );
    }

    // ---- Other dev commands (economy, premium, etc.) ----
    // ... (keep your existing commands)

    return message.reply("❌ Unknown command. Use `$helpdev` for a list.");
  }
};
