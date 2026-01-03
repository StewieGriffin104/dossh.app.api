# Customer Update & Inactive API 实现计划

## 概述

本文档描述如何实现两个受保护的客户API端点：

- `PATCH /api/customers/update` - 更新当前登录用户的信息
- `POST /api/customers/inactive` - 停用当前登录用户的账户

## 核心设计原则

### 1. 安全性设计

- **JWT验证必需**：这两个端点都必须验证JWT token
- **用户身份验证**：从token中提取customerId，确保用户只能操作自己的数据
- **无需传递customerId**：customerId从JWT token中获取，不从请求body获取，防止越权操作

### 2. 路由保护策略

#### 需要JWT验证的路由（使用 `fastify.authenticate`）

- `/api/customers/*` - 所有客户相关操作
- `/api/protected/*` - 明确标记为受保护的资源
- 任何涉及用户个人数据的CRUD操作

#### 不需要JWT验证的路由

- `/api/registration/*` - 注册流程（用户还没有token）
- `/api/device/create` - 设备注册（首次使用，没有token）
- `/api/otp/*` - OTP验证（注册/登录流程的一部分）
- `/health` - 健康检查

---

## API 设计

### 1. PATCH /api/customers/update

**功能**：更新当前登录用户的个人信息

**认证**：必需（使用 `fastify.authenticate`）

**请求**：

```http
PATCH /api/customers/update
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "username": "johndoe",
  "phone": "+1234567890"
}
```

**响应 200**：

```json
{
  "success": true,
  "data": {
    "id": "customer-uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "username": "johndoe",
    "phone": "+1234567890",
    "updatedAt": "2025-12-23T10:30:00Z"
  }
}
```

**响应 400**：

```json
{
  "success": false,
  "error": "Validation error",
  "message": "Invalid phone number format"
}
```

**响应 401**：

```json
{
  "success": false,
  "error": "Authentication failed",
  "message": "Access token has expired"
}
```

**响应 404**：

```json
{
  "success": false,
  "error": "Customer not found",
  "message": "Customer account does not exist"
}
```

**业务逻辑**：

1. 从JWT token提取customerId（由 `fastify.authenticate` 完成）
2. 验证请求body的字段（firstName, lastName, username, phone）
3. 验证phone格式（如果提供）
4. 检查username/phone是否已被其他用户使用（唯一性）
5. 更新数据库中的customer记录
6. 更新updatedAt时间戳
7. 返回更新后的用户信息

---

### 2. POST /api/customers/inactive

**功能**：停用当前登录用户的账户

**认证**：必需（使用 `fastify.authenticate`）

**请求**：

```http
POST /api/customers/inactive
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "reason": "No longer need the service"
}
```

**响应 200**：

```json
{
  "success": true,
  "data": {
    "id": "customer-uuid",
    "email": "user@example.com",
    "isActive": false,
    "deactivatedAt": "2025-12-23T10:30:00Z"
  }
}
```

**响应 401**：

```json
{
  "success": false,
  "error": "Authentication failed",
  "message": "Invalid access token"
}
```

**响应 404**：

```json
{
  "success": false,
  "error": "Customer not found",
  "message": "Customer account does not exist"
}
```

**响应 409**：

```json
{
  "success": false,
  "error": "Account already inactive",
  "message": "This account is already inactive"
}
```

**业务逻辑**：

1. 从JWT token提取customerId
2. 检查customer是否存在
3. 检查customer是否已经inactive
4. 设置 `isActive = false`
5. 可选：记录停用原因到meta字段或日志
6. 可选：同时停用关联的account记录
7. 更新updatedAt时间戳
8. 返回结果

---

## 需要创建/修改的文件

### 1. 创建 Schema 文件

**文件**：`src/schemas/customer.js`

**内容**：

```javascript
import { Type } from "@sinclair/typebox";
import { DateTimeString, OptionalString } from "./common.js";

// Request schemas
export const UpdateCustomerBody = Type.Object({
  firstName: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  lastName: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  username: Type.Optional(Type.String({ minLength: 3, maxLength: 50 })),
  phone: Type.Optional(Type.String({ pattern: "^\\+?[1-9]\\d{1,14}$" })),
});

export const InactiveCustomerBody = Type.Object({
  reason: Type.Optional(Type.String({ minLength: 1, maxLength: 500 })),
});

// Response schemas
export const CustomerResponse = Type.Object({
  id: Type.String(),
  email: Type.String(),
  firstName: Type.Union([Type.String(), Type.Null()]),
  lastName: Type.Union([Type.String(), Type.Null()]),
  username: Type.Union([Type.String(), Type.Null()]),
  phone: Type.Union([Type.String(), Type.Null()]),
  isActive: Type.Boolean(),
  updatedAt: DateTimeString,
});

export const InactiveCustomerResponse = Type.Object({
  id: Type.String(),
  email: Type.String(),
  isActive: Type.Boolean(),
  deactivatedAt: DateTimeString,
});
```

