# AI Development Principles

## Project Overview

This is a Fastify-based REST API for the Dossh App, built with Node.js, Prisma ORM, PostgreSQL, and TypeBox for schema validation. The project follows a clean architecture pattern with clear separation of concerns.

---

## 1. Architecture & Project Structure

### 1.1 Layer Separation

- **Routes** (`src/routes/`): Handle HTTP requests/responses, schema validation, and orchestration
- **Repositories** (`src/repo/`): Encapsulate all database operations using Prisma
- **Schemas** (`src/schemas/`): Define TypeBox validation schemas for requests/responses
- **Plugins** (`src/plugins/`): Register Fastify plugins and cross-cutting concerns
- **Config** (`src/config/`): Centralize configuration and environment variables
- **Flow** (`src/flow/`): Business logic and multi-step workflows

### 1.2 Dependency Direction

```
Routes → Flow → Repositories → Prisma Client
Routes → Schemas (for validation)
```

**Rules:**

- Routes should delegate business logic to Flow layer
- Flow layer contains business logic and orchestrates repository calls
- **Never** create circular dependencies
- **Never** bypass the repository layer to access Prisma directly
- **Never** put business logic directly in routes

---

## 1.3 Flow Layer Best Practices

The Flow layer (`src/flow/`) contains business logic and multi-step workflows. Follow these principles:

### Use Functional Programming, Not Classes

**ALWAYS** use pure functions with `export const`. **NEVER** use classes for Flow logic.

```javascript
// ✅ CORRECT - Functional approach
export const createDevice = async (request, fastify) => {
  const { device: deviceRepo } = fastify.repos;
  const { log: logger } = request;
  const data = request.body;

  // Business logic here
  logger.info("Creating device");
  const result = await deviceRepo.create(data);
  return result;
};

// ❌ WRONG - Class-based approach (increases complexity)
export class DeviceFlow {
  constructor(deviceRepo, logger) {
    this.deviceRepo = deviceRepo;
    this.logger = logger;
  }

  async createDevice(data) {
    // ...
  }
}
```

### Function Signature Pattern

Flow functions should **ALWAYS** accept `request` and `fastify` as the first two parameters:

```javascript
export const flowFunction = async (request, fastify) => {
  // Access repositories
  const { repo1, repo2 } = fastify.repos;

  // Access logger
  const logger = request.log;

  // Access request data
  const data = request.body;
  const params = request.params;
  const query = request.query;

  // Business logic
  // ...
};
```

**Benefits:**

- Direct access to all Fastify instances (repos, config, etc.)
- Consistent logger (request-scoped)
- No need to manually pass individual dependencies
- Easier to test and mock
- Reduces code complexity

### Flow Organization

- One file per domain (e.g., `device-flow.js`, `user-flow.js`)
- Export multiple functions from same file if related
- Keep functions focused and single-purpose
- Add comprehensive JSDoc comments

**Example Flow File:**

```javascript
// src/flow/device-flow.js
import { randomUUID } from "crypto";

/**
 * Create a new device
 * @param {Object} request - Fastify request object
 * @param {Object} fastify - Fastify instance
 * @returns {Promise<Object>} Created device data
 */
export const createDevice = async (request, fastify) => {
  const { device: deviceRepo } = fastify.repos;
  const logger = request.log;
  const { id: providedId, ...deviceData } = request.body;

  const id = providedId || randomUUID();
  logger.info({ id }, "Creating new device");

  const device = await deviceRepo.create({ id, ...deviceData });

  logger.info({ deviceId: device.id }, "Device created");
  return device;
};

/**
 * Update device status
 * @param {Object} request - Fastify request object
 * @param {Object} fastify - Fastify instance
 * @returns {Promise<Object>} Updated device
 */
export const updateDeviceStatus = async (request, fastify) => {
  const { device: deviceRepo } = fastify.repos;
  const logger = request.log;
  // ... implementation
};
```

---

## 2. Code Style & Standards

### 2.1 JavaScript Modern Features

- **ALWAYS** use ES6+ modules (`import/export`, not `require`)
- **ALWAYS** use `const` by default, `let` only when reassignment is necessary
- **NEVER** use `var`
- **ALWAYS** use arrow functions for callbacks and short functions
- **ALWAYS** use async/await instead of raw Promises or callbacks
- **ALWAYS** use template literals for string interpolation

### 2.2 File Organization

- One main export per file (default export for routes, named exports for utilities)
- Group related functionality together
- Keep files focused and single-purpose (generally < 200 lines)

