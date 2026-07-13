export class JuheError extends Error {
  constructor(
    message: string,
    public code?: number
  ) {
    super(message)
    this.name = 'JuheError'
  }
}

export class JuheAPIError extends JuheError {
  constructor(
    message: string,
    code: number,
    public statusCode?: number
  ) {
    super(message, code)
    this.name = 'JuheAPIError'
  }
}

export class JuheAuthError extends JuheAPIError {
  constructor(message = 'Authentication failed') {
    super(message, 401, 401)
    this.name = 'JuheAuthError'
  }
}

export class JuheRateLimitError extends JuheAPIError {
  constructor(
    message = 'Rate limit exceeded',
    public retryAfter?: number
  ) {
    super(message, 429, 429)
    this.name = 'JuheRateLimitError'
  }
}

export class JuheNetworkError extends JuheError {
  constructor(
    message: string,
    public originalError?: Error
  ) {
    super(message)
    this.name = 'JuheNetworkError'
  }
}

export class JuheStreamError extends JuheError {
  constructor(message: string) {
    super(message)
    this.name = 'JuheStreamError'
  }
}
