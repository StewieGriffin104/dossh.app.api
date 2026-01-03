# /register 路由实现文档

## 概述

创建一个 POST `/register` 路由，用于记录用户注册尝试。该路由需要验证请求参数的有效性，并检查设备是否存在于数据库中。

---

## 实现流程图

```
POST /register
    ↓
[Step 1] 参数验证
    - 检查 phone, email, ip, deviceId 是否都存在
    - 如果缺少任何参数 → 返回 400 Bad Request
    ↓
[Step 2] 设备ID校验
    - 查询数据库中是否存在该 deviceId
    - 如果不存在 → 返回 400 Device Not Found
    ↓
[Step 3] 创建注册尝试记录
    - 在 registration_attempts 表中插入新记录
    - action: "registering"
    - result: "pending" (或其他初始状态)
    ↓
[Step 4] 返回成功响应
    - 返回 201 Created
    - 返回创建的记录详情
```

---

## 涉及文件修改

### 1. **src/schemas/registration.js**

- ✅ 已经定义好 `CreateRegistrationAttemptBody` schema
- ✅ 已经定义好 `CreateRegistrationAttemptSchema` schema

### 2. **src/flow/register-flow.js**

- ❌ 需要完成 `userRegister` 函数实现
- 功能：执行业务逻辑（参数验证、设备校验、创建记录）

### 3. **src/routes/registration.js**

- ✅ 路由已经开始定义
- ❌ 需要完成路由处理器的实现
- 功能：调用 `userRegister` 函数，返回响应

---

## 详细实现步骤

### Step 1: 参数验证（在 Flow 层）

**位置**：`src/flow/register-flow.js` - `userRegister` 函数

验证所有必需参数：

```javascript
const { phone, email, deviceId } = request.body;
const ip = request.ip;

// 检查是否所有参数都存在
if (!phone || !email || !deviceId || !ip) {
  throw new Error("Missing required fields: phone, email, deviceId, ip");
}
```

**错误处理**：如果缺少参数，应该抛出错误让路由层处理，返回 400 状态码

---

### Step 2: 设备ID校验（在 Flow 层）

**位置**：`src/flow/register-flow.js` - `userRegister` 函数

从数据库中查询设备是否存在：

```javascript
const { device: deviceRepo } = fastify.repos;

// 验证 deviceId 是否存在
const existingDevice = await deviceRepo.findById(deviceId);

if (!existingDevice) {
  throw new DeviceFlowError("Device ID does not exist or is invalid");
}
```

**注意**：使用之前创建的 `DeviceFlowError` 自定义错误

---

### Step 3: 创建注册尝试记录（在 Flow 层）

**位置**：`src/flow/register-flow.js` - `userRegister` 函数

在 registration_attempts 表中插入新记录：

```javascript
const { registrationAttempts: registrationAttemptsRepo } = fastify.repos;
const { randomUUID } = require("crypto");

const attemptId = randomUUID();

const registrationAttempt = await registrationAttemptsRepo.create({
  id: attemptId,
  phone,
  email,
  ip,
  deviceId,
  action: "registering",
  result: "pending",
  devicesId: deviceId,
});

return registrationAttempt;
```

---

### Step 4: 路由处理器（在 Route 层）

**位置**：`src/routes/registration.js` - POST `/register` 处理器

```javascript
async (request, reply) => {
  try {
    // 调用 Flow 函数执行业务逻辑
    const registrationAttempt = await userRegister(request, fastify);

    // 返回 201 Created 成功响应
    return reply.code(201).send({
      success: true,
      data: registrationAttempt,
    });
  } catch (error) {
    // 处理不同类型的错误
    if (error.name === "DeviceFlowError") {
      // 设备相关错误
      return reply.code(400).send({
        success: false,
        error: "Invalid Device",
        message: error.message,
      });
    } else if (error.message.includes("Missing required fields")) {
      // 参数验证错误
      return reply.code(400).send({
        success: false,
        error: "Invalid Request",
        message: error.message,
      });
    }

    // 其他未知错误
    request.log.error(error, "Registration error");
    return reply.code(500).send({
      success: false,
      error: "Internal Server Error",
      message: "Failed to create registration attempt",
    });
  }
};
```

---

## 完整实现代码

### src/flow/register-flow.js

