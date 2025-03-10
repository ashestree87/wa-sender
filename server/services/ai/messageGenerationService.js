const OpenAI = require('openai');
const dotenv = require('dotenv');

dotenv.config();

class MessageGenerationService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
  
  async generateMessage(template, prompt, recipientName = '') {
    try {
      // Create a system prompt that instructs the AI to generate a human-like message
      const systemPrompt = `You are an assistant that helps create natural, human-like WhatsApp messages. 
      Generate a message based on the template and make it sound conversational and authentic.
      Avoid formal language and use a friendly tone. Include some natural variations and personality.
      The message should not sound like it was generated by AI.`;
      
      // Create a user prompt that includes the template and any additional context
      const userPrompt = `
      Template: ${template}
      
      Additional context: ${prompt || 'Make this message sound natural and conversational'}
      
      Recipient name: ${recipientName || 'the recipient'}
      
      Please generate a human-like message based on this template. Don't include any AI-like phrases or formal language.`;
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7, // Higher temperature for more creativity
        max_tokens: 300
      });
      
      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error('Error generating AI message:', error);
      // Fall back to the template if AI generation fails
      return template.replace('{name}', recipientName || 'there');
    }
  }
}

module.exports = new MessageGenerationService(); 