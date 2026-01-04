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

const RoleSchema = registry.register(
  'Role',
  z.object({
    id: z.string().cuid(),
    name: z
      .string()
      .regex(/^ROLE_[A-Z][A-Z0-9_]+$/)
      .openapi({
        description: `Role name must follow the pattern: ROLE_[A-Z][A-Z0-9_]+
- Must start with "ROLE_"
- Followed by at least 2 uppercase letters, numbers, or underscores
- First character after ROLE_ must be a letter

Valid examples: ROLE_USER, ROLE_BILLING_ADMIN, ROLE_SUPPORT_TIER_1
Invalid examples: ROLE_A (too short), ROLE_admin (lowercase), ROLE-ADMIN (hyphen)`,
        example: 'ROLE_BILLING_ADMIN',
      }),
    description: z.string().nullable(),
    parentId: z.string().cuid().nullable(),
    parentName: z.string().nullable(),
    isSystem: z.boolean(),
    userCount: z.number(),
    childCount: z.number(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
);

const RoleDetailSchema = registry.register(
  'RoleDetail',
  z.object({
    id: z.string().cuid(),
    name: z
      .string()
      .regex(/^ROLE_[A-Z][A-Z0-9_]+$/)
      .openapi({
        description: `Role name must follow the pattern: ROLE_[A-Z][A-Z0-9_]+`,
        example: 'ROLE_BILLING_ADMIN',
      }),
    description: z.string().nullable(),
    parentId: z.string().cuid().nullable(),
    parentName: z.string().nullable(),
    isSystem: z.boolean(),
    users: z.array(
      z.object({
        id: z.string().cuid(),
        email: z.string().email(),
        firstName: z.string().nullable(),
        lastName: z.string().nullable(),
      })
    ),
    totalUsers: z.number(),
    hasMoreUsers: z.boolean(),
    childRoles: z.array(
      z.object({
        id: z.string().cuid(),
        name: z.string(),
      })
    ),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
);

const CreateRoleSchema = registry.register(
  'CreateRole',
  z.object({
    name: z
      .string()
      .min(7, 'Minimum length is 7 (ROLE_ prefix + 2 characters)')
      .regex(/^ROLE_[A-Z][A-Z0-9_]+$/)
      .openapi({
        description: `Role name must follow the pattern: ROLE_[A-Z][A-Z0-9_]+
- Must start with "ROLE_"
- Followed by at least 2 uppercase letters, numbers, or underscores
- First character after ROLE_ must be a letter

Valid examples: ROLE_USER, ROLE_BILLING_ADMIN, ROLE_SUPPORT_TIER_1
Invalid examples: ROLE_A (too short), ROLE_admin (lowercase), ROLE-ADMIN (hyphen)`,
        example: 'ROLE_BILLING_ADMIN',
      }),
    description: z.string().optional(),
    parentId: z.string().cuid().optional(),
  })
);

const UpdateRoleSchema = registry.register(
  'UpdateRole',
  z.object({
    description: z.string().nullable().optional(),
    parentId: z.string().cuid().nullable().optional(),
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

registry.registerPath({
  method: 'get',
  path: '/api/admin/roles',
  summary: 'List All Roles',
  description: 'List all roles with hierarchy info and user counts. Requires ROLE_ADMIN access.',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'List of roles',
      content: {
        'application/json': {
          schema: z.object({
            roles: z.array(RoleSchema),
          }),
        },
      },
    },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
    403: { description: 'Forbidden - ROLE_ADMIN required', content: { 'application/json': { schema: ErrorSchema } } },
    500: { description: 'Internal Server Error', content: { 'application/json': { schema: ErrorSchema } } },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/admin/roles',
  summary: 'Create a New Role',
  description: 'Create a new platform role. Requires ROLE_ADMIN access.',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateRoleSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Role created successfully',
      content: {
        'application/json': {
          schema: z.object({
            role: RoleSchema,
          }),
        },
      },
    },
    400: { description: 'Validation Error', content: { 'application/json': { schema: ErrorSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
    403: { description: 'Forbidden - ROLE_ADMIN required', content: { 'application/json': { schema: ErrorSchema } } },
    409: { description: 'Conflict - Role name already exists', content: { 'application/json': { schema: ErrorSchema } } },
    429: { description: 'Rate Limit Exceeded', content: { 'application/json': { schema: ErrorSchema } } },
    500: { description: 'Internal Server Error', content: { 'application/json': { schema: ErrorSchema } } },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/admin/roles/{id}',
  summary: 'Get Role Details',
  description: 'Get single role with paginated users list and child roles. Requires ROLE_ADMIN access.',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      id: z.string().cuid().openapi({
        description: 'Role ID (CUID format)',
        example: 'clabcd1234567890',
      }),
    }),
    query: z.object({
      usersLimit: z
        .string()
        .optional()
        .openapi({
          description: 'Maximum number of users to return (max 100)',
          example: '10',
        }),
      usersOffset: z
        .string()
        .optional()
        .openapi({
          description: 'Offset for user pagination',
          example: '0',
        }),
    }),
  },
  responses: {
    200: {
      description: 'Role details',
      content: {
        'application/json': {
          schema: z.object({
            role: RoleDetailSchema,
          }),
        },
      },
    },
    400: { description: 'Validation Error', content: { 'application/json': { schema: ErrorSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
    403: { description: 'Forbidden - ROLE_ADMIN required', content: { 'application/json': { schema: ErrorSchema } } },
    404: { description: 'Role not found', content: { 'application/json': { schema: ErrorSchema } } },
    500: { description: 'Internal Server Error', content: { 'application/json': { schema: ErrorSchema } } },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/admin/roles/{id}',
  summary: 'Update Role',
  description: 'Update role description and/or parent. Cannot update system roles. Requires ROLE_ADMIN access.',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      id: z.string().cuid().openapi({
        description: 'Role ID (CUID format)',
        example: 'clabcd1234567890',
      }),
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdateRoleSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Role updated successfully',
      content: {
        'application/json': {
          schema: z.object({
            role: RoleSchema,
          }),
        },
      },
    },
    400: { description: 'Validation Error', content: { 'application/json': { schema: ErrorSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
    403: { description: 'Forbidden - ROLE_ADMIN required', content: { 'application/json': { schema: ErrorSchema } } },
    404: { description: 'Role not found', content: { 'application/json': { schema: ErrorSchema } } },
    429: { description: 'Rate Limit Exceeded', content: { 'application/json': { schema: ErrorSchema } } },
    500: { description: 'Internal Server Error', content: { 'application/json': { schema: ErrorSchema } } },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/admin/roles/{id}',
  summary: 'Delete Role',
  description: 'Delete a non-system role. Cannot delete roles with assigned users or child roles. Requires ROLE_ADMIN access.',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      id: z.string().cuid().openapi({
        description: 'Role ID (CUID format)',
        example: 'clabcd1234567890',
      }),
    }),
  },
  responses: {
    200: {
      description: 'Role deleted successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
          }),
        },
      },
    },
    400: { description: 'Validation Error - Cannot delete system roles or roles with users/children', content: { 'application/json': { schema: ErrorSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
    403: { description: 'Forbidden - ROLE_ADMIN required', content: { 'application/json': { schema: ErrorSchema } } },
    404: { description: 'Role not found', content: { 'application/json': { schema: ErrorSchema } } },
    429: { description: 'Rate Limit Exceeded', content: { 'application/json': { schema: ErrorSchema } } },
    500: { description: 'Internal Server Error', content: { 'application/json': { schema: ErrorSchema } } },
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
