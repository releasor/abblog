import { prisma } from "./prisma";

export async function getAiConfig(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: parseInt(userId) },
    select: { aiApiKey: true, aiApiUrl: true, aiModel: true },
  });

  return {
    apiKey: user?.aiApiKey || process.env.AI_API_KEY || "",
    apiUrl: user?.aiApiUrl || process.env.AI_API_URL || "https://api.openai.com/v1/chat/completions",
    model: user?.aiModel || process.env.AI_MODEL || "gpt-3.5-turbo",
  };
}