```javascript
import { randomUUID } from "crypto";
import { DeviceFlowError } from "../custom-error/flow/device-flow.js";

/**
 * User registration flow
 * Validates registration request and creates registration attempt record
 * @param {Object} request - Fastify request object
 * @param {Object} fastify - Fastify instance
 * @returns {Promise<Object>} Created registration attempt
 * @throws {DeviceFlowError} If device does not exist
 * @throws {Error} If required fields are missing
 */
export const userRegister = async (request, fastify) => {
  const logger = request.log;
  const { phone, email, deviceId } = request.body;
  const ip = request.ip;

  // Step 1: 验证所有必需参数
  if (!phone || !email || !deviceId || !ip) {
    throw new Error("Missing required fields: phone, email, deviceId, ip");
  }

  logger.info({ phone, email, deviceId }, "Starting registration attempt");

  // Step 2: 获取 repositories
  const { device: deviceRepo, registrationAttempts: registrationAttemptsRepo } = fastify.repos;

  // Step 3: 验证 deviceId 是否存在
  const existingDevice = await deviceRepo.findById(deviceId);

  if (!existingDevice) {
    logger.warn({ deviceId }, "Device not found");
    throw new DeviceFlowError("Device ID does not exist or is invalid");
  }

  logger.info({ deviceId }, "Device validation passed");

  // Step 4: 创建注册尝试记录
  const attemptId = randomUUID();

  const registrationAttempt = await registrationAttemptsRepo.create({
    id: attemptId,
    phone,
    email,
    ip,
    deviceId,
    action: "registering",
    result: "pending",
    devicesId: deviceId,
  });

  logger.info({ attemptId, deviceId }, "Registration attempt created");

  return registrationAttempt;
};
```

### src/routes/registration.js (POST /register 部分)

```javascript
// POST /api/register - Record a registration attempt
fastify.post(
  "/register",
  {
    schema: CreateRegistrationAttemptSchema,
  },
  async (request, reply) => {
    try {
      // 调用 Flow 函数执行业务逻辑
      const registrationAttempt = await userRegister(request, fastify);

      // 返回 201 Created 成功响应
      return reply.code(201).send({
        success: true,
        data: registrationAttempt,
      });
    } catch (error) {
      // 处理不同类型的错误
      if (error.name === "DeviceFlowError") {
        // 设备相关错误 - 返回 400
        return reply.code(400).send({
          success: false,
          error: "Invalid Device",
          message: error.message,
        });
      } else if (error.message.includes("Missing required fields")) {
        // 参数验证错误 - 返回 400
        return reply.code(400).send({
          success: false,
          error: "Invalid Request",
          message: error.message,
        });
      }

      // 其他未知错误 - 返回 500
      request.log.error(error, "Registration error");
      return reply.code(500).send({
        success: false,
        error: "Internal Server Error",
        message: "Failed to create registration attempt",
      });
    }
  }
);
```

---

## 错误响应示例

### 1. 缺少参数 (400 Bad Request)

```json
{
  "success": false,
  "error": "Invalid Request",
  "message": "Missing required fields: phone, email, deviceId, ip"
}
```

### 2. Device ID 不存在 (400 Bad Request)

```json
{
  "success": false,
  "error": "Invalid Device",
  "message": "Device Flow Error: Device ID does not exist or is invalid"
}
```

### 3. 成功创建 (201 Created)

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "phone": "+1234567890",
    "email": "user@example.com",
    "ip": "192.168.1.1",
    "deviceId": "device-123",
    "action": "registering",
    "result": "pending",
    "createdAt": "2025-12-19T10:30:00.000Z"
  }
}
```

---

## 核心要点总结

| 层级      | 文件                                                      | 职责                                                 |
| --------- | --------------------------------------------------------- | ---------------------------------------------------- |
| **Route** | `src/routes/registration.js`                              | 接收请求，调用Flow，返回HTTP响应，处理HTTP级别的错误 |
| **Flow**  | `src/flow/register-flow.js`                               | 验证参数，查询设备，创建记录，抛出业务逻辑错误       |
| **Repo**  | `src/repo/device.js`, `src/repo/registration_attempts.js` | 数据库操作                                           |
| **Error** | `src/custom-error/flow/device-flow.js`                    | 自定义错误类                                         |

---

## 验证检查清单

- [ ] ✅ Schema已定义（`CreateRegistrationAttemptSchema`）
- [ ] ❌ Flow函数已完成（需要实现）
- [ ] ❌ 路由处理器已完成（需要实现）
- [ ] ✅ 自定义错误已创建（`DeviceFlowError`）
- [ ] ✅ Repository方法已存在（`deviceRepo.findById`, `registrationAttemptsRepo.create`）
- [ ] ❌ 导入语句已添加（需要在register-flow.js中导入DeviceFlowError）
