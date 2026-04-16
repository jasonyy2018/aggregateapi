import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// A simple implementation of the chat completions API Gateway
export async function POST(req: Request) {
  try {
    // 1. Verify Authorization
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    
    // Check key in DB
    const apiKey = await prisma.apiKey.findUnique({
      where: { key: token },
      include: { user: true }
    });

    if (!apiKey || !apiKey.isActive) {
      return NextResponse.json({ error: 'Invalid or inactive API Key' }, { status: 401 });
    }

    const user = apiKey.user;

    // 2. Check Balance
    // Assuming cost per token is very low, requiring at least $0.01
    if (user.balance < 0.01) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 402 });
    }

    // 3. Parse Request
    const body = await req.json();
    let requestedModel = body.model || 'openai/gpt-4o';
    let provider = 'openrouter';

    // 4. Model Routing Engine (Simple version)
    // If user specifies a cheap generic name, route to Together
    const togetherModels = ['meta-llama/Llama-3-8b-chat-hf', 'mistralai/Mixtral-8x7B-Instruct-v0.1'];
    
    let apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
    let apiToken = process.env.OPENROUTER_API_KEY;

    if (body.model === 'cheapest' || togetherModels.includes(body.model)) {
      provider = 'together';
      apiUrl = 'https://api.together.xyz/v1/chat/completions';
      apiToken = process.env.TOGETHER_API_KEY;
      requestedModel = body.model === 'cheapest' ? 'meta-llama/Llama-3-8b-chat-hf' : body.model;
    }

    // Rewrite model in the body
    const payload = { ...body, model: requestedModel };

    // 5. Forward to downstream Provider
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    // Handle Streaming vs Non-streaming
    if (payload.stream) {
      // NOTE: Stream requires tracking tokens inside the chunk parsing,
      // For MVP, we pass the stream directly. In production, we need a stream wrapper to calculate usage.
      return new Response(response.body, {
        headers: {
          'Content-Type': 'text/event-stream'
        }
      });
    }

    const data = await response.json();

    // 6. Calculate tokens and deduct balance
    if (data.usage) {
      const totalTokens = data.usage.total_tokens || 0;
      // Define selling price (e.g. $0.002 per 1k tokens)
      let pricePer1k = 0.002; 
      
      // Dynamic pricing based on model could be added here
      if (provider === 'together') {
        pricePer1k = 0.0005; // Cheaper
      }

      const cost = (totalTokens / 1000) * pricePer1k;

      // Ensure deduct happens asynchronously or before returning
      // Wait for it in this MVP
      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: { balance: { decrement: cost } }
        }),
        prisma.usageLog.create({
          data: {
            userId: user.id,
            model: requestedModel,
            provider: provider,
            tokens: totalTokens,
            cost: cost
          }
        }),
        prisma.apiKey.update({
          where: { id: apiKey.id },
          data: { lastUsedAt: new Date() }
        })
      ]);
    }

    // 7. Return Result
    return NextResponse.json(data, { status: response.status });

  } catch (error: any) {
    console.error('API Gateway Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
