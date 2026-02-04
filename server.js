const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(express.json());

// Store active sessions and logs
const sessions = new Map();
const logs = [];
const MAX_LOGS = 1000;

// Bot configuration
const config = {
  prefix: '!',
  ownerIds: [],
  botName: 'autonamo-hub'
};

// Logger utility
function log(level, message, sessionId = null) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    id: Date.now(),
    timestamp,
    level,
    message,
    sessionId
  };
  logs.push(logEntry);
  if (logs.length > MAX_LOGS) {
    logs.shift();
  }
  io.emit('log', logEntry);
  console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
}

// Command handler
const commandHandler = require('./eventHandlers/commandHandler');
const { loadCommands } = commandHandler;

// Load commands on startup
let commands = new Map();
(async () => {
  commands = await loadCommands(log);
  log('info', `Loaded ${commands.size} commands`);
})();

// Socket.IO connection handling
io.on('connection', (socket) => {
  log('info', `Client connected: ${socket.id}`);
  
  // Send initial data
  socket.emit('init', {
    sessions: Array.from(sessions.entries()).map(([id, session]) => ({
      id,
      name: session.name,
      status: session.status,
      ownerId: session.ownerId,
      proxy: session.proxy,
      createdAt: session.createdAt
    })),
    logs: logs.slice(-100),
    config,
    commands: Array.from(commands.keys())
  });

  // Add new session via cookie
  socket.on('addSession', async (data) => {
    try {
      const { name, appState, ownerId, proxy } = data;
      const sessionId = `session_${Date.now()}`;
      
      const session = {
        id: sessionId,
        name: name || `Session ${sessions.size + 1}`,
        appState: typeof appState === 'string' ? JSON.parse(appState) : appState,
        ownerId,
        proxy: proxy || null,
        status: 'connecting',
        createdAt: new Date().toISOString(),
        api: null
      };
      
      sessions.set(sessionId, session);
      log('info', `Session created: ${session.name}`, sessionId);
      
      // Initialize FCA connection
      await initializeBot(sessionId);
      
      socket.emit('sessionAdded', { id: sessionId, ...session, appState: undefined });
      io.emit('sessionsUpdated', getSessionsList());
    } catch (error) {
      log('error', `Failed to add session: ${error.message}`);
      socket.emit('error', { message: error.message });
    }
  });

  // Add session via login credentials
  socket.on('loginSession', async (data) => {
    try {
      const { email, password, ownerId, proxy } = data;
      const sessionId = `session_${Date.now()}`;
      
      const session = {
        id: sessionId,
        name: email.split('@')[0],
        email,
        password,
        ownerId,
        proxy: proxy || null,
        status: 'logging_in',
        createdAt: new Date().toISOString(),
        api: null
      };
      
      sessions.set(sessionId, session);
      log('info', `Login session initiated: ${session.name}`, sessionId);
      
      // Initialize FCA connection with credentials
      await initializeBotWithCredentials(sessionId);
      
      socket.emit('sessionAdded', { id: sessionId, name: session.name, status: session.status });
      io.emit('sessionsUpdated', getSessionsList());
    } catch (error) {
      log('error', `Failed to login: ${error.message}`);
      socket.emit('error', { message: error.message });
    }
  });

  // Update session
  socket.on('updateSession', async (data) => {
    const { sessionId, updates } = data;
    const session = sessions.get(sessionId);
    if (session) {
      Object.assign(session, updates);
      log('info', `Session updated: ${session.name}`, sessionId);
      io.emit('sessionsUpdated', getSessionsList());
    }
  });

  // Delete session
  socket.on('deleteSession', async (sessionId) => {
    const session = sessions.get(sessionId);
    if (session) {
      if (session.api) {
        // Logout if possible
        try {
          session.status = 'offline';
        } catch (e) {}
      }
      sessions.delete(sessionId);
      log('info', `Session deleted: ${session.name}`, sessionId);
      io.emit('sessionsUpdated', getSessionsList());
    }
  });

  // Update config
  socket.on('updateConfig', (newConfig) => {
    Object.assign(config, newConfig);
    log('info', 'Configuration updated');
    io.emit('configUpdated', config);
  });

  // Reload commands
  socket.on('reloadCommands', async () => {
    commands = await loadCommands(log);
    log('info', `Reloaded ${commands.size} commands`);
    io.emit('commandsUpdated', Array.from(commands.keys()));
  });

  // Get command content
  socket.on('getCommand', (commandName, callback) => {
    const commandsPath = path.join(__dirname, 'commands', `${commandName}.js`);
    if (fs.existsSync(commandsPath)) {
      const content = fs.readFileSync(commandsPath, 'utf8');
      callback({ success: true, content });
    } else {
      callback({ success: false, error: 'Command not found' });
    }
  });

  // Save command
  socket.on('saveCommand', async (data, callback) => {
    const { name, content } = data;
    const commandsPath = path.join(__dirname, 'commands', `${name}.js`);
    try {
      fs.writeFileSync(commandsPath, content, 'utf8');
      commands = await loadCommands(log);
      log('info', `Command saved: ${name}`);
      io.emit('commandsUpdated', Array.from(commands.keys()));
      callback({ success: true });
    } catch (error) {
      callback({ success: false, error: error.message });
    }
  });

  // Delete command
  socket.on('deleteCommand', async (commandName, callback) => {
    const commandsPath = path.join(__dirname, 'commands', `${commandName}.js`);
    try {
      if (fs.existsSync(commandsPath)) {
        fs.unlinkSync(commandsPath);
        commands = await loadCommands(log);
        log('info', `Command deleted: ${commandName}`);
        io.emit('commandsUpdated', Array.from(commands.keys()));
        callback({ success: true });
      } else {
        callback({ success: false, error: 'Command not found' });
      }
    } catch (error) {
      callback({ success: false, error: error.message });
    }
  });

  socket.on('disconnect', () => {
    log('info', `Client disconnected: ${socket.id}`);
  });
});