### 2.3 Naming Conventions

- **Files**: camelCase for multi-word names (e.g., `device.js`, `registration_attempts.js`)
- **Classes**: PascalCase with descriptive suffixes (e.g., `DeviceRepo`, `CreateDeviceBody`)
- **Functions**: camelCase, verb-based (e.g., `createDevice`, `findById`)
- **Constants**: UPPER_SNAKE_CASE for configuration (e.g., `DATABASE_URL`, `PORT`)
- **Variables**: camelCase, descriptive names

### 2.4 JSDoc Documentation Standards

**ALWAYS** document functions with comprehensive JSDoc comments following this pattern:

```javascript
/**
 * Brief description of what the function does.
 *
 * Optional longer description with additional details about the function's
 * behavior, side effects, or important considerations.
 *
 * @function
 * @param {Object} params - Parameters required for the function.
 * @param {string|number} params.customerId - Unique user identifier (customerId), used as JWT subject (sub).
 * @param {string} params.email - User email address.
 * @param {string} [params.deviceId] - Device unique identifier (optional, use square brackets for optional params).
 * @returns {string} JWT access token string.
 *
 * @example
 * const token = generateAccessToken({ customerId: 123, email: 'user@example.com', deviceId: 'device-001' });
 */
export const generateAccessToken = ({ customerId, email, deviceId }) => {
  // Implementation
};
```

**Required Elements:**

1. **Description**: Clear explanation of the function's purpose
2. **@function**: Tag to identify it as a function
3. **@param**: Document each parameter with:
   - Type (using JSDoc type syntax)
   - Name (use `params.propertyName` for object properties)
   - Description (include purpose and constraints)
   - Use square brackets `[param]` for optional parameters
4. **@returns**: Specify return type and description
5. **@example**: Provide at least one usage example

**For Object Parameters:**

- Document each property of the object separately
- Use `params.propertyName` notation
- Specify types for each property (e.g., `{string}`, `{number}`, `{string|number}`)
- Mark optional properties with square brackets

**Additional JSDoc Tags (when applicable):**

```javascript
/**
 * @async - For async functions
 * @throws {Error} Description of error conditions
 * @deprecated Use newFunction() instead
 * @see {@link relatedFunction} - Link to related functions
 */
```

**Benefits:**

- Better IDE autocomplete and IntelliSense
- Clear understanding of inputs/outputs without reading code
- Easy to generate API documentation
- Helps catch type-related bugs early

---

## 3. Fastify-Specific Patterns

### 3.1 Route Definition

Always follow this structure for routes:

```javascript
fastify.method(
  "/path",
  {
    schema: {
      tags: ["category"],
      description: "Detailed description",
      summary: "Brief summary",
      body: BodySchema, // Import from schemas folder
      params: ParamsSchema, // Import from schemas folder
      querystring: QuerySchema, // Import from schemas folder
      response: {
        200: SuccessResponse(DataSchema),
        // other status codes as needed
      },
    },
  },
  async (request, reply) => {
    // Implementation
  }
);
```

**Important**:

- **NEVER** define schemas inline in routes
- **ALWAYS** import schemas from the `src/schemas/` folder
- If a schema doesn't exist for your domain (e.g., `user`, `device`, `registration`), create a new file in `src/schemas/` following the naming convention (e.g., `user.js`, `product.js`)
- Group all related schemas for a domain in the same file

### 3.2 Plugin Registration

- Register plugins in correct order (see `src/plugins/index.js`)
- Logger → Prisma → Repositories → Other plugins
- Use `fastify-plugin` for utilities that need to be available globally

### 3.3 Error Handling

```javascript
try {
  // Operation
  return reply.code(201).send({
    success: true,
    data: result,
  });
} catch (error) {
  return reply.code(500).send({
    success: false,
    error: "Brief error message",
    message: error.message,
  });
}
```

---

## 4. Database & Prisma

### 4.1 Repository Pattern

**ALWAYS** use the repository pattern. **NEVER** access `prisma` directly from routes.

```javascript
// ✅ CORRECT - Use repository
const device = await deviceRepo.create(data);

// ❌ WRONG - Direct Prisma access from route
const device = await fastify.prisma.devices.create({ data });
```

### 4.2 Repository Implementation

- Define repositories in `src/repo/`
- Each repository class should:
  - Accept `prisma` instance in constructor
  - Include JSDoc comments for all methods
  - Document all parameters and return types
  - Handle `updatedAt` timestamps explicitly
  - Use descriptive method names (e.g., `findById`, `updateStatus`, `deleteByCustomerId`)

