/**
 * Ping Command
 * Check bot latency and status
 */

module.exports = {
  config: {
    name: 'ping',
    description: 'Check bot latency and status',
    usage: 'ping',
    aliases: ['pong', 'latency'],
    cooldown: 3,
    ownerOnly: false
  },

  async execute(ctx) {
    const { reply, react } = ctx;
    const start = Date.now();

    react('🏓');

    const latency = Date.now() - start;
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    const memUsage = process.memoryUsage();
    const memMB = (memUsage.heapUsed / 1024 / 1024).toFixed(2);

    reply(`🏓 Pong!\n\n⏱️ Latency: ${latency}ms\n⏰ Uptime: ${hours}h ${minutes}m ${seconds}s\n💾 Memory: ${memMB} MB`);
  }
};