---

### 2. 扩展 Repository

**文件**：`src/repo/customer.js`

**添加方法**：

```javascript
/**
 * Update customer by ID
 * @param {string} customerId - Customer ID
 * @param {Object} data - Update data
 * @param {string} [data.firstName] - First name
 * @param {string} [data.lastName] - Last name
 * @param {string} [data.username] - Username
 * @param {string} [data.phone] - Phone number
 * @returns {Promise<Object>} Updated customer
 */
async update(customerId, data) {
  return this.prisma.customers.update({
    where: { id: customerId },
    data: {
      ...data,
      updatedAt: new Date(),
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      username: true,
      phone: true,
      isActive: true,
      updatedAt: true,
    },
  });
}

/**
 * Check if username is already taken by another customer
 * @param {string} username - Username to check
 * @param {string} excludeCustomerId - Customer ID to exclude from check
 * @returns {Promise<boolean>} True if username exists
 */
async usernameExists(username, excludeCustomerId) {
  const customer = await this.prisma.customers.findFirst({
    where: {
      username,
      id: { not: excludeCustomerId },
    },
  });
  return !!customer;
}

/**
 * Check if phone is already taken by another customer
 * @param {string} phone - Phone to check
 * @param {string} excludeCustomerId - Customer ID to exclude from check
 * @returns {Promise<boolean>} True if phone exists
 */
async phoneExists(phone, excludeCustomerId) {
  const customer = await this.prisma.customers.findFirst({
    where: {
      phone,
      id: { not: excludeCustomerId },
    },
  });
  return !!customer;
}

/**
 * Deactivate customer account
 * @param {string} customerId - Customer ID
 * @returns {Promise<Object>} Updated customer
 */
async deactivate(customerId) {
  return this.prisma.customers.update({
    where: { id: customerId },
    data: {
      isActive: false,
      updatedAt: new Date(),
    },
    select: {
      id: true,
      email: true,
      isActive: true,
      updatedAt: true,
    },
  });
}

/**
 * Find customer by ID
 * @param {string} customerId - Customer ID
 * @returns {Promise<Object|null>} Customer or null
 */
async findById(customerId) {
  return this.prisma.customers.findUnique({
    where: { id: customerId },
  });
}
```

---

### 3. 创建 Flow 层（可选，用于复杂业务逻辑）

**文件**：`src/flow/customer-flow.js`

**内容**：

```javascript
/**
 * Update customer information with validation
 * @param {Object} request - Fastify request object
 * @param {Object} fastify - Fastify instance
 * @returns {Promise<Object>} Updated customer
 */
export const updateCustomerInfo = async (request, fastify) => {
  const { customers: customerRepo } = fastify.repos;
  const logger = request.log;
  const { customerId } = request.user; // From JWT token
  const updateData = request.body;

  logger.info({ customerId }, "Updating customer information");

  // Validate uniqueness if username or phone is being updated
  if (updateData.username) {
    const usernameExists = await customerRepo.usernameExists(updateData.username, customerId);
    if (usernameExists) {
      throw new Error("Username is already taken");
    }
  }

  if (updateData.phone) {
    const phoneExists = await customerRepo.phoneExists(updateData.phone, customerId);
    if (phoneExists) {
      throw new Error("Phone number is already registered");
    }
  }

  // Update customer
  const updatedCustomer = await customerRepo.update(customerId, updateData);

  logger.info({ customerId }, "Customer information updated successfully");
  return updatedCustomer;
};

/**
 * Deactivate customer account
 * @param {Object} request - Fastify request object
 * @param {Object} fastify - Fastify instance
 * @returns {Promise<Object>} Deactivated customer info
 */
export const deactivateCustomerAccount = async (request, fastify) => {
  const { customers: customerRepo } = fastify.repos;
  const logger = request.log;
  const { customerId } = request.user; // From JWT token
  const { reason } = request.body;

  logger.info({ customerId, reason }, "Deactivating customer account");

  // Check if customer exists and is active
  const customer = await customerRepo.findById(customerId);
  if (!customer) {
    throw new Error("Customer not found");
  }

  if (!customer.isActive) {
    throw new Error("Account is already inactive");
  }

  // Deactivate customer
  const result = await customerRepo.deactivate(customerId);

  // Optional: Also deactivate related account
  // const account = await fastify.prisma.accounts.findUnique({
  //   where: { customerId }
  // });
  // if (account) {
  //   await fastify.prisma.accounts.update({
  //     where: { id: account.id },
  //     data: { isActive: false, updatedAt: new Date() }
  //   });
  // }

  logger.info({ customerId }, "Customer account deactivated successfully");

  return {
    ...result,
    deactivatedAt: result.updatedAt,
  };
};
```