### 4.3 Prisma Best Practices

- Use `findUnique` for single records by unique field
- Use `findFirst` for single records with filters
- Use `findMany` for lists with proper pagination
- Always update `updatedAt` field when modifying records
- Use transactions for multi-step operations

### 4.4 Database Updates

```bash
# After modifying schema.prisma
npm run prisma:pull      # Pull from database
npm run prisma:generate  # Generate Prisma Client
# or
npm run db:local:update  # Do both
```

---

## 5. Schema Validation with TypeBox

### 5.1 Schema Definition

**File Organization by Domain:**

- **ALWAYS** define schemas in `src/schemas/` folder
- **One file per domain** - Group all related schemas for a domain together (e.g., `device.js`, `registration.js`, `customer.js`)
- **Check before creating** - Before creating a new schema file, verify that a similar domain file doesn't already exist
- Export reusable schema components from `common.js`

**Creating New Schema Files:**

When you need to add schemas for a new feature or domain:

1. **Check existing schemas** - Look in `src/schemas/` for similar domains
2. **Create domain-specific file** if none exists:
   - File name: lowercase, singular noun (e.g., `user.js`, `product.js`, `transaction.js`)
   - Location: `src/schemas/[domain].js`
3. **Include all related schemas** in one file:
   - Request body schemas (e.g., `CreateUserBody`, `UpdateUserBody`)
   - Query parameter schemas (e.g., `UserQueryParams`)
   - URL parameter schemas (e.g., `UserIdParams`)
   - Response schemas (e.g., `UserResponse`, `UserListItem`)
4. **Export from index** - Add your new schema file to `src/schemas/index.js`

**Example Schema File Structure:**

```javascript
// src/schemas/user.js
import { Type } from "@sinclair/typebox";
import { OptionalString, DateTimeString } from "./common.js";

// Request schemas
export const CreateUserBody = Type.Object({
  email: Type.String({ format: "email" }),
  firstName: OptionalString,
  lastName: OptionalString,
});

export const UpdateUserBody = Type.Partial(CreateUserBody);

export const UserIdParams = Type.Object({
  id: Type.String({ format: "uuid" }),
});

export const UserQueryParams = Type.Object({
  page: Type.Optional(Type.Number({ minimum: 1 })),
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
});

// Response schemas
export const UserResponse = Type.Object({
  id: Type.String(),
  email: Type.String(),
  firstName: Type.Union([Type.String(), Type.Null()]),
  lastName: Type.Union([Type.String(), Type.Null()]),
  createdAt: DateTimeString,
});

export const UserListItem = Type.Object({
  id: Type.String(),
  email: Type.String(),
  firstName: Type.Union([Type.String(), Type.Null()]),
});
```

### 5.2 Common Patterns

```javascript
// Reusable types
export const OptionalString = Type.Optional(Type.String());
export const DateTimeString = Type.String({ format: "date-time" });

// Response wrapper
export const SuccessResponse = (dataSchema) =>
  Type.Object({
    success: Type.Boolean(),
    data: dataSchema,
  });

// Nullable fields from database
Type.Union([Type.String(), Type.Null()]);
```

### 5.3 Schema Usage

- Define schemas separately, not inline in routes
- Reuse common schema components
- Keep request/response schemas synchronized with database models

---

## 6. Logging

### 6.1 Logger Usage

```javascript
// Use Fastify's logger
fastify.log.info("Informational message");
fastify.log.warn("Warning message");
fastify.log.error(error, "Error message");
fastify.log.debug("Debug information");

// In routes
request.log.info("Request-scoped log");
```

### 6.2 Logging Standards

- Log all important operations (creates, updates, deletes)
- Log errors with full context
- Use appropriate log levels
- Never log sensitive data (passwords, tokens, PII)

---

## 7. Error Handling & Validation

### 7.1 Input Validation

- **ALWAYS** validate input using TypeBox schemas
- **ALWAYS** validate at the route level before processing
- Sanitize user input when necessary
- Use proper HTTP status codes

### 7.2 Error Response Format

```javascript
{
  success: false,
  error: "Brief error category",
  message: "Detailed error message"
}
```

### 7.3 Status Codes

- `200`: Success (GET, PATCH, DELETE)
- `201`: Created successfully (POST)
- `400`: Bad request (validation errors)
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not found
- `409`: Conflict (duplicate, constraint violation)
- `500`: Internal server error

