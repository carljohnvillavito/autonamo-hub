'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Plus,
  Trash2,
  RefreshCw,
  Settings,
  Terminal,
  Bot,
  Code,
  LogIn,
  Cookie,
  Power,
  PowerOff,
  AlertCircle,
  CheckCircle,
  Clock,
  Edit,
  Save,
  FileCode,
  Menu,
} from 'lucide-react';

interface Session {
  id: string;
  name: string;
  status: 'connecting' | 'online' | 'offline' | 'error' | 'no_fca' | 'logging_in';
  ownerId: string;
  proxy: string | null;
  createdAt: string;
}

interface LogEntry {
  id: number;
  timestamp: string;
  level: 'info' | 'success' | 'warn' | 'error';
  message: string;
  sessionId: string | null;
}

interface Config {
  prefix: string;
  ownerIds: string[];
  botName: string;
}

const BOT_SERVER_URL = process.env.NEXT_PUBLIC_BOT_SERVER_URL || 'http://localhost:3001';

export default function AutonamoHub() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [commands, setCommands] = useState<string[]>([]);
  const [config, setConfig] = useState<Config>({
    prefix: '!',
    ownerIds: [],
    botName: 'autonamo-hub',
  });

  // Dialog states
  const [addSessionOpen, setAddSessionOpen] = useState(false);
  const [loginSessionOpen, setLoginSessionOpen] = useState(false);
  const [editCommandOpen, setEditCommandOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Form states
  const [sessionForm, setSessionForm] = useState({
    name: '',
    appState: '',
    ownerId: '',
    proxy: '',
  });
  const [loginForm, setLoginForm] = useState({
    email: '',
    password: '',
    ownerId: '',
    proxy: '',
  });
  const [commandEditor, setCommandEditor] = useState({
    name: '',
    content: '',
    isNew: false,
  });
  const [configForm, setConfigForm] = useState({
    prefix: '!',
    ownerIds: '',
    botName: 'autonamo-hub',
  });

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Socket connection
  useEffect(() => {
    const newSocket = io(BOT_SERVER_URL, {
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
    });

    newSocket.on('init', (data) => {
      setSessions(data.sessions || []);
      setLogs(data.logs || []);
      setCommands(data.commands || []);
      if (data.config) {
        setConfig(data.config);
        setConfigForm({
          prefix: data.config.prefix,
          ownerIds: data.config.ownerIds.join(', '),
          botName: data.config.botName,
        });
      }
    });

    newSocket.on('log', (entry: LogEntry) => {
      setLogs((prev) => [...prev.slice(-999), entry]);
    });

    newSocket.on('sessionsUpdated', (updatedSessions: Session[]) => {
      setSessions(updatedSessions);
    });

    newSocket.on('commandsUpdated', (updatedCommands: string[]) => {
      setCommands(updatedCommands);
    });

    newSocket.on('configUpdated', (updatedConfig: Config) => {
      setConfig(updatedConfig);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Add session via cookie
  const handleAddSession = useCallback(() => {
    if (!socket || !sessionForm.appState) return;

    socket.emit('addSession', {
      name: sessionForm.name,
      appState: sessionForm.appState,
      ownerId: sessionForm.ownerId,
      proxy: sessionForm.proxy || null,
    });

    setSessionForm({ name: '', appState: '', ownerId: '', proxy: '' });
    setAddSessionOpen(false);
  }, [socket, sessionForm]);

  // Add session via login
  const handleLoginSession = useCallback(() => {
    if (!socket || !loginForm.email || !loginForm.password) return;

    socket.emit('loginSession', {
      email: loginForm.email,
      password: loginForm.password,
      ownerId: loginForm.ownerId,
      proxy: loginForm.proxy || null,
    });

    setLoginForm({ email: '', password: '', ownerId: '', proxy: '' });
    setLoginSessionOpen(false);
  }, [socket, loginForm]);

  // Delete session
  const handleDeleteSession = useCallback(
    (sessionId: string) => {
      if (!socket) return;
      socket.emit('deleteSession', sessionId);
    },
    [socket]
  );

  // Reload commands
  const handleReloadCommands = useCallback(() => {
    if (!socket) return;
    socket.emit('reloadCommands');
  }, [socket]);

  // Edit command
  const handleEditCommand = useCallback(
    (commandName: string) => {
      if (!socket) return;

      socket.emit('getCommand', commandName, (response: { success: boolean; content?: string }) => {
        if (response.success && response.content) {
          setCommandEditor({
            name: commandName,
            content: response.content,
            isNew: false,
          });
          setEditCommandOpen(true);
        }
      });
    },
    [socket]
  );

  // New command
  const handleNewCommand = useCallback(() => {
    const template = `/**
 * Custom Command
 * Description here
 */

module.exports = {
  config: {
    name: 'mycommand',
    description: 'My custom command',
    usage: 'mycommand [args]',
    aliases: [],
    cooldown: 3,
    ownerOnly: false
  },

  async execute(ctx) {
    const { args, reply } = ctx;
    reply('Hello from my command!');
  }
};`;

    setCommandEditor({
      name: '',
      content: template,
      isNew: true,
    });
    setEditCommandOpen(true);
  }, []);

  // Save command
  const handleSaveCommand = useCallback(() => {
    if (!socket || !commandEditor.name || !commandEditor.content) return;

    socket.emit(
      'saveCommand',
      { name: commandEditor.name, content: commandEditor.content },
      (response: { success: boolean; error?: string }) => {
        if (response.success) {
          setEditCommandOpen(false);
          setCommandEditor({ name: '', content: '', isNew: false });
        } else {
          alert(`Error: ${response.error}`);
        }
      }
    );
  }, [socket, commandEditor]);

  // Delete command
  const handleDeleteCommand = useCallback(
    (commandName: string) => {
      if (!socket) return;

      if (confirm(`Delete command "${commandName}"?`)) {
        socket.emit('deleteCommand', commandName, (response: { success: boolean }) => {
          if (response.success) {
            setEditCommandOpen(false);
          }
        });
      }
    },
    [socket]
  );

  // Update config
  const handleUpdateConfig = useCallback(() => {
    if (!socket) return;

    socket.emit('updateConfig', {
      prefix: configForm.prefix,
      ownerIds: configForm.ownerIds.split(',').map((id) => id.trim()).filter(Boolean),
      botName: configForm.botName,
    });

    setConfigOpen(false);
  }, [socket, configForm]);

  // Status badge helper
  const getStatusBadge = (status: Session['status']) => {
    switch (status) {
      case 'online':
        return (
          <Badge className="bg-green-500 text-xs">
            <CheckCircle className="mr-1 h-3 w-3" /> <span className="hidden xs:inline">Online</span>
          </Badge>
        );
      case 'connecting':
      case 'logging_in':
        return (
          <Badge className="bg-yellow-500 text-xs">
            <Clock className="mr-1 h-3 w-3" /> <span className="hidden xs:inline">{status === 'logging_in' ? 'Logging in' : 'Connecting'}</span>
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive" className="text-xs">
            <AlertCircle className="mr-1 h-3 w-3" /> <span className="hidden xs:inline">Error</span>
          </Badge>
        );
      case 'no_fca':
        return (
          <Badge variant="outline" className="text-xs">
            <AlertCircle className="mr-1 h-3 w-3" /> <span className="hidden xs:inline">No FCA</span>
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="text-xs">
            <PowerOff className="mr-1 h-3 w-3" /> <span className="hidden xs:inline">Offline</span>
          </Badge>
        );
    }
  };

  // Log level style
  const getLogStyle = (level: LogEntry['level']) => {
    switch (level) {
      case 'success':
        return 'text-green-400';
      case 'warn':
        return 'text-yellow-400';
      case 'error':
        return 'text-red-400';
      default:
        return 'text-blue-400';
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-900/95 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between px-3 py-3 sm:px-4 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <Bot className="h-6 w-6 sm:h-8 sm:w-8 text-blue-500 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold truncate">autonamo-hub</h1>
              <p className="text-xs sm:text-sm text-zinc-400 hidden sm:block">Facebook Messenger Bot Manager</p>
            </div>
          </div>
          
          {/* Desktop header actions */}
          <div className="hidden md:flex items-center gap-3">
            <Badge variant={connected ? 'default' : 'destructive'} className={connected ? 'bg-green-600' : ''}>
              {connected ? (
                <>
                  <Power className="mr-1 h-3 w-3" /> Server Connected
                </>
              ) : (
                <>
                  <PowerOff className="mr-1 h-3 w-3" /> Disconnected
                </>
              )}
            </Badge>
            <Dialog open={configOpen} onOpenChange={setConfigOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings className="mr-2 h-4 w-4" /> Settings
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-zinc-900 border-zinc-800 w-[calc(100%-2rem)] sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Bot Configuration</DialogTitle>
                  <DialogDescription>Configure global bot settings</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <label className="text-sm font-medium">Bot Name</label>
                    <Input
                      value={configForm.botName}
                      onChange={(e) => setConfigForm({ ...configForm, botName: e.target.value })}
                      className="mt-1 bg-zinc-800 border-zinc-700"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Command Prefix</label>
                    <Input
                      value={configForm.prefix}
                      onChange={(e) => setConfigForm({ ...configForm, prefix: e.target.value })}
                      className="mt-1 bg-zinc-800 border-zinc-700"
                      placeholder="!"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Owner IDs (comma-separated)</label>
                    <Input
                      value={configForm.ownerIds}
                      onChange={(e) => setConfigForm({ ...configForm, ownerIds: e.target.value })}
                      className="mt-1 bg-zinc-800 border-zinc-700"
                      placeholder="100000000000000, 100000000000001"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleUpdateConfig} className="w-full sm:w-auto">Save Changes</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Mobile header actions */}
          <div className="flex md:hidden items-center gap-2">
            <Badge variant={connected ? 'default' : 'destructive'} className={`${connected ? 'bg-green-600' : ''} text-xs px-2 py-1`}>
              {connected ? <Power className="h-3 w-3" /> : <PowerOff className="h-3 w-3" />}
            </Badge>
            <Dialog open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="px-2">
                  <Menu className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-zinc-900 border-zinc-800 w-[calc(100%-2rem)]">
                <DialogHeader>
                  <DialogTitle>Menu</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 py-4">
                  <div className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg">
                    <span className="text-sm">Server Status</span>
                    <Badge variant={connected ? 'default' : 'destructive'} className={connected ? 'bg-green-600' : ''}>
                      {connected ? 'Connected' : 'Disconnected'}
                    </Badge>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setConfigOpen(true);
                    }}
                  >
                    <Settings className="mr-2 h-4 w-4" /> Settings
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto p-3 sm:p-4">
        <Tabs defaultValue="sessions" className="w-full">
          <TabsList className="mb-4 bg-zinc-800 w-full sm:w-auto grid grid-cols-3 sm:flex">
            <TabsTrigger value="sessions" className="text-xs sm:text-sm px-2 sm:px-4">
              <Bot className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" /> 
              <span className="hidden xs:inline">Sessions</span>
              <span className="xs:hidden">Bot</span>
            </TabsTrigger>
            <TabsTrigger value="logs" className="text-xs sm:text-sm px-2 sm:px-4">
              <Terminal className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" /> 
              <span className="hidden xs:inline">Live Logs</span>
              <span className="xs:hidden">Logs</span>
            </TabsTrigger>
            <TabsTrigger value="commands" className="text-xs sm:text-sm px-2 sm:px-4">
              <Code className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" /> 
              <span className="hidden xs:inline">Commands</span>
              <span className="xs:hidden">Cmds</span>
            </TabsTrigger>
          </TabsList>

          {/* Sessions Tab */}
          <TabsContent value="sessions">
            <div className="mb-4 flex flex-col xs:flex-row gap-2">
              <Dialog open={addSessionOpen} onOpenChange={setAddSessionOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full xs:w-auto text-sm">
                    <Cookie className="mr-2 h-4 w-4" /> Add via Cookie
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-zinc-900 border-zinc-800 w-[calc(100%-2rem)] max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-base sm:text-lg">Add Session via Cookie</DialogTitle>
                    <DialogDescription className="text-xs sm:text-sm">
                      Paste your Facebook appState (cookie JSON) to create a new bot session
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <label className="text-sm font-medium">Session Name</label>
                      <Input
                        value={sessionForm.name}
                        onChange={(e) => setSessionForm({ ...sessionForm, name: e.target.value })}
                        className="mt-1 bg-zinc-800 border-zinc-700"
                        placeholder="My Bot Session"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Owner Facebook ID</label>
                      <Input
                        value={sessionForm.ownerId}
                        onChange={(e) => setSessionForm({ ...sessionForm, ownerId: e.target.value })}
                        className="mt-1 bg-zinc-800 border-zinc-700"
                        placeholder="100000000000000"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">appState (Cookie JSON)</label>
                      <Textarea
                        value={sessionForm.appState}
                        onChange={(e) => setSessionForm({ ...sessionForm, appState: e.target.value })}
                        className="mt-1 bg-zinc-800 border-zinc-700 font-mono text-xs min-h-[120px] sm:min-h-[200px]"
                        placeholder='[{"key": "c_user", "value": "...", ...}]'
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Proxy Server (optional)</label>
                      <Input
                        value={sessionForm.proxy}
                        onChange={(e) => setSessionForm({ ...sessionForm, proxy: e.target.value })}
                        className="mt-1 bg-zinc-800 border-zinc-700"
                        placeholder="http://proxy:port"
                      />
                    </div>
                  </div>
                  <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button variant="outline" onClick={() => setAddSessionOpen(false)} className="w-full sm:w-auto">
                      Cancel
                    </Button>
                    <Button onClick={handleAddSession} disabled={!sessionForm.appState} className="w-full sm:w-auto">
                      Add Session
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={loginSessionOpen} onOpenChange={setLoginSessionOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full xs:w-auto text-sm">
                    <LogIn className="mr-2 h-4 w-4" /> Login with Credentials
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-zinc-900 border-zinc-800 w-[calc(100%-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-base sm:text-lg">Login with Credentials</DialogTitle>
                    <DialogDescription className="text-xs sm:text-sm">
                      Enter your Facebook credentials to create a new bot session
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <label className="text-sm font-medium">Email</label>
                      <Input
                        type="email"
                        value={loginForm.email}
                        onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                        className="mt-1 bg-zinc-800 border-zinc-700"
                        placeholder="your@email.com"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Password</label>
                      <Input
                        type="password"
                        value={loginForm.password}
                        onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                        className="mt-1 bg-zinc-800 border-zinc-700"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Owner Facebook ID</label>
                      <Input
                        value={loginForm.ownerId}
                        onChange={(e) => setLoginForm({ ...loginForm, ownerId: e.target.value })}
                        className="mt-1 bg-zinc-800 border-zinc-700"
                        placeholder="100000000000000"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Proxy Server (optional)</label>
                      <Input
                        value={loginForm.proxy}
                        onChange={(e) => setLoginForm({ ...loginForm, proxy: e.target.value })}
                        className="mt-1 bg-zinc-800 border-zinc-700"
                        placeholder="http://proxy:port"
                      />
                    </div>
                  </div>
                  <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button variant="outline" onClick={() => setLoginSessionOpen(false)} className="w-full sm:w-auto">
                      Cancel
                    </Button>
                    <Button
                      onClick={handleLoginSession}
                      disabled={!loginForm.email || !loginForm.password}
                      className="w-full sm:w-auto"
                    >
                      Login
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {sessions.length === 0 ? (
              <Card className="bg-zinc-900 border-zinc-800">
                <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12 px-4">
                  <Bot className="h-12 w-12 sm:h-16 sm:w-16 text-zinc-600 mb-3 sm:mb-4" />
                  <p className="text-zinc-400 text-base sm:text-lg text-center">No sessions yet</p>
                  <p className="text-zinc-500 text-xs sm:text-sm mt-1 text-center">
                    Add a session via cookie or login to get started
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {sessions.map((session) => (
                  <Card key={session.id} className="bg-zinc-900 border-zinc-800">
                    <CardHeader className="pb-2 px-4 pt-4 sm:px-6 sm:pt-6">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base sm:text-lg truncate">{session.name}</CardTitle>
                        {getStatusBadge(session.status)}
                      </div>
                      <CardDescription className="text-zinc-500 text-xs sm:text-sm truncate">
                        ID: {session.id}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
                      <div className="space-y-2 text-xs sm:text-sm text-zinc-400">
                        <div className="flex justify-between gap-2">
                          <span className="shrink-0">Owner ID:</span>
                          <span className="text-zinc-300 truncate">{session.ownerId || 'Not set'}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="shrink-0">Proxy:</span>
                          <span className="text-zinc-300 truncate">{session.proxy || 'None'}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="shrink-0">Created:</span>
                          <span className="text-zinc-300">
                            {new Date(session.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="mt-4">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteSession(session.id)}
                          className="w-full sm:w-auto text-xs sm:text-sm"
                        >
                          <Trash2 className="mr-1 h-3 w-3" /> Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-2 px-4 pt-4 sm:px-6 sm:pt-6">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base sm:text-lg">Live Logs</CardTitle>
                  <Badge variant="outline" className="text-zinc-400 text-xs">
                    {logs.length} entries
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="px-3 pb-4 sm:px-6 sm:pb-6">
                <ScrollArea className="h-[50vh] sm:h-[60vh] lg:h-[600px] rounded-md border border-zinc-800 bg-zinc-950 p-2 sm:p-4">
                  <div className="font-mono text-[10px] sm:text-xs lg:text-sm space-y-1">
                    {logs.length === 0 ? (
                      <p className="text-zinc-500">No logs yet...</p>
                    ) : (
                      logs.map((log) => (
                        <div key={log.id} className="flex flex-wrap sm:flex-nowrap gap-1 sm:gap-2">
                          <span className="text-zinc-500 shrink-0">
                            [{new Date(log.timestamp).toLocaleTimeString()}]
                          </span>
                          <span className={`shrink-0 uppercase ${getLogStyle(log.level)}`}>
                            [{log.level}]
                          </span>
                          {log.sessionId && (
                            <span className="text-purple-400 shrink-0 hidden sm:inline">[{log.sessionId}]</span>
                          )}
                          <span className="text-zinc-300 break-all">{log.message}</span>
                        </div>
                      ))
                    )}
                    <div ref={logsEndRef} />
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Commands Tab */}
          <TabsContent value="commands">
            <div className="mb-4 flex flex-col xs:flex-row gap-2">
              <Button onClick={handleNewCommand} className="w-full xs:w-auto text-sm">
                <Plus className="mr-2 h-4 w-4" /> New Command
              </Button>
              <Button variant="outline" onClick={handleReloadCommands} className="w-full xs:w-auto text-sm">
                <RefreshCw className="mr-2 h-4 w-4" /> Reload
              </Button>
            </div>

            {commands.length === 0 ? (
              <Card className="bg-zinc-900 border-zinc-800">
                <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12 px-4">
                  <Code className="h-12 w-12 sm:h-16 sm:w-16 text-zinc-600 mb-3 sm:mb-4" />
                  <p className="text-zinc-400 text-base sm:text-lg text-center">No commands found</p>
                  <p className="text-zinc-500 text-xs sm:text-sm mt-1 text-center">
                    Create a new command to get started
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {commands.map((cmd) => (
                  <Card
                    key={cmd}
                    className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer"
                    onClick={() => handleEditCommand(cmd)}
                  >
                    <CardContent className="flex items-center justify-between py-3 px-3 sm:py-4 sm:px-4">
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <FileCode className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400 shrink-0" />
                        <span className="font-medium text-sm sm:text-base truncate">{cmd}</span>
                      </div>
                      <Edit className="h-3 w-3 sm:h-4 sm:w-4 text-zinc-500 shrink-0" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Command Editor Dialog */}
            <Dialog open={editCommandOpen} onOpenChange={setEditCommandOpen}>
              <DialogContent className="bg-zinc-900 border-zinc-800 w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-base sm:text-lg">
                    {commandEditor.isNew ? 'New Command' : `Edit: ${commandEditor.name}.js`}
                  </DialogTitle>
                  <DialogDescription className="text-xs sm:text-sm">
                    Edit the command code below. Must export a module with an execute function.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {commandEditor.isNew && (
                    <div>
                      <label className="text-sm font-medium">Command Name</label>
                      <Input
                        value={commandEditor.name}
                        onChange={(e) =>
                          setCommandEditor({ ...commandEditor, name: e.target.value })
                        }
                        className="mt-1 bg-zinc-800 border-zinc-700"
                        placeholder="mycommand"
                      />
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium">Code</label>
                    <Textarea
                      value={commandEditor.content}
                      onChange={(e) =>
                        setCommandEditor({ ...commandEditor, content: e.target.value })
                      }
                      className="mt-1 bg-zinc-800 border-zinc-700 font-mono text-[10px] sm:text-xs min-h-[250px] sm:min-h-[350px] lg:min-h-[400px]"
                    />
                  </div>
                </div>
                <DialogFooter className="flex-col sm:flex-row gap-2">
                  <div className="w-full sm:w-auto order-2 sm:order-1">
                    {!commandEditor.isNew && (
                      <Button
                        variant="destructive"
                        onClick={() => handleDeleteCommand(commandEditor.name)}
                        className="w-full sm:w-auto"
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </Button>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto order-1 sm:order-2">
                    <Button variant="outline" onClick={() => setEditCommandOpen(false)} className="w-full sm:w-auto">
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveCommand}
                      disabled={!commandEditor.name || !commandEditor.content}
                      className="w-full sm:w-auto"
                    >
                      <Save className="mr-2 h-4 w-4" /> Save
                    </Button>
                  </div>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 bg-zinc-900/50 mt-8">
        <div className="container mx-auto px-3 py-3 sm:px-4 sm:py-4 text-center text-xs sm:text-sm text-zinc-500">
          <p>
            autonamo-hub | Prefix:{' '}
            <code className="bg-zinc-800 px-1 rounded">{config.prefix}</code>
          </p>
          <p className="mt-1 text-[10px] sm:text-xs hidden sm:block">
            Install <code className="bg-zinc-800 px-1 rounded">@dongdev/fca-unofficial</code> or{' '}
            <code className="bg-zinc-800 px-1 rounded">fca-unofficial</code> to enable bot
            functionality
          </p>
        </div>
      </footer>
    </div>
  );
}