---

### 4. 更新 Routes

**文件**：`src/routes/customers.js`

**添加路由**：

```javascript
import { Type } from "@sinclair/typebox";
import { SuccessResponse } from "../schemas/common.js";
import {
  UpdateCustomerBody,
  InactiveCustomerBody,
  CustomerResponse,
  InactiveCustomerResponse,
} from "../schemas/customer.js";
import { updateCustomerInfo, deactivateCustomerAccount } from "../flow/customer-flow.js";

export default async function customersRoutes(fastify) {
  // ... existing routes ...

  // PATCH /api/customers/update - Update current user's information
  fastify.patch(
    "/update",
    {
      preHandler: fastify.authenticate, // JWT verification required
      schema: {
        tags: ["customers"],
        description: "Update authenticated customer's information",
        summary: "Update customer info (requires authentication)",
        security: [{ bearerAuth: [] }],
        body: UpdateCustomerBody,
        response: {
          200: SuccessResponse(CustomerResponse),
          400: Type.Object({
            success: Type.Boolean(),
            error: Type.String(),
            message: Type.String(),
          }),
          401: Type.Object({
            success: Type.Boolean(),
            error: Type.String(),
            message: Type.String(),
          }),
          404: Type.Object({
            success: Type.Boolean(),
            error: Type.String(),
            message: Type.String(),
          }),
        },
      },
    },
    async (request, reply) => {
      try {
        const updatedCustomer = await updateCustomerInfo(request, fastify);

        return reply.code(200).send({
          success: true,
          data: updatedCustomer,
        });
      } catch (error) {
        request.log.error({ error }, "Failed to update customer");

        // Handle specific errors
        if (
          error.message.includes("already taken") ||
          error.message.includes("already registered")
        ) {
          return reply.code(400).send({
            success: false,
            error: "Validation error",
            message: error.message,
          });
        }

        if (error.message === "Customer not found") {
          return reply.code(404).send({
            success: false,
            error: "Customer not found",
            message: error.message,
          });
        }

        return reply.code(500).send({
          success: false,
          error: "Failed to update customer",
          message: error.message,
        });
      }
    }
  );

  // POST /api/customers/inactive - Deactivate current user's account
  fastify.post(
    "/inactive",
    {
      preHandler: fastify.authenticate, // JWT verification required
      schema: {
        tags: ["customers"],
        description: "Deactivate authenticated customer's account",
        summary: "Deactivate customer account (requires authentication)",
        security: [{ bearerAuth: [] }],
        body: InactiveCustomerBody,
        response: {
          200: SuccessResponse(InactiveCustomerResponse),
          401: Type.Object({
            success: Type.Boolean(),
            error: Type.String(),
            message: Type.String(),
          }),
          404: Type.Object({
            success: Type.Boolean(),
            error: Type.String(),
            message: Type.String(),
          }),
          409: Type.Object({
            success: Type.Boolean(),
            error: Type.String(),
            message: Type.String(),
          }),
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await deactivateCustomerAccount(request, fastify);

        return reply.code(200).send({
          success: true,
          data: result,
        });
      } catch (error) {
        request.log.error({ error }, "Failed to deactivate customer");

        if (error.message === "Customer not found") {
          return reply.code(404).send({
            success: false,
            error: "Customer not found",
            message: error.message,
          });
        }

        if (error.message === "Account is already inactive") {
          return reply.code(409).send({
            success: false,
            error: "Account already inactive",
            message: error.message,
          });
        }

        return reply.code(500).send({
          success: false,
          error: "Failed to deactivate account",
          message: error.message,
        });
      }
    }
  );
}
```

---

## 实现步骤清单

### Step 1: 创建 Schemas

- [ ] 创建 `src/schemas/customer.js`
- [ ] 定义 `UpdateCustomerBody`
- [ ] 定义 `InactiveCustomerBody`
- [ ] 定义 `CustomerResponse`
- [ ] 定义 `InactiveCustomerResponse`

### Step 2: 扩展 Repository

- [ ] 编辑 `src/repo/customer.js`
- [ ] 添加 `update()` 方法
- [ ] 添加 `deactivate()` 方法
- [ ] 添加 `findById()` 方法
- [ ] 添加 `usernameExists()` 方法
- [ ] 添加 `phoneExists()` 方法

