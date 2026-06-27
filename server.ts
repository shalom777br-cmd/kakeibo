import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// Initialize Gemini SDK with telemetry header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Helper for calling Gemini with retry and model fallback (handles transient 503/429 errors)
async function generateContentWithFallback(params: { contents: string; config: any }, attempts = 2, delayMs = 1500) {
  const modelsToTry = ["gemini-3.5-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
  let lastError: any = null;

  for (const modelName of modelsToTry) {
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        console.log(`[Gemini] Attempting generation with model: ${modelName} (Attempt ${attempt}/${attempts})`);
        const response = await ai.models.generateContent({
          model: modelName,
          contents: params.contents,
          config: params.config,
        });
        if (response && response.text) {
          console.log(`[Gemini] Success using model: ${modelName}`);
          return response;
        }
      } catch (error: any) {
        lastError = error;
        const errMsg = error.message || "";
        const errStatus = error.status || (error.error && error.error.code);
        console.error(`[Gemini] Error with model ${modelName} on attempt ${attempt}:`, errMsg);

        const isTransient = errStatus === 503 || errStatus === 429 || 
                            errMsg.includes("503") || errMsg.includes("429") || 
                            errMsg.includes("high demand") || errMsg.includes("UNAVAILABLE") || 
                            errMsg.includes("temporary");

        if (!isTransient && attempt === 1) {
          // If it's a structural or validation error, don't waste time retrying this model, switch to next model immediately
          break;
        }

        if (attempt < attempts) {
          const waitTime = delayMs * Math.pow(1.5, attempt - 1);
          console.log(`[Gemini] Waiting ${waitTime}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
    }
  }
  throw lastError || new Error("Failed to generate content with all fallback models");
}

// Voice Input parsing endpoint
app.post("/api/parse-voice", async (req, res) => {
  try {
    const { text, currentDate } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }

    const referenceDate = currentDate || "2026-06-24";

    const response = await generateContentWithFallback({
      contents: `Parse this spoken text into a structured household ledger entry.
Input Text: "${text}"

Reference:
- Today's date is: ${referenceDate}
- If no date is mentioned, assume today's date (${referenceDate}).
- If "yesterday" (昨日) is mentioned, calculate the date (one day before ${referenceDate}).
- If "day before yesterday" (一昨日) is mentioned, calculate the date (two days before ${referenceDate}).
- Resolve the category to a standard Japanese household category like: "食費" (Food), "日用品" (Daily Goods), "交際費" (Social/Entertainment), "交通費" (Transportation), "住宅費" (Housing), "光熱費" (Utilities), "通信費" (Communication), "趣味・娯楽" (Hobbies), "給与" (Salary), "その他収入" (Other Income), "その他支出" (Other Expense).
- Determine if it's "income" (収入) or "expense" (支出). If not clear, default to "expense".
- Extract the numeric amount (integer). If the user says "万円" (ten thousand yen), convert it to the full integer value (e.g., "1万円" = 10000).`,
      config: {
        systemInstruction: "You are an intelligent household ledger parser. Your task is to extract structured JSON from free-form Japanese text about household income or expenses. Return only valid JSON adhering to the schema.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            date: {
              type: Type.STRING,
              description: "The date of the transaction in YYYY-MM-DD format.",
            },
            item: {
              type: Type.STRING,
              description: "Short description of the item or action in Japanese (e.g. 'スーパーで買い物', 'ランチ', '給料').",
            },
            category: {
              type: Type.STRING,
              description: "The Japanese category of the transaction.",
            },
            type: {
              type: Type.STRING,
              description: "Must be either 'income' or 'expense'.",
            },
            amount: {
              type: Type.INTEGER,
              description: "The transaction amount as an absolute positive integer number.",
            },
          },
          required: ["date", "item", "category", "type", "amount"],
        },
      },
    });

    const resultText = response.text?.trim() || "{}";
    const parsed = JSON.parse(resultText);
    res.json(parsed);
  } catch (error: any) {
    console.error("Error in parse-voice:", error);
    res.status(500).json({ error: error.message || "Failed to parse voice input" });
  }
});

// Setup Vite / Static Serving
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start();
