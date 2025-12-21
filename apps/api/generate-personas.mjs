import OpenAI from 'openai';
import 'dotenv/config';

const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

const prompt = `Stwórz 5 unikalnych person dla forum o zarabianiu w internecie. Każda persona musi być RADYKALNIE INNA.

WYMAGANIA DLA KAŻDEJ PERSONY:
1. Imię/nick - naturalne, nie "archetypowe" (NIE: "TradingExpert", TAK: "Marek_z_Krakowa", "cryptobro99")
2. Wiek i tło - konkretne, np. "34 lata, były programista, teraz day trader"
3. Styl pisania - KONKRETNY:
   - Czy używa emoji? Jak często?
   - Czy przeklinuje? 
   - Czy pisze długo czy krótko?
   - Czy używa wielkich liter dla emfazy?
   - Czy robi literówki?
   - Czy używa slangu? Jakiego?
4. Tiki językowe - ulubione zwroty, np. "no i git", "serio mówię", "btw"
5. Wady charakteru - np. arogancki, przerywający, pesymista, naiwny
6. Emocjonalność - jak reaguje na krytykę? Na sukces innych?
7. Specjalizacja - w czym jest dobry
8. Ciemna strona - jakie ma złe doświadczenia, co go wkurza

FORMAT ODPOWIEDZI (JSON):
{
  "personas": [
    {
      "name": "nick",
      "slug": "nick-slug",
      "age": 34,
      "background": "krótkie tło",
      "description": "publiczny opis 1-2 zdania",
      "writingStyle": {
        "emoji": "często/czasem/nigdy",
        "profanity": "tak/lekko/nie", 
        "length": "krótki/średni/długi",
        "caps": "tak/nie",
        "typos": "tak/nie",
        "slang": ["przykłady", "slangu"]
      },
      "verbalTicks": ["ulubione", "zwroty"],
      "flaws": ["wady", "charakteru"],
      "emotionalResponse": "jak reaguje na rzeczy",
      "expertise": ["tematy"],
      "darkSide": "złe doświadczenia, frustracje",
      "personalityPrompt": "PEŁNY PROMPT dla AI - min 500 słów, bardzo szczegółowy, z przykładami jak pisać"
    }
  ]
}

Persony powinny reprezentować:
1. Doświadczony praktyk (cyniczny, zmęczony bullshitem)
2. Młody entuzjasta (naiwny ale energiczny)
3. Analityk/sceptyk (zimny, logiczny, czasem arogancki)
4. Bootstrapper (oszczędny do bólu, praktyczny)
5. Wizjoner trendów (czasem się myli, ale ma ciekawe pomysły)

WAŻNE: Każda persona musi brzmieć JAK PRAWDZIWY CZŁOWIEK na polskim forum, nie jak AI!`;

async function generate() {
  console.log('🎭 Generuję nowe persony przez Claude...\n');
  
  try {
    const response = await openrouter.chat.completions.create({
      model: 'anthropic/claude-3.5-sonnet',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 8000,
      temperature: 0.9,
    });
    
    const content = response.choices[0]?.message?.content;
    console.log(content);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

generate();