### Step 3: 创建 Flow 层

- [ ] 创建 `src/flow/customer-flow.js`
- [ ] 实现 `updateCustomerInfo()` 函数
- [ ] 实现 `deactivateCustomerAccount()` 函数
- [ ] 添加业务逻辑验证（唯一性检查等）

### Step 4: 更新 Routes

- [ ] 编辑 `src/routes/customers.js`
- [ ] 导入 schemas 和 flow 函数
- [ ] 添加 `PATCH /update` 路由
- [ ] 添加 `POST /inactive` 路由
- [ ] 添加 `preHandler: fastify.authenticate`
- [ ] 实现错误处理

### Step 5: 测试

- [ ] 生成有效的JWT token（通过登录或注册）
- [ ] 在Swagger UI测试 `/api/customers/update`
- [ ] 在Swagger UI测试 `/api/customers/inactive`
- [ ] 测试无token的情况（应返回401）
- [ ] 测试无效token的情况（应返回401）
- [ ] 测试username/phone重复的情况（应返回400）
- [ ] 测试已经inactive的账户（应返回409）

---

## JWT认证流程说明

### 1. Token生成（登录/注册后）

```javascript
const accessToken = generateAccessToken({
  customerId: "customer-uuid",
  email: "user@example.com",
  deviceId: "device-uuid"
});

// 返回给客户端
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}
```

### 2. 受保护路由的请求

```http
PATCH /api/customers/update
Authorization: Bearer eyJhbGc...
Content-Type: application/json

{
  "firstName": "John"
}
```

### 3. 服务器验证流程

```
1. fastify.authenticate 中间件执行
2. 提取 Authorization header
3. 验证 Bearer token 格式
4. 调用 verifyAccessToken(token)
5. 解码获取 { customerId, email, deviceId }
6. 注入到 request.user
7. 继续执行路由处理器
```

### 4. 路由处理器使用

```javascript
async (request, reply) => {
  // request.user 已经包含验证后的信息
  const { customerId, email, deviceId } = request.user;

  // 使用 customerId 进行数据库操作
  // 用户只能操作自己的数据，无法越权
};
```

---

## 关键安全要点

### ✅ 正确做法

1. **从token获取customerId**，不从请求body获取
2. 使用 `preHandler: fastify.authenticate` 保护路由
3. 验证唯一性（username, phone）时排除当前用户
4. 明确的错误消息但不泄露敏感信息
5. 记录所有重要操作（logging）

### ❌ 避免的错误

1. ~~从request body接收customerId~~（容易被篡改）
2. ~~允许用户更新其他用户的数据~~
3. ~~忘记添加 `fastify.authenticate`~~
4. ~~返回过于详细的错误信息~~（如"User with ID X not found"）
5. ~~忘记更新 `updatedAt` 时间戳~~

---

## 测试示例

### 1. 测试更新用户信息

```bash
# 1. 先获取token（假设已经登录）
TOKEN="eyJhbGc..."

# 2. 更新用户信息
curl -X PATCH http://localhost:3000/api/customers/update \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "username": "johndoe2025"
  }'

# 预期结果：200 OK
{
  "success": true,
  "data": {
    "id": "...",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "username": "johndoe2025",
    "updatedAt": "2025-12-23T10:30:00Z"
  }
}
```

### 2. 测试停用账户

```bash
curl -X POST http://localhost:3000/api/customers/inactive \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "No longer using the service"
  }'

# 预期结果：200 OK
{
  "success": true,
  "data": {
    "id": "...",
    "email": "user@example.com",
    "isActive": false,
    "deactivatedAt": "2025-12-23T10:30:00Z"
  }
}
```

### 3. 测试未授权访问

```bash
curl -X PATCH http://localhost:3000/api/customers/update \
  -H "Content-Type: application/json" \
  -d '{"firstName": "Hacker"}'

# 预期结果：401 Unauthorized
{
  "success": false,
  "error": "Missing authorization header",
  "message": "Authorization header is required"
}
```

---

## 总结

这个实现方案遵循了项目的开发原则：

1. **分层架构**：Routes → Flow → Repositories → Prisma
2. **安全优先**：JWT验证 + customerId从token提取
3. **Schema验证**：所有输入使用TypeBox验证
4. **错误处理**：全面的try-catch和明确的错误响应
5. **文档完整**：Swagger自动生成API文档
6. **代码质量**：JSDoc注释 + ESLint规范

按照这个计划，你可以安全地实现客户信息更新和账户停用功能。
