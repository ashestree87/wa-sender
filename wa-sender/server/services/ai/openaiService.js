const { OpenAI } = require('openai');

class OpenAIService {
  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
  
  async enhanceMessage(message, prompt, recipientName) {
    try {
      const response = await this.client.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are a helpful assistant that enhances WhatsApp messages. ${prompt}`
          },
          {
            role: "user",
            content: `Enhance this message for ${recipientName}: "${message}"`
          }
        ],
        max_tokens: 300,
        temperature: 0.7
      });
      
      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw error;
    }
  }
}

module.exports = new OpenAIService(); 