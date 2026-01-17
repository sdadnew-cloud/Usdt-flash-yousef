
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants.tsx";

const transferTool: FunctionDeclaration = {
  name: "initiate_real_transfer",
  parameters: {
    type: Type.OBJECT,
    description: "Initiate a real USDT transfer or batch payload injection on Ethereum Mainnet.",
    properties: {
      target_address: { type: Type.STRING, description: "The real ETH destination address." },
      amount: { type: Type.STRING, description: "Exact amount of Real USDT to send." }
    },
    required: ["target_address", "amount"]
  }
};

const mintTool: FunctionDeclaration = {
  name: "initiate_real_mint",
  parameters: {
    type: Type.OBJECT,
    description: "Prepare the real minting/foundry process for a new custom Real USDT Flash contract.",
    properties: {
      name: { type: Type.STRING, description: "Name of the real token (e.g. Tether USDT)." },
      symbol: { type: Type.STRING, description: "Symbol (e.g. USDT)." },
      supply: { type: Type.STRING, description: "Total real supply to mint into existence." }
    },
    required: ["name", "symbol", "supply"]
  }
};

export const streamWormGPTResponse = async (
  history: { role: string; content: string }[],
  onChunk: (text: string) => void,
  onToolCall?: (toolCall: any) => void
) => {
  // Always create a new instance to ensure the latest API key is used
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const contents = history.map(h => ({
    role: h.role === 'user' ? 'user' : 'model',
    parts: [{ text: h.content }]
  }));

  try {
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-3-pro-preview',
      contents: contents as any,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ functionDeclarations: [transferTool, mintTool] }],
        temperature: 0.9,
      },
    });

    for await (const chunk of responseStream) {
      if (chunk.text) {
        onChunk(chunk.text);
      }
      
      // Tool calls can arrive in chunks
      if (chunk.functionCalls) {
        for (const fc of chunk.functionCalls) {
          onToolCall?.(fc);
        }
      }
    }
  } catch (error) {
    console.error("Worm_Internal_Sync_Error:", error);
    throw error;
  }
};
