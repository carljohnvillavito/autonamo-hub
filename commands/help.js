/**
 * Help Command
 * Shows available commands and their descriptions
 */

module.exports = {
  config: {
    name: 'help',
    description: 'Shows all available commands or info about a specific command',
    usage: 'help [command]',
    aliases: ['h', 'commands', 'cmds'],
    cooldown: 3,
    ownerOnly: false
  },

  async execute(ctx) {
    const { args, reply, commands, config } = ctx;

    if (args.length > 0) {
      // Show specific command info
      const commandName = args[0].toLowerCase();
      const command = commands.get(commandName);

      if (!command) {
        return reply(`Command "${commandName}" not found. Use ${config.prefix}help to see all commands.`);
      }

      const cmdConfig = command.config;
      const helpText = `
━━━━━━━━━━━━━━━━━━━━━━
  📖 Command: ${cmdConfig.name}
━━━━━━━━━━━━━━━━━━━━━━

📝 Description:
${cmdConfig.description}

📌 Usage:
${config.prefix}${cmdConfig.usage}

🔄 Aliases:
${cmdConfig.aliases.length > 0 ? cmdConfig.aliases.join(', ') : 'None'}

⏱️ Cooldown: ${cmdConfig.cooldown || 0}s
🔒 Owner Only: ${cmdConfig.ownerOnly ? 'Yes' : 'No'}

━━━━━━━━━━━━━━━━━━━━━━
`.trim();

      return reply(helpText);
    }

    // Show all commands
    const uniqueCommands = new Map();
    for (const [name, cmd] of commands) {
      if (!uniqueCommands.has(cmd.config.name)) {
        uniqueCommands.set(cmd.config.name, cmd);
      }
    }

    const commandList = Array.from(uniqueCommands.values())
      .map(cmd => `• ${config.prefix}${cmd.config.name} - ${cmd.config.description}`)
      .join('\n');

    const helpText = `
━━━━━━━━━━━━━━━━━━━━━━
  📚 AUTONAMO-HUB COMMANDS
━━━━━━━━━━━━━━━━━━━━━━

${commandList}

━━━━━━━━━━━━━━━━━━━━━━
📌 Use ${config.prefix}help [command] for details
Total Commands: ${uniqueCommands.size}
━━━━━━━━━━━━━━━━━━━━━━
`.trim();

    reply(helpText);
  }
};
