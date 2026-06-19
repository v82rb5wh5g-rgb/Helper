// events/messageCreate.js – Helper bot dev commands (prefix $)
const { Events, EmbedBuilder } = require("discord.js");
const { devId } = require("../config");

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

    if (userId !== devId) {
      return message.reply("❌ You are not authorized to use this bot.");
    }

    // ---- ECONOMY ----
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
      await redis.decrby(`eco:${target.id}:money`, amount);
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

    // ---- SHIELDS ----
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
      await redis.decrby(`eco:${target.id}:shield`, amount);
      const shields = await redis.get(`eco:${target.id}:shield`) || 0;
      return message.reply(`✅ Removed **${amount}** shields. Remaining: **${shields}**`);
    }

    // ---- PREMIUM ----
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

    // ---- BETA TESTER ----
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

    // ---- BLACKLIST ----
    if (cmd === "devblacklist") {
      const action = args[0]?.toLowerCase();
      const targetType = args[1]?.toLowerCase();
      const targetId = args[2];
      const reason = args.slice(3).find(a => !a.match(/^(\d+)(d|h|m)$/)) || "No reason provided.";
      const duration = args.slice(3).find(a => a.match(/^(\d+)(d|h|m)$/)) || "perm";

      if (!action || !targetType || !targetId) {
        return message.reply("❌ Usage: `$devblacklist add user <userId> [reason] [duration]`\n`$devblacklist remove user <userId>`\n`$devblacklist list`");
      }

      if (action === "add") {
        const seconds = durationToSeconds(duration);
        if (seconds === 0 && duration !== "perm") return message.reply("❌ Invalid duration.");
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
        return message.reply(`✅ Blacklisted **${targetType}** \`${targetId}\` until ${duration}. Reason: ${reason}`);
      } else if (action === "remove") {
        const key = `blacklist:${targetType}:${targetId}`;
        await redis.del(key);
        return message.reply(`✅ Removed **${targetType}** \`${targetId}\` from blacklist.`);
      } else if (action === "list") {
        const keys = await redis.keys(`blacklist:*`);
        if (keys.length === 0) return message.reply("📭 No blacklisted entries.");
        const list = [];
        for (const key of keys) {
          const data = JSON.parse(await redis.get(key));
          const [prefix, type, id] = key.split(':');
          const expires = data.expiresAt ? `<t:${Math.floor(data.expiresAt / 1000)}:R>` : 'Permanent';
          list.push(`**${type}** \`${id}\` — Expires: ${expires} — Reason: ${data.reason || 'None'}`);
        }
        return message.reply(list.join("\n"));
      } else {
        return message.reply("❌ Invalid action. Use `add`, `remove`, or `list`.");
      }
    }

    // ---- COUNTING SETUP ----
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

    // ---- HELP ----
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
            "`$devblacklist add user <id> [reason] [duration]`",
            "`$devblacklist remove user <id>`",
            "`$devblacklist list`"
          ].join("\n"), inline: false },
          { name: "🎯 Counting", value: [
            "`$setcountingchannel #channel`",
            "`$resetcounting`"
          ].join("\n"), inline: false }
        )
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    // ---- TESTING ----
    if (cmd === "devv") {
      const sub = args[0];
      if (sub === "xp") {
        await redis.hSet(`profile:${userId}`, "xp", 0);
        await redis.hSet(`profile:${userId}`, "level", 3);
        return message.reply("XP reset for testing.");
      }
      if (sub === "coins") {
        await redis.set(`eco:${userId}:money`, 10000);
        return message.reply("Coins set to 10,000.");
      }
      return message.reply("Usage: $devv xp | coins");
    }

    return message.reply("❌ Unknown command. Use `$helpdev` for a list.");
  }
};
