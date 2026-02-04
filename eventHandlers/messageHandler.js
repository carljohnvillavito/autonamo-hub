/**
 * Message Handler
 * Processes incoming messages and routes them to appropriate commands
 */

async function messageHandler(api, event, context) {
  const { session, config, commands, log } = context;

  // Only handle message events
  if (event.type !== 'message' && event.type !== 'message_reply') {
    return;
  }

  const message = event.body || '';
  const senderId = event.senderID;
  const threadId = event.threadID;
  const messageId = event.messageID;

  // Skip if message is from the bot itself
  if (senderId === api.getCurrentUserID()) {
    return;
  }

  // Log incoming message
  log('info', `Message from ${senderId}: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`, session.id);

  // Check if message starts with prefix
  if (!message.startsWith(config.prefix)) {
    return;
  }

  // Parse command and arguments
  const args = message.slice(config.prefix.length).trim().split(/\s+/);
  const commandName = args.shift().toLowerCase();

  // Check if command exists
  if (!commands.has(commandName)) {
    log('warn', `Unknown command: ${commandName}`, session.id);
    return;
  }

  const command = commands.get(commandName);

  // Create context object for command execution
  const commandContext = {
    api,
    event,
    args,
    message,
    senderId,
    threadId,
    messageId,
    session,
    config,
    commands,
    log,
    // Helper functions
    send: (msg, callback) => {
      api.sendMessage(msg, threadId, callback);
    },
    reply: (msg, callback) => {
      api.sendMessage(msg, threadId, callback, messageId);
    },
    react: (emoji, callback) => {
      api.setMessageReaction(emoji, messageId, callback);
    },
    getUserInfo: (userId) => {
      return new Promise((resolve, reject) => {
        api.getUserInfo(userId, (err, info) => {
          if (err) reject(err);
          else resolve(info);
        });
      });
    },
    getThreadInfo: () => {
      return new Promise((resolve, reject) => {
        api.getThreadInfo(threadId, (err, info) => {
          if (err) reject(err);
          else resolve(info);
        });
      });
    }
  };

  // Execute command
  try {
    log('info', `Executing command: ${commandName}`, session.id);
    
    // Check if owner-only command
    if (command.config?.ownerOnly && senderId !== session.ownerId && !config.ownerIds.includes(senderId)) {
      commandContext.reply('This command is restricted to bot owners only.');
      return;
    }

    // Check cooldown
    if (command.config?.cooldown) {
      const cooldownKey = `${commandName}_${senderId}`;
      const now = Date.now();
      const cooldowns = command._cooldowns || (command._cooldowns = new Map());
      const lastUsed = cooldowns.get(cooldownKey) || 0;
      
      if (now - lastUsed < command.config.cooldown * 1000) {
        const remaining = Math.ceil((command.config.cooldown * 1000 - (now - lastUsed)) / 1000);
        commandContext.reply(`Please wait ${remaining} seconds before using this command again.`);
        return;
      }
      
      cooldowns.set(cooldownKey, now);
    }

    // Execute the command
    await command.execute(commandContext);
    
    log('success', `Command executed: ${commandName}`, session.id);
  } catch (error) {
    log('error', `Command error (${commandName}): ${error.message}`, session.id);
    commandContext.reply(`Error executing command: ${error.message}`);
  }
}

module.exports = messageHandler;
