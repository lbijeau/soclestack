import {
  OpenApiGeneratorV3,
  OpenAPIRegistry,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

// Extend Zod
extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

// 1. Define Common Schemas
const ErrorSchema = registry.register(
  'Error',
  z.object({
    error: z.object({
      type: z.string(),
      message: z.string(),
      details: z.any().optional(),
    }),
  })
);

const UserSchema = registry.register(
  'User',
  z.object({
    id: z.string().cuid(),
    email: z.string().email(),
    username: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    role: z.enum(['USER', 'ADMIN', 'MODERATOR']),
    isActive: z.boolean(),
    emailVerified: z.boolean(),
    lastLoginAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
  })
);

// 2. Register Paths
registry.registerPath({
  method: 'post',
  path: '/api/auth/login',
  summary: 'User Login',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            email: z.string().email(),
            password: z.string(),
            rememberMe: z.boolean().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Successful login',
      content: {
        'application/json': {
          schema: z.object({
            message: z.string(),
            user: UserSchema,
            tokens: z.object({
              accessToken: z.string(),
              refreshToken: z.string(),
            }),
          }),
        },
      },
    },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/users',
  summary: 'List Users',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'List of users',
      content: {
        'application/json': {
          schema: z.object({
            users: z.array(UserSchema),
            pagination: z.object({
              page: z.number(),
              limit: z.number(),
              totalUsers: z.number(),
              totalPages: z.number(),
            }),
          }),
        },
      },
    },
  },
});

// Security Schemes
registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

// Generator
const generator = new OpenApiGeneratorV3(registry.definitions);

const spec = generator.generateDocument({
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'SocleStack API',
    description: 'Enterprise-grade User Management API Specification',
  },
  servers: [{ url: '/api' }],
});

// Output
const jsonPath = './docs/public/openapi.json';
const yamlPath = './docs/public/openapi.yaml';

if (!fs.existsSync('./docs/public')) {
  fs.mkdirSync('./docs/public', { recursive: true });
}

fs.writeFileSync(jsonPath, JSON.stringify(spec, null, 2));
fs.writeFileSync(yamlPath, yaml.dump(spec));

console.log('OpenAPI specification generated successfully at:');
console.log(`- ${jsonPath}`);
console.log(`- ${yamlPath}`);