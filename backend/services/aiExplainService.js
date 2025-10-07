const { CohereClientV2 } = require('cohere-ai');

const cohere = new CohereClientV2({
  token: process.env.COHERE_API_KEY
});

async function explainTerm(term, level = 'expert') {
  try {
    let prompt;
    
   if (level === 'child') {
  prompt = `
      You are a friendly teacher explaining finance to a 5-year-old.
      Explain the financial term "${term}" in a **very simple**, **story-like** way using short sentences and easy words. 
      Avoid numbers or jargon.
      Include one short and fun example from daily life (like toys, candies, or pocket money).

      Example:
      Term: "Saving"
      Explanation: Saving means keeping some of your candies for later instead of eating them all now. It helps you have candies when you really want them later!
      `;
      }
 else if (level === 'beginner') {
  prompt = `
You are teaching finance to a person new to trading.
Explain "${term}" in **simple, beginner-friendly language**. 
Include:
1. A short, clear definition.
2. A very basic example related to trading or daily life.
3. One line about why this concept matters.

Example:
Term: "Stock"
Explanation: A stock is like owning a small part of a company. 
Example: If you buy one share of Apple, you own a tiny piece of Apple.
Why it matters: When the company grows, your share’s value can increase.
`;
}
else if (level === 'general') {
  prompt = `
Provide a **clear and concise explanation** of the financial term "${term}" for someone with a general understanding of finance. 
Include:
1. Definition
2. Context (where or how it’s used)
3. A practical example or scenario

Example:
Term: "Inflation"
Explanation: Inflation means prices of goods and services increase over time. 
Context: Central banks track inflation to decide interest rates.
Example: If bread costs ₹40 this year and ₹44 next year, inflation is 10%.
`;
}
else {
  prompt = `
Provide a **detailed, analytical explanation** of "${term}" suitable for someone experienced in trading or investing.
Include:
1. Definition and background
2. Its importance or role in financial markets
3. Real-world applications or strategies where it's used
4. (Optional) A brief example or case study

Example:
Term: "Leverage"
Explanation: Leverage is using borrowed funds to increase potential returns on investment.
Importance: It magnifies both profits and losses, hence must be managed carefully.
Application: Traders often use leverage in margin accounts to control larger positions with smaller capital.
Example: With 10x leverage, investing ₹10,000 allows control over ₹1,00,000 worth of assets.
`;
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
