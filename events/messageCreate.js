// events/messageCreate.js – Helper Bot (Full, Corrected)
const { Events, EmbedBuilder } = require("discord.js");
const { devId } = require("../config");
const { forceStatusUpdate } = require("../utils/status");

// Helper: convert duration string to seconds
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
    // ---- Basic checks ----
    if (message.author.bot || !message.guild) return;
    if (!message.content.startsWith("$")) return;

    const userId = message.author.id;
    const guildId = message.guild.id;
    const args = message.content.slice(1).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();

    // ---- Only the developer can use these commands ----
    if (userId !== devId) {
      return message.reply("❌ You are not authorized to use this bot.");
    }

    // ==========================================
    // 🎟️ GENERATE CODE
    // ==========================================
    if (cmd === "generatecode") {
      const code = args[0]?.toUpperCase();
      const duration = args[1];
      const uses = parseInt(args[2]);
      const type = args[3]?.toLowerCase() || 'user';
      const coinAmount = parseInt(args[4]) || 0;

      if (!code || !duration || isNaN(uses) || uses < 1) {
        return message.reply("❌ Usage: `$generatecode <code> <duration> <uses> [type] [coinAmount]`\nExample: `$generatecode TEST 1h 5 user 100`");
      }
      if (!['user', 'guild'].includes(type)) {
        return message.reply("❌ Type must be `user` or `guild`.");
      }
      const seconds = durationToSeconds(duration);
      if (seconds === 0 && duration !== "perm") {
        return message.reply("❌ Invalid duration. Use `1h`, `2d`, `30m`, or `perm`.");
      }

      const existing = await redis.get(`redeem:${code}`);
      if (existing) return message.reply(`❌ Code **${code}** already exists.`);

      const data = {
        code,
        duration,
        seconds,
        uses,
        type,
        used: 0,
        createdAt: Date.now(),
        createdBy: userId,
        giveCoins: coinAmount > 0,
        coinAmount,
        users: []
      };

      await redis.set(`redeem:${code}`, JSON.stringify(data));
      await redis.sadd(`redeem:all_codes`, code);

      const embed = new EmbedBuilder()
        .setColor("#57F287")
        .setTitle("✅ Code Generated")
        .setDescription(`Code **${code}** created.`)
        .addFields(
          { name: "Type", value: type === 'user' ? '👤 User Premium' : '🏢 Guild Premium', inline: true },
          { name: "Duration", value: duration, inline: true },
          { name: "Uses", value: `${uses}`, inline: true },
          { name: "Coins", value: coinAmount > 0 ? `${coinAmount} coins` : "None", inline: true }
        )
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    // ==========================================
    // 🧹 CLEAR STUCK GAMES (mines + blackjack)
    // ==========================================
    if (cmd === "cleargame") {
      const target = message.mentions.users.first();
      if (!target) return message.reply("❌ Usage: `$cleargame @user`");
      await redis.del(`mines:${target.id}`);
      await redis.del(`blackjack:${target.id}`);
      return message.reply(`✅ Cleared active games for **${target.username}**.`);
    }

    // ==========================================
    // 📊 STATUS CHANNEL
    // ==========================================
    if (cmd === "statuschannel") {
      const action = args[0]?.toLowerCase();
      if (action === "setup") {
        const channel = message.mentions.channels.first();
        if (!channel) return message.reply("❌ Usage: `$statuschannel setup #channel [baseName]`");
        const baseName = args.slice(2).join(' ') || "Bot Status";
        await redis.set(`status:channel:${guildId}`, channel.id);
        await redis.set(`status:baseName:${guildId}`, baseName);
        await forceStatusUpdate(guildId, client, redis);
        return message.reply(`✅ Status channel set to ${channel} with base name "${baseName}".`);
      } else if (action === "remove") {
        await redis.del(`status:channel:${guildId}`);
        await redis.del(`status:baseName:${guildId}`);
        return message.reply("✅ Status channel removed.");
      } else {
        return message.reply("❌ Usage: `$statuschannel setup #channel [baseName]` or `$statuschannel remove`");
      }
    }

    // ==========================================
    // 📨 SEND CUSTOM EMBED
    // ==========================================
    if (cmd === "sendembed") {
      const targetChannel = message.mentions.channels.first();
      if (!targetChannel) return message.reply("❌ Usage: `$sendembed #channel Title | Description | Color | Footer`\nExample: `$sendembed #announcements Hello | Welcome to the server! | #00FF88 | Thanks for joining`");

      const content = message.content.slice(cmd.length + 1).trim().replace(/<#\d+>/, '').trim();
      const parts = content.split('|').map(s => s.trim());

      const title = parts[0] || "No Title";
      const description = parts[1] || "No Description";
      let color = "#5865F2";
      if (parts[2] && parts[2].match(/^#[0-9A-F]{6}$/i)) color = parts[2];
      const footer = parts[3] || null;

      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(description);
      if (footer) embed.setFooter({ text: footer });

      try {
        await targetChannel.send({ embeds: [embed] });
        await message.reply(`✅ Embed sent to ${targetChannel}.`);
      } catch (err) {
        await message.reply(`❌ Failed to send: ${err.message}`);
      }
      return;
    }

    // ==========================================
    // 🔧 MAINTENANCE MODE
    // ==========================================
    if (cmd === "maintenance") {
      const mode = args[0]?.toLowerCase();
      if (!mode || !["on", "off"].includes(mode)) {
        return message.reply("❌ Usage: `$maintenance on` or `$maintenance off`");
      }
      const key = `maintenance:${guildId}`;
      if (mode === "on") {
        await redis.set(key, "true");
        await forceStatusUpdate(guildId, client, redis);
        return message.reply("🔧 Maintenance mode **enabled**.");
      } else {
        await redis.del(key);
        await forceStatusUpdate(guildId, client, redis);
        return message.reply("✅ Maintenance mode **disabled**.");
      }
    }

    // ==========================================
    // 🟢 STATUS (force update)
    // ==========================================
    if (cmd === "status") {
      await forceStatusUpdate(guildId, client, redis);
      return message.reply("✅ Status channel updated manually.");
    }

    // ==========================================
    // 💰 ECONOMY COMMANDS
    // ==========================================
    if (cmd === "addcoins") {
      const target = message.mentions.users.first();
      const amount = parseInt(args[1]);
      if (!target || isNaN(amount) || amount < 1)
        return message.reply("❌ Usage: `$addcoins @user amount`");
      await redis.incrby(`eco:${target.id}:money`, amount);
      const bal = await redis.get(`eco:${target.id}:money`) || 0;
      return message.reply(`✅ Added **${amount}** coins to **${target.username}**. New balance: **${bal}**`);
    }

    if (cmd === "removecoins") {
      const target = message.mentions.users.first();
      const amount = parseInt(args[1]);
      if (!target || isNaN(amount) || amount < 1)
        return message.reply("❌ Usage: `$removecoins @user amount`");
      const current = Number(await redis.get(`eco:${target.id}:money`) || 0);
      if (current < amount) return message.reply(`❌ ${target.username} only has ${current} coins.`);
      await redis.incrby(`eco:${target.id}:money`, -amount);   // ✅ negative incrby = decrby
      const bal = await redis.get(`eco:${target.id}:money`) || 0;
      return message.reply(`✅ Removed **${amount}** coins. New balance: **${bal}**`);
    }

    if (cmd === "setbalance") {
      const target = message.mentions.users.first();
      const amount = parseInt(args[1]);
      if (!target || isNaN(amount) || amount < 0)
        return message.reply("❌ Usage: `$setbalance @user amount`");
      await redis.set(`eco:${target.id}:money`, amount);
      return message.reply(`✅ Set **${target.username}**'s balance to **${amount}** coins`);
    }

    // ==========================================
    // 🛡️ SHIELDS
    // ==========================================
    if (cmd === "addshields") {
      const target = message.mentions.users.first();
      const amount = parseInt(args[1]);
      if (!target || isNaN(amount) || amount < 1)
        return message.reply("❌ Usage: `$addshields @user amount`");
      await redis.incrby(`eco:${target.id}:shield`, amount);
      const shields = await redis.get(`eco:${target.id}:shield`) || 0;
      return message.reply(`✅ Added **${amount}** shields. Total: **${shields}**`);
    }

    if (cmd === "removeshields") {
      const target = message.mentions.users.first();
      const amount = parseInt(args[1]);
      if (!target || isNaN(amount) || amount < 1)
        return message.reply("❌ Usage: `$removeshields @user amount`");
      const current = Number(await redis.get(`eco:${target.id}:shield`) || 0);
      if (current < amount) return message.reply(`❌ ${target.username} only has ${current} shields.`);
      await redis.incrby(`eco:${target.id}:shield`, -amount);   // ✅ negative incrby
      const shields = await redis.get(`eco:${target.id}:shield`) || 0;
      return message.reply(`✅ Removed **${amount}** shields. Remaining: **${shields}**`);
    }

    // ==========================================
    // 👑 PREMIUM
    // ==========================================
    if (cmd === "removepremium") {
      const target = message.mentions.users.first();
      if (!target) return message.reply("❌ Usage: `$removepremium @user`");
      await redis.del(`premium:user:${target.id}`);
      await redis.del(`eco:${target.id}:vip`);
      return message.reply(`✅ Removed user premium from **${target.username}**`);
    }

    if (cmd === "removeguildpremium") {
      await redis.del(`premium:guild:${guildId}`);
      return message.reply(`✅ Removed guild premium for this server.`);
    }

    if (cmd === "checkpremium") {
      const userKey = `premium:user:${userId}`;
      const guildKey = `premium:guild:${guildId}`;
      const userVal = await redis.get(userKey);
      const userTTL = await redis.ttl(userKey);
      const guildVal = await redis.get(guildKey);
      const guildTTL = await redis.ttl(guildKey);
      return message.reply(
        `👤 **User Premium**\nValue: ${userVal || '❌ none'}\nTTL: ${userTTL}s\n\n` +
        `🏢 **Guild Premium**\nValue: ${guildVal || '❌ none'}\nTTL: ${guildTTL}s`
      );
    }

    if (cmd === "setpremium") {
      const duration = args[0] || "1h";
      const seconds = durationToSeconds(duration);
      if (seconds === 0 && duration !== "perm") return message.reply("Invalid duration.");
      const key = `premium:user:${userId}`;
      if (duration === "perm") {
        await redis.set(key, "perm");
      } else {
        await redis.set(key, "active");
        await redis.expire(key, seconds);
      }
      return message.reply(`✅ User premium set for you (${duration}). Check /premium.`);
    }

    if (cmd === "setguildpremium") {
      const duration = args[0] || "1h";
      const seconds = durationToSeconds(duration);
      if (seconds === 0 && duration !== "perm") return message.reply("Invalid duration.");
      const key = `premium:guild:${guildId}`;
      if (duration === "perm") {
        await redis.set(key, "perm");
      } else {
        await redis.set(key, "active");
        await redis.expire(key, seconds);
      }
      return message.reply(`✅ Guild premium set for this server (${duration}).`);
    }

    // ==========================================
    // 🧪 BETA TESTER
    // ==========================================
    if (cmd === "addbetatester") {
      const target = message.mentions.users.first();
      if (!target) return message.reply("❌ Usage: `$addbetatester @user`");
      await redis.set(`beta:user:${target.id}`, "true");
      return message.reply(`✅ **${target.username}** is now a Beta Tester.`);
    }

    if (cmd === "removebetatester") {
      const target = message.mentions.users.first();
      if (!target) return message.reply("❌ Usage: `$removebetatester @user`");
      await redis.del(`beta:user:${target.id}`);
      return message.reply(`✅ Removed Beta Tester status from **${target.username}**.`);
    }

    // ==========================================
    // 🛡️ BLACKLIST MANAGEMENT
    // ==========================================
    if (cmd === "blacklist" || cmd === "devblacklist") {
      const action = args[0]?.toLowerCase();
      const targetType = args[1]?.toLowerCase();
      const targetId = args[2];
      const reason = args.slice(3).filter(a => !a.match(/^(\d+)(d|h|m)$/)).join(' ') || "No reason provided.";
      const duration = args.slice(3).find(a => a.match(/^(\d+)(d|h|m)$/)) || "perm";

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
          await redis.expire(key, seconds);
        }
        return message.reply(
          `✅ Blacklisted **${targetType}** \`${targetId}\` until ${duration}.\n` +
          `Reason: ${reason}`
        );
      } else if (action === "remove") {
        const key = `blacklist:${targetType}:${targetId}`;
        const exists = await redis.get(key);
        if (!exists) return message.reply(`❌ No blacklist entry found for ${targetType} ${targetId}.`);
        await redis.del(key);
        return message.reply(`✅ Removed blacklist for **${targetType}** \`${targetId}\`.`);
      } else if (action === "list") {
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
      } else {
        return message.reply("❌ Invalid action. Use `add`, `remove`, or `list`.");
      }
    }

    // ==========================================
    // 🎯 COUNTING SETUP
    // ==========================================
    if (cmd === "setcountingchannel") {
      const channel = message.mentions.channels.first();
      if (!channel) return message.reply("❌ Usage: `$setcountingchannel #channel`");
      await redis.set(`counting:${guildId}:channel`, channel.id);
      await redis.set(`counting:${guildId}:number`, 0);
      return message.reply(`✅ Counting channel set to ${channel}`);
    }

    if (cmd === "resetcounting") {
      const keys = await redis.keys(`counting:${guildId}:*`);
      for (const key of keys) await redis.del(key);
      await redis.set(`counting:${guildId}:number`, 0);
      return message.reply("✅ All counting stats reset.");
    }

    // ==========================================
    // ❓ HELP
    // ==========================================
    if (cmd === "helpdev") {
      const embed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle("👑 Dev Commands (Helper Bot)")
        .setDescription("All commands use `$` prefix")
        .addFields(
          { name: "💰 Economy", value: [
            "`$addcoins @user amount`",
            "`$removecoins @user amount`",
            "`$setbalance @user amount`"
          ].join("\n"), inline: false },
          { name: "🛡️ Shields", value: [
            "`$addshields @user amount`",
            "`$removeshields @user amount`"
          ].join("\n"), inline: false },
          { name: "👑 Premium", value: [
            "`$removepremium @user`",
            "`$removeguildpremium`",
            "`$checkpremium`",
            "`$setpremium 1h`",
            "`$setguildpremium 1h`"
          ].join("\n"), inline: false },
          { name: "🧪 Beta Tester", value: [
            "`$addbetatester @user`",
            "`$removebetatester @user`"
          ].join("\n"), inline: false },
          { name: "🛡️ Blacklist", value: [
            "`$blacklist add user <id> [reason] [duration]`",
            "`$blacklist remove user <id>`",
            "`$blacklist list`"
          ].join("\n"), inline: false },
          { name: "🎯 Counting", value: [
            "`$setcountingchannel #channel`",
            "`$resetcounting`"
          ].join("\n"), inline: false },
          { name: "🎟️ Redeem Codes", value: [
            "`$generatecode <code> <duration> <uses> [type] [coinAmount]`"
          ].join("\n"), inline: false },
          { name: "📊 Status Channel", value: [
            "`$statuschannel setup #channel [baseName]`",
            "`$statuschannel remove`",
            "`$status` (force update)"
          ].join("\n"), inline: false },
          { name: "🔧 Maintenance", value: [
            "`$maintenance on`",
            "`$maintenance off`"
          ].join("\n"), inline: false }
        )
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    // ==========================================
    // 🧪 TESTING / MISC
    // ==========================================
    if (cmd === "devv") {
      const sub = args[0];
      if (sub === "xp") {
        await redis.hset(`profile:${userId}`, "xp", 0);
        await redis.hset(`profile:${userId}`, "level", 3);
        return message.reply("XP reset for testing.");
      }
      if (sub === "coins") {
        await redis.set(`eco:${userId}:money`, 10000);
        return message.reply("Coins set to 10,000.");
      }
      return message.reply("Usage: $devv xp | coins");
    }

    // ==========================================
    // 🩺 HEARTBEAT DEBUG
    // ==========================================
    if (cmd === "heartbeat") {
      const heartbeat = await redis.get('bot:heartbeat');
      if (!heartbeat) return message.reply("❌ No heartbeat found.");
      const age = Date.now() - Number(heartbeat);
      const status = age < 120000 ? "🟢 Online" : "🔴 Offline";
      return message.reply(`Heartbeat: ${Math.round(age / 1000)}s ago (${status})`);
    }

    // ---- Unknown command ----
    return message.reply("❌ Unknown command. Use `$helpdev` for a list.");
  }
};
