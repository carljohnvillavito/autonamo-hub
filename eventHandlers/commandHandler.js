/**
 * Command Handler
 * Dynamically loads and manages commands from the commands directory
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const COMMANDS_DIR = path.join(__dirname, '..', 'commands');

/**
 * Load all commands from the commands directory
 * @param {Function} log - Logger function
 * @returns {Map} Map of command name to command object
 */
async function loadCommands(log = console.log) {
  const commands = new Map();

  // Ensure commands directory exists
  if (!fs.existsSync(COMMANDS_DIR)) {
    fs.mkdirSync(COMMANDS_DIR, { recursive: true });
    log('info', 'Created commands directory');
  }

  // Get all .js files in commands directory
  const files = fs.readdirSync(COMMANDS_DIR).filter(file => file.endsWith('.js'));

  for (const file of files) {
    try {
      const filePath = path.join(COMMANDS_DIR, file);
      const commandName = file.replace('.js', '').toLowerCase();
      
      // Clear require cache to allow hot reloading
      delete require.cache[require.resolve(filePath)];
      
      // Load the command module
      const command = require(filePath);
      
      // Validate command structure
      if (!command.execute || typeof command.execute !== 'function') {
        log('warn', `Command ${file} is missing execute function, skipping`);
        continue;
      }

      // Add default config if not present
      if (!command.config) {
        command.config = {
          name: commandName,
          description: 'No description provided',
          usage: commandName,
          aliases: [],
          cooldown: 0,
          ownerOnly: false
        };
      } else {
        command.config.name = command.config.name || commandName;
      }

      // Register command by name
      commands.set(commandName, command);
      
      // Register aliases
      if (command.config.aliases && Array.isArray(command.config.aliases)) {
        for (const alias of command.config.aliases) {
          commands.set(alias.toLowerCase(), command);
        }
      }

      log('info', `Loaded command: ${commandName}`);
    } catch (error) {
      log('error', `Failed to load command ${file}: ${error.message}`);
    }
  }

  return commands;
}

/**
 * Validate command code before saving
 * @param {string} code - Command code to validate
 * @returns {Object} Validation result { valid: boolean, error?: string }
 */
function validateCommand(code) {
  try {
    // Try to parse the code
    new vm.Script(code);
    
    // Check for required exports
    if (!code.includes('module.exports')) {
      return { valid: false, error: 'Command must export a module' };
    }
    
    if (!code.includes('execute')) {
      return { valid: false, error: 'Command must have an execute function' };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: `Syntax error: ${error.message}` };
  }
}

/**
 * Save a command to file
 * @param {string} name - Command name
 * @param {string} code - Command code
 * @param {Function} log - Logger function
 * @returns {Object} Result { success: boolean, error?: string }
 */
function saveCommand(name, code, log = console.log) {
  // Validate command
  const validation = validateCommand(code);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Sanitize command name
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
  if (!safeName) {
    return { success: false, error: 'Invalid command name' };
  }

  const filePath = path.join(COMMANDS_DIR, `${safeName}.js`);

  try {
    fs.writeFileSync(filePath, code, 'utf8');
    log('info', `Command saved: ${safeName}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Delete a command
 * @param {string} name - Command name
 * @param {Function} log - Logger function
 * @returns {Object} Result { success: boolean, error?: string }
 */
function deleteCommand(name, log = console.log) {
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
  const filePath = path.join(COMMANDS_DIR, `${safeName}.js`);

  if (!fs.existsSync(filePath)) {
    return { success: false, error: 'Command not found' };
  }

  try {
    fs.unlinkSync(filePath);
    
    // Clear from require cache
    try {
      delete require.cache[require.resolve(filePath)];
    } catch (e) {}
    
    log('info', `Command deleted: ${safeName}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get command code
 * @param {string} name - Command name
 * @returns {Object} Result { success: boolean, content?: string, error?: string }
 */
function getCommandCode(name) {
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
  const filePath = path.join(COMMANDS_DIR, `${safeName}.js`);

  if (!fs.existsSync(filePath)) {
    return { success: false, error: 'Command not found' };
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return { success: true, content };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * List all commands
 * @returns {Array} List of command names
 */
function listCommands() {
  if (!fs.existsSync(COMMANDS_DIR)) {
    return [];
  }

  return fs.readdirSync(COMMANDS_DIR)
    .filter(file => file.endsWith('.js'))
    .map(file => file.replace('.js', ''));
}

/**
 * Generate command template
 * @param {string} name - Command name
 * @param {string} description - Command description
 * @returns {string} Command template code
 */
function generateCommandTemplate(name, description = 'A custom command') {
  return `/**
 * ${name} Command
 * ${description}
 */

module.exports = {
  config: {
    name: '${name}',
    description: '${description}',
    usage: '${name} [args]',
    aliases: [],
    cooldown: 3, // seconds
    ownerOnly: false
  },

  /**
   * Execute the command
   * @param {Object} ctx - Command context
   * @param {Object} ctx.api - FCA API instance
   * @param {Object} ctx.event - Message event
   * @param {Array} ctx.args - Command arguments
   * @param {Function} ctx.send - Send message to thread
   * @param {Function} ctx.reply - Reply to message
   * @param {Function} ctx.react - React to message
   */
  async execute(ctx) {
    const { args, reply } = ctx;
    
    // Your command logic here
    reply('Hello! This is the ${name} command.');
  }
};
`;
}

module.exports = {
  loadCommands,
  validateCommand,
  saveCommand,
  deleteCommand,
  getCommandCode,
  listCommands,
  generateCommandTemplate,
  COMMANDS_DIR
};