// Get sessions list (without sensitive data)
function getSessionsList() {
  return Array.from(sessions.entries()).map(([id, session]) => ({
    id,
    name: session.name,
    status: session.status,
    ownerId: session.ownerId,
    proxy: session.proxy,
    createdAt: session.createdAt
  }));
}

// Initialize bot with appState
async function initializeBot(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return;

  try {
    // Dynamic import for FCA - user needs to install their preferred fca package
    let login;
    try {
      login = require('@dongdev/fca-unofficial');
    } catch {
      try {
        login = require('fca-unofficial');
      } catch {
        log('warn', 'No FCA package found. Install @dongdev/fca-unofficial or fca-unofficial', sessionId);
        session.status = 'no_fca';
        return;
      }
    }

    const options = {};
    if (session.proxy) {
      options.proxy = session.proxy;
    }

    login({ appState: session.appState }, options, (err, api) => {
      if (err) {
        log('error', `Login failed: ${err.error || err.message}`, sessionId);
        session.status = 'error';
        io.emit('sessionsUpdated', getSessionsList());
        return;
      }

      session.api = api;
      session.status = 'online';
      log('success', `Bot online: ${session.name}`, sessionId);
      io.emit('sessionsUpdated', getSessionsList());

      // Welcome owner
      const welcomeOwner = require('./eventHandlers/welcomeOwner');
      welcomeOwner(api, session, log);

      // Set up message listener
      api.setOptions({ listenEvents: true });
      api.listenMqtt((err, event) => {
        if (err) {
          log('error', `Listen error: ${err.message}`, sessionId);
          return;
        }
        handleEvent(sessionId, event);
      });
    });
  } catch (error) {
    log('error', `Bot initialization failed: ${error.message}`, sessionId);
    session.status = 'error';
  }
}

// Initialize bot with credentials
async function initializeBotWithCredentials(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return;

  try {
    let login;
    try {
      login = require('@dongdev/fca-unofficial');
    } catch {
      try {
        login = require('fca-unofficial');
      } catch {
        log('warn', 'No FCA package found. Install @dongdev/fca-unofficial or fca-unofficial', sessionId);
        session.status = 'no_fca';
        return;
      }
    }

    const options = {};
    if (session.proxy) {
      options.proxy = session.proxy;
    }

    login({ email: session.email, password: session.password }, options, (err, api) => {
      if (err) {
        log('error', `Login failed: ${err.error || err.message}`, sessionId);
        session.status = 'error';
        io.emit('sessionsUpdated', getSessionsList());
        return;
      }

      // Save appState for future use
      session.appState = api.getAppState();
      session.api = api;
      session.status = 'online';
      
      // Clear credentials from memory
      delete session.email;
      delete session.password;

      log('success', `Bot online via login: ${session.name}`, sessionId);
      io.emit('sessionsUpdated', getSessionsList());

      // Welcome owner
      const welcomeOwner = require('./eventHandlers/welcomeOwner');
      welcomeOwner(api, session, log);

      // Set up message listener
      api.setOptions({ listenEvents: true });
      api.listenMqtt((err, event) => {
        if (err) {
          log('error', `Listen error: ${err.message}`, sessionId);
          return;
        }
        handleEvent(sessionId, event);
      });
    });
  } catch (error) {
    log('error', `Bot login failed: ${error.message}`, sessionId);
    session.status = 'error';
  }
}

// Handle incoming events
function handleEvent(sessionId, event) {
  const session = sessions.get(sessionId);
  if (!session || !session.api) return;

  const messageHandler = require('./eventHandlers/messageHandler');
  messageHandler(session.api, event, { session, config, commands, log });
}

// API Routes
app.get('/api/sessions', (req, res) => {
  res.json(getSessionsList());
});

app.get('/api/logs', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  res.json(logs.slice(-limit));
});

app.get('/api/commands', (req, res) => {
  res.json(Array.from(commands.keys()));
});

app.get('/api/config', (req, res) => {
  res.json(config);
});

// Start server
const PORT = process.env.BOT_PORT || 3001;
server.listen(PORT, () => {
  log('info', `Autonamo-Hub server running on port ${PORT}`);
});

module.exports = { io, log };
