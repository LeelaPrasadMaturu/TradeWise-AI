const { CohereClientV2 } = require('cohere-ai');

const cohere = new CohereClientV2({
  token: process.env.COHERE_API_KEY
});

async function explainTerm(term, level = 'expert') {
  try {
    let prompt;
    
    if (level === 'child') {
      prompt = `Explain the financial term "${term}" in a very simple way, as if explaining to a 5-year-old. Use simple words and a relatable example.`;
    } else if (level === 'beginner') {
      prompt = `Explain "${term}" in simple terms for someone new to trading. Include a basic example and why it's important.`;
    } else if (level === 'general') {
      prompt = `Provide a clear and concise explanation of "${term}". Include relevant context and practical implications.`;
    } else {
      prompt = `Explain "${term}" in detail, including its definition, importance, and practical applications in trading or investing.`;
    }

    const response = await cohere.chat({
      model: "command-a-03-2025",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    if (!response || !response.message || !response.message.content || !response.message.content[0]) {
      throw new Error('Invalid response from Cohere API');
    }

    return {
      term,
      level,
      explanation: response.message.content[0].text.trim(),
      source: 'cohere'
    };
  } catch (error) {
    console.error('Error in Cohere API:', error);
    
    // More detailed fallback explanation
    const fallbackExplanations = {
      'moving average': 'A moving average is a technical analysis tool that smooths out price data by creating a constantly updated average price. It helps traders identify trends by reducing the impact of random price fluctuations.',
      'default': `Here's a basic explanation of ${term}: This is a financial concept that helps traders and investors analyze market trends and make informed decisions.`
    };

    return {
      term,
      level,
      explanation: fallbackExplanations[term.toLowerCase()] || fallbackExplanations.default,
      source: 'fallback',
      error: error.message
    };
  }
}

module.exports = {
  explainTerm
}; 