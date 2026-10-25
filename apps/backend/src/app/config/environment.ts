import * as Joi from 'joi';

export const environmentSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  GEMINI_API_KEY: Joi.string().allow('').default(''),
  GEMINI_MODEL: Joi.string().default('gemini-3.5-flash-lite'),
  CORS_ORIGIN: Joi.string().default('http://localhost:4200'),
  MONGO_URI: Joi.string().default(
    'mongodb://testuser:testpass@localhost:27017/',
  ),
  MONGO_MESSAGE_DB: Joi.string().default('MessageTrackingDb'),
  MONGO_AUTH_SOURCE: Joi.string().default('admin'),
  THROTTLE_TTL: Joi.number().default(60),
  THROTTLE_LIMIT: Joi.number().default(60),
  SERVICE_BUS_ADMIN_CONNECTION_STRING: Joi.string().default(
    'Endpoint=sb://localhost:5300;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=SAS_KEY_VALUE;UseDevelopmentEmulator=true;',
  ),
  AWS_ENDPOINT_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .allow('')
    .default('http://localhost:4566'),
  AWS_REGION: Joi.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: Joi.string().allow(''),
  AWS_SECRET_ACCESS_KEY: Joi.string().allow(''),
});
