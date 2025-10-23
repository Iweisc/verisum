/**
 * Simple rate limiter using token bucket algorithm
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number;

  /**
   * @param maxTokens - Maximum number of tokens in the bucket
   * @param refillRate - Number of tokens to add per second
   */
  constructor(maxTokens: number, refillRate: number) {
    this.maxTokens = maxTokens;
    this.refillRate = refillRate;
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000;
    const tokensToAdd = timePassed * this.refillRate;

    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  /**
   * Attempts to consume a token
   * @returns true if successful, false if rate limit exceeded
   */
  tryConsume(): boolean {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }

    return false;
  }

  /**
   * Waits until a token is available
   * @param timeoutMs - Maximum time to wait in milliseconds
   * @returns Promise that resolves when token is available
   */
  async waitForToken(timeoutMs: number = 30000): Promise<void> {
    const startTime = Date.now();

    while (!this.tryConsume()) {
      if (Date.now() - startTime > timeoutMs) {
        throw new Error('Rate limit timeout exceeded');
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  /**
   * Gets the current number of available tokens
   */
  getAvailableTokens(): number {
    this.refill();
    return this.tokens;
  }
}

const API_RATE_LIMITER_MAX_TOKENS = 10;
const API_RATE_LIMITER_REFILL_RATE = 2;

export const apiRateLimiter = new RateLimiter(
  API_RATE_LIMITER_MAX_TOKENS,
  API_RATE_LIMITER_REFILL_RATE
);
