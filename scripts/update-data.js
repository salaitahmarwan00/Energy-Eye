import fs from 'fs';
import path from 'path';
import axios from 'axios';
import OpenAI from 'openai';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Validate environment variables
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const NEWS_API_KEY = process.env.NEWS_API_KEY;

if (!OPENAI_API_KEY || !NEWS_API_KEY) {
    console.error("CRITICAL ERROR: Missing OPENAI_API_KEY or NEWS_API_KEY environment variables.");
    process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// 2. Fetch News from NewsAPI
async function fetchRecentIncidents() {
    console.log("Fetching the latest global energy headlines...");
    try {
        // Look back 24 hours to ensure we catch everything in a 12-hour run cycle
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        const response = await axios.get(`https://newsapi.org/v2/everything`, {
            params: {
                q: '(refinery OR "offshore" OR "solar" OR "wind" OR pipeline OR "power plant") AND (fire OR explosion OR damage OR failure OR shutdown OR "insurance loss")',
                from: yesterday,
                sortBy: 'relevancy',
                language: 'en',
                apiKey: NEWS_API_KEY
            }
        });
        
        const articles = response.data.articles || [];
        console.log(`Found ${articles.length} potential incident articles.`);
        return articles.slice(0, 15); // Top 15 most relevant
    } catch (error) {
        console.error("NewsAPI Fetch Error:", error.message);
        return [];
    }
}

// 3. Analyze with OpenAI
async function analyzeImpact(articles) {
    if (articles.length === 0) {
        console.log("No articles found to analyze.");
        return null;
    }

    console.log("Sending articles to the AI Analyst (OpenAI) for underwriting review...");

    const articlesText = articles.map(a => `Headline: ${a.title}\nSource: ${a.source.name}\nDate: ${a.publishedAt}\nSummary: ${a.description}`).join('\n\n---\n\n');

    const systemPrompt = `You are a Senior Energy Insurance Underwriter and Data Analyst. Read the provided news articles about energy facility incidents from the last 24 hours.

Your goal is to extract the 3-5 most severe incidents that would result in a major insurance loss.
Format your output EXACTLY as this JSON structure:

{
  "overallSummary": {
    "title": "Global Energy Insurance Market Brief",
    "content": "A high-level 2-sentence summary of the current market state based on these specific news events.",
    "premiumTrend": "hardening", // choose: hardening, softening, or stable
    "capacityTrend": "contracting" // choose: expanding, contracting, or stable
  },
  "losses": [
    {
      "id": "L-AI-123", // generate a unique sort of ID
      "facility": "Name of the facility/asset from the news",
      "type": "Specific event type (e.g. Explosion, Turbine Failure)",
      "sector": "Upstream: Offshore OR Downstream: Oil & Gas OR Downstream: Renewables",
      "estimatedLoss": "Estimate in USD (e.g. $150m). Make a highly educated guess based on severity if unstated.",
      "date": "ISO-8601 date string based on the article date",
      "status": "Under Investigation", // choose a realistic claims status
      "impact": "Predicted underwriting impact (e.g. 'Increased BI deductibles expected').",
      "description": "1 sentence describing the physical loss."
    }
  ]
}

Only return valid JSON. Do not include markdown code blocks (\`\`\`json) in your response.`;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o", // Use a smart model for reasoning
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Here are the articles:\n\n${articlesText}` }
            ],
            response_format: { type: "json_object" }
        });

        const rawJson = completion.choices[0].message.content;
        return JSON.parse(rawJson);
    } catch (error) {
        console.error("OpenAI Analysis Error:", error.message);
        process.exit(1);
    }
}

// 4. Update the Data File
async function runUpdate() {
    console.log("=== Autonomous AI Analyst Started ===");
    const articles = await fetchRecentIncidents();
    const newInsights = await analyzeImpact(articles);

    if (newInsights && newInsights.losses && newInsights.losses.length > 0) {
        const dataFilePath = path.join(__dirname, '..', 'data', 'market-data.js');
        
        let existingFileContent = fs.readFileSync(dataFilePath, 'utf8');
        let existingData = {};
        
        try {
            // Naively parse existing file to retain static branches
            const jsonStr = existingFileContent.replace('window.MOCK_MARKET_DATA = ', '').replace(/;\s*$/, '');
            existingData = JSON.parse(jsonStr);
        } catch (e) {
            console.error("Could not parse existing market-data.js, falling back to empty branches.");
        }

        const finalData = {
            lastUpdated: new Date().toISOString(),
            overallSummary: newInsights.overallSummary || existingData.overallSummary,
            branches: existingData.branches || {},
            // We prepend new losses to the top of the array
            losses: [...newInsights.losses, ...(existingData.losses || [])].slice(0, 50) // Keep history up to 50
        };

        const fileOutput = `// Automatically generated by AI Analyst Script - ${new Date().toISOString()}\nwindow.MOCK_MARKET_DATA = ${JSON.stringify(finalData, null, 2)};\n`;
        
        fs.writeFileSync(dataFilePath, fileOutput, 'utf8');
        console.log("SUCCESS: Dashboard data updated with fresh AI insights.");
    } else {
        console.log("No new actionable losses found or AI analysis failed. Data remains unchanged.");
    }
    console.log("=== Autonomous AI Analyst Finished ===");
}

runUpdate();
