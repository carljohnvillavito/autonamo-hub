/**
 * ChatGPT Command
 * Simulates AI conversation (placeholder - requires OpenAI API key for real integration)
 */

module.exports = {
  config: {
    name: 'chatgpt',
    description: 'Chat with AI (requires OPENAI_API_KEY environment variable)',
    usage: 'chatgpt <message>',
    aliases: ['ai', 'gpt', 'ask'],
    cooldown: 5,
    ownerOnly: false
  },

  async execute(ctx) {
    const { args, reply, react } = ctx;

    if (args.length === 0) {
      return reply('Please provide a message.\n\nUsage: !chatgpt <your question>');
    }

    const message = args.join(' ');

    // React to show processing
    react('⏳');

    try {
      // Check for OpenAI API key
      const apiKey = process.env.OPENAI_API_KEY;

      if (!apiKey) {
        react('⚠️');
        return reply(
          '⚠️ OpenAI API key not configured.\n\n' +
          'To enable ChatGPT, set the OPENAI_API_KEY environment variable.\n\n' +
          'Your message was: ' + message
        );
      }

      // Make request to OpenAI
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant in a Facebook Messenger chat. Keep responses concise and friendly.'
            },
            {
              role: 'user',
              content: message
            }
          ],
          max_tokens: 500,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'API request failed');
      }

      const data = await response.json();
      const aiResponse = data.choices[0]?.message?.content || 'No response generated.';

      react('✅');
      reply(`🤖 ChatGPT:\n\n${aiResponse}`);

    } catch (error) {
      react('❌');
      reply(`Error: ${error.message}`);
    }
  }
};
