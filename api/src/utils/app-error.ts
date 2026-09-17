class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    // @ts-expect-error TODO(ts-migration): type this site
    this.statusCode = statusCode;
    // @ts-expect-error TODO(ts-migration): type this site
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;