---

## 8. Security

### 8.1 Required Practices

- **NEVER** commit `.env` files or secrets
- **ALWAYS** use environment variables for sensitive data
- **ALWAYS** hash passwords (use `passwordHash` field)
- **ALWAYS** validate and sanitize user input
- Use helmet for security headers (already configured)
- Use CORS appropriately (currently allows all origins in dev)

### 8.2 Database Security

- Use parameterized queries (Prisma handles this)
- Never construct raw SQL with user input
- Implement rate limiting for sensitive endpoints
- Track registration attempts and block suspicious activity

---

## 9. API Design

### 9.1 RESTful Conventions

- Use proper HTTP methods (GET, POST, PUT, PATCH, DELETE)
- Use plural nouns for resources (`/devices`, `/customers`)
- Use clear, descriptive endpoint names
- Version your API if needed (`/v1/...`)

### 9.2 Response Format

Always return consistent response structure:

```javascript
// Success
{
  success: true,
  data: { /* actual data */ }
}

// Error
{
  success: false,
  error: "error_category",
  message: "Detailed message"
}
```

### 9.3 Swagger Documentation

- **ALWAYS** add complete schema definitions to routes
- Include `tags`, `description`, and `summary`
- Document all request/response schemas
- Test endpoints in Swagger UI before committing

---

## 10. Code Quality

### 10.1 ESLint

- Run `npm run lint` before committing
- Fix issues with `npm run lint:fix`
- Follow configured rules (see `eslint.config.js`)
- Pre-commit hooks will enforce linting

### 10.2 Code Review Checklist

- [ ] All routes have complete schema definitions
- [ ] Database operations use repositories
- [ ] Error handling is comprehensive
- [ ] Logging is appropriate
- [ ] No sensitive data in logs or responses
- [ ] Variable names are descriptive
- [ ] **JSDoc comments for all public functions** (with @param, @returns, @example)
- [ ] No unused imports or variables
- [ ] Consistent code style

---

## 11. Development Workflow

### 11.1 Environment Setup

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env  # Then edit .env

# Generate Prisma Client
npm run prisma:generate

# Start development server
npm run dev
```

### 11.2 Development Commands

```bash
npm run dev              # Development with auto-reload
npm run lint             # Check code style
npm run lint:fix         # Fix code style issues
npm run prisma:studio    # Open Prisma Studio
npm run db:local:update  # Update DB schema
```

### 11.3 Docker Workflow

```bash
npm run docker:build     # Build image
npm run docker:run       # Run container
npm run docker:start     # Build and run
```

---

## 12. Testing (Future Implementation)

### 12.1 Test Structure (To Be Implemented)

- Unit tests for repositories
- Integration tests for routes
- E2E tests for critical flows
- Test coverage > 80%

### 12.2 Testing Principles

- Write tests before implementing features (TDD when appropriate)
- Mock external dependencies
- Use descriptive test names
- Test happy paths and error cases

---

## 13. Deployment

### 13.1 AWS Copilot

```bash
npm run deploy:dev          # Deploy to dev environment
npm run deploy:service:dev  # Deploy service only
```

### 13.2 Pre-Deployment Checklist

- [ ] All tests passing
- [ ] Linting passes
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Swagger documentation up to date
- [ ] No console.log in production code (use logger)

---

## 14. AI-Assisted Development Guidelines

### 14.1 When Adding New Features

1. **Understand the existing pattern** - Review similar implementations first
2. **Follow the architecture** - Maintain layer separation (Routes → Flow → Repos)
3. **Create/update schemas first**:
   - Check if domain schema file exists in `src/schemas/`
   - If not, create new schema file (e.g., `user.js`, `product.js`)
   - Define all request/response schemas (body, params, query, response)
   - Export from `src/schemas/index.js`
4. **Implement repository** - Add database operations to appropriate repo in `src/repo/`
5. **Implement flow (if needed)** - Create/update flow functions for business logic in `src/flow/`
   - Use functional approach: `export const functionName = async (request, fastify) => {}`
   - **Never** use classes for flow logic
   - Access repos via `fastify.repos`, logger via `request.log`, data via `request.body`
6. **Create route** - Implement route that calls flow functions
   - Import flow functions from `src/flow/`
   - Pass `request` and `fastify` to flow functions
   - Handle responses and errors at route level
7. **Update documentation** - Swagger docs are auto-generated from schemas
8. **Test manually** - Verify in Swagger UI and with real requests
9. **Lint and format** - Run `npm run lint:fix`

### 14.2 When Modifying Existing Code

1. **Read the full context** - Understand the current implementation
2. **Maintain consistency** - Match existing code style and patterns
3. **Update related code** - Don't forget schemas, repos, and docs
4. **Check dependencies** - Ensure changes don't break other parts
5. **Test thoroughly** - Verify all affected endpoints

### 14.3 Code Generation Rules

- Generate code that matches existing patterns exactly
- Include all necessary imports
- Add JSDoc comments for public functions
- Include proper error handling
- Add appropriate logging statements
- Never use deprecated or anti-patterns

### 14.4 Problem-Solving Approach

1. **Search before creating** - Check if functionality exists
2. **Reuse before reimplementing** - Use existing utilities
3. **Ask before assuming** - Clarify requirements if unclear
4. **Test before claiming completion** - Verify it works
5. **Document as you go** - Update docs immediately

---

## 15. Common Pitfalls to Avoid

### ❌ Don't Do This

```javascript
// Direct Prisma access from routes
const device = await fastify.prisma.devices.create({ data });

// Inline schemas - NEVER do this
fastify.post(
  "/create",
  {
    schema: {
      body: Type.Object({ name: Type.String() }),
    },
  },
  handler
);

// Missing error handling
const device = await deviceRepo.create(data);
return reply.send(device);

// Using var
var deviceId = request.body.id;

// Missing schema validation
fastify.post("/create", async (request, reply) => {
  /* ... */

// Using class for Flow logic
export class DeviceFlow {
  constructor(repo) { this.repo = repo; }
  async create(data) { /* ... */ }
}
```

### ✅ Do This Instead

`````javascript
// Use repositories
const device = await deviceRepo.create(data);

// Define schemas in separate file (src/schemas/device.js)
// Then import and use:
import { CreateDeviceBody } from "../schemas/device.js";

// Use functional approach for Flow
export const createDevice = async (request, fastify) => {
  const { device: deviceRepo } = fastify.repos;
  const logger = request.log;
  // Business logic
}

````javascript
// Use repositories
const device = await deviceRepo.create(data);

// Define schemas in separate file (src/schemas/device.js)
// Then import and use:
import { CreateDeviceBody } from "../schemas/device.js";

// Complete error handling
try {
  const device = await deviceRepo.create(data);
  return reply.code(201).send({ success: true, data: device });
} catch (error) {
  return reply.code(500).send({
    success: false,
    error: "Failed to create device",
    message: error.message,
  });
}

// Use const/let
const deviceId = request.body.id;

// Include schema validation
fastify.post("/create", { schema: { body: CreateDeviceBody } }, handler);

// Use environment variables
const apiUrl = config.API_URL;

// Use logger
fastify.log.info({ device }, "Device created");
`````

---

## 16. Versioning & Updates

Flow → Repos → Prisma 3. **Functional Flow** - Use pure functions, never classes for Flow layer 4. **Validation First** - Always use TypeBox schemas from schemas folder 5. **Error Handling** - Comprehensive try-catch with proper responses 6. **Documentation** - Complete Swagger schemas for all endpoints 7. **Security** - Never expose sensitive data, validate all input 8. **Logging** - Use Fastify logger (request.log), never console.log 9. **Modern JS** - ES6+, async/await, const/let, arrow functions 10. **Repository Pattern** - Never bypass the data access layer 11. **Flow Signature** - Always use `(request, fastify)` as parameters
12# 16.2 API Versioning

- When making breaking changes, consider API versioning
- Deprecate old endpoints before removing
- Communicate changes to API consumers
- Maintain backward compatibility when possible

---

## Summary: Core Principles

1. **Consistency** - Follow established patterns religiously
2. **Separation of Concerns** - Routes → Repos → Prisma
3. **Validation First** - Always use TypeBox schemas
4. **Error Handling** - Comprehensive try-catch with proper responses
5. **Documentation** - Complete Swagger schemas for all endpoints
6. **Security** - Never expose sensitive data, validate all input
7. **Logging** - Use Fastify logger, never console.log
8. **Modern JS** - ES6+, async/await, const/let, arrow functions
9. **Repository Pattern** - Never bypass the data access layer
10. **Code Quality** - Lint, format, and review before committing

---

**Remember**: When in doubt, look at existing code and follow the same pattern. Consistency is more important than cleverness.

```

```
