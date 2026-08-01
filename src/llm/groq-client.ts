/**
 * Groq API client for LLM-powered command selection.
 * Provides typed access to Groq's chat completions API.
 */

export interface GroqMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface GroqRequest {
  model: string;
  messages: GroqMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  response_format?: { type: 'json_object' | 'text' };
}

export interface GroqChoice {
  message: GroqMessage;
  finish_reason: string;
}

export interface GroqResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: GroqChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface GroqError {
  error: {
    message: string;
    type: string;
    param: string | null;
    code: string;
  };
}

export class GroqClient {
  private apiKey: string;
  private baseUrl = 'https://api.groq.com/openai/v1';
  private retryAttempts = 2;
  private timeout = 10000;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GROQ_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('GROQ_API_KEY environment variable is not set');
    }
  }

  async chat(request: GroqRequest): Promise<GroqResponse> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
      try {
        return await this.callApi('/chat/completions', request);
      } catch (err) {
        lastError = err as Error;
        if (attempt < this.retryAttempts - 1) {
          const delayMs = Math.pow(2, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    throw lastError || new Error('Failed to call Groq API after retries');
  }

  private async callApi(
    endpoint: string,
    request: GroqRequest
  ): Promise<GroqResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = (await response.json()) as GroqError;
        throw new Error(
          `Groq API error: ${error.error.message} (${error.error.code})`
        );
      }

      const result = (await response.json()) as GroqResponse;
      return result;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Groq API request timeout (${this.timeout}ms)`);
      }
      throw err;
    }
  }

  async parseJsonResponse<T>(request: GroqRequest): Promise<T> {
    const response = await this.chat({
      ...request,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message.content;
    if (!content) {
      throw new Error('No response content from Groq');
    }

    try {
      return JSON.parse(content) as T;
    } catch (err) {
      throw new Error(`Failed to parse JSON response: ${content}`);
    }
  }

  async getTextResponse(request: GroqRequest): Promise<string> {
    const response = await this.chat(request);
    return response.choices[0]?.message.content || '';
  }
}

export default GroqClient;
