# OTP 重新发送功能实施计划

## 1. 功能概述

实现新的 API 端点 `/api/otp/resend`，用于在 OTP 过期或尚未发送时重新生成和发送 OTP。

### 1.1 端点信息

- **路由**: `POST /api/otp/resend`
- **前缀**: `/api/otp`
- **请求参数**: customerId, phone, email, deviceId
- **响应**: success (true) + data 中包含 OTP 信息（或指示已有有效 OTP）

---

## 2. 核心业务逻辑

### 2.0 防频繁请求策略

为了防止恶意用户或意外操作导致频繁调用此 API，在 OTP 刚过期时触发新的生成，系统实现了**"冷却期"**机制：

- **冷却时间**: 2 分钟
- **触发条件**: 当前时间 - OTP 过期时间 <= 2 分钟
- **处理方式**: 返回 429 Too Soon 错误，提示用户稍后再试
- **目的**: 减少数据库压力，防止恶意重复请求

**示例场景:**

```
13:00:00 - 用户收到 OTP，过期时间设为 13:05:00
13:05:30 - 用户请求 resend (OTP 已过期 30 秒)
         → 返回 429 错误（还在 2 分钟冷却期内）
13:07:10 - 用户请求 resend (OTP 已过期 2 分 10 秒)
         → 生成新 OTP（超出 2 分钟冷却期）
```

### 2.1 流程描述

```
1. 接收请求 (customerId, phone, email, deviceId)
   ↓
2. 验证请求参数的完整性和有效性
   ↓
3. 查询数据库，获取该 customerId 对应的 registration_token
   - 条件: phone, email, deviceId 匹配，status = 'pending'
   ↓
4. 检查现有 OTP 是否过期
   ├─ 如果未过期 (expiresAt > now)
   │  └─ 返回 200，success: true，data 中包含 token 信息
   │
   └─ 如果已过期 (expiresAt <= now)
      ├─ 检查防频繁请求保护 ⭐️ 新增
      │  (now - expiresAt <= 2分钟 ?)
      │  ├─ 是 → 返回 429 Too Soon 错误 (防止频繁请求)
      │  │  └─ error: "OTP_RECENTLY_EXPIRED"
      │  │     message: "OTP 刚过期，请稍等再重试"
      │  │
      │  └─ 否 → 继续生成新 OTP
      │     ├─ 生成新的 OTP
      │     ├─ 计算新的过期时间 (当前时间 + 5分钟)
      │     ├─ 更新 registration_tokens 记录
      │     │  - token (新的 OTP)
      │     │  - tokenHash (hash 后的新 OTP)
      │     │  - expiresAt (新的过期时间)
      │     │  - attempts 重置为 0
      │     ├─ 发送 SMS 和 Email
      │     └─ 返回 201，success: true，data 中包含新的 token 信息
```

---

## 3. 文件清单

### 3.1 需要创建的文件

| 文件路径               | 类型   | 用途                            | 优先级 |
| ---------------------- | ------ | ------------------------------- | ------ |
| `src/routes/otp.js`    | Route  | 定义 `/otp/resend` 端点         | P1     |
| `src/flow/otp-flow.js` | Flow   | 实现 OTP 重新发送的业务逻辑     | P1     |
| `src/schemas/otp.js`   | Schema | 定义 OTP 相关的请求/响应 schema | P1     |

### 3.2 需要修改的文件

| 文件路径                          | 修改内容                                                   | 优先级 |
| --------------------------------- | ---------------------------------------------------------- | ------ |
| `src/routes/index.js`             | 注册新的 `/api/otp` 路由前缀                               | P1     |
| `src/repo/registration-tokens.js` | 添加新方法 `findByCustomerAndDetails()` 和 `updateToken()` | P1     |

### 3.3 不需要修改的文件（参考用）

| 文件路径                | 原因                                        |
| ----------------------- | ------------------------------------------- |
| `src/lib/send-email.js` | 已有发送邮件的功能                          |
| `src/lib/send-sms.js`   | 已有发送短信的功能                          |
| `src/utils/otp.js`      | 已有生成 OTP 的函数                         |
| `src/utils/crypto.js`   | 已有 hash 函数                              |
| `prisma/schema.prisma`  | 无需修改，使用现有 `registration_tokens` 表 |

---

## 4. 数据库检查清单

### 4.1 registration_tokens 表需要的字段

需要在该表中进行以下操作：

| 操作     | 字段                   | 说明                     |
| -------- | ---------------------- | ------------------------ |
| **查询** | phone, email, deviceId | 用于定位特定的 OTP 记录  |
| **查询** | expiresAt              | 检查 OTP 是否过期        |
| **查询** | status                 | 确保状态是 'pending'     |
| **查询** | token                  | 返回给前端（如果未过期） |
| **更新** | token                  | 设置新生成的 OTP         |
| **更新** | tokenHash              | 设置新 OTP 的 hash       |
| **更新** | expiresAt              | 设置新的过期时间         |
| **更新** | attempts               | 重置为 0                 |
| **更新** | updatedAt              | 自动更新时间戳           |

### 4.2 关键字段说明

```javascript
// 现有 registration_tokens 表字段
{
  id: String,              // 唯一标识符
  phone: String,           // 用于查询
  email: String,           // 用于查询
  token: String,           // OTP 本身
  tokenHash: String,       // OTP 的哈希值
  tokenType: String,       // "sms" 或 "email"
  expiresAt: DateTime,     // 过期时间 - 关键检查点
  status: String,          // "pending", "verified", "completed"
  devicesId: String,       // 设备 ID 外键
  attempts: Int,           // 尝试次数
  maxAttempts: Int,        // 最大尝试次数
  createdAt: DateTime,     // 创建时间
  verifiedAt: DateTime,    // 验证时间
  meta: Json,              // 附加数据
}
```

---

## 5. Repository 层增强

### 5.1 需要添加的方法到 `RegistrationTokensRepo`

#### 方法 1: `findByCustomerAndDetails()`

```javascript
/**
 * 根据客户信息和设备查找 registration token
 * @param {Object} params
 * @param {string} params.phone - 电话号码
 * @param {string} params.email - 邮箱
 * @param {string} params.deviceId - 设备 ID
 * @returns {Promise<Object|null>} registration_token 记录或 null
 */
async findByCustomerAndDetails({ phone, email, deviceId })
```

**实现要点:**

- 查询条件: `phone` AND `email` AND `deviceId`
- 状态过滤: `status === 'pending'`
- 排序: 按 `createdAt` 降序（获取最新的）

#### 方法 2: `updateToken()`

```javascript
/**
 * 更新已存在的 token 记录
 * @param {string} id - token ID
 * @param {Object} updateData - 更新数据
 * @returns {Promise<Object>} 更新后的 token 记录
 */
async updateToken(id, updateData)
```

**实现要点:**

- 更新字段: `token`, `tokenHash`, `expiresAt`, `attempts`, `updatedAt`
- 返回完整的更新后记录

---

## 6. Schema 定义

### 6.1 新建 `src/schemas/otp.js` 包含的 Schema

#### Schema 1: ResendOtpBody (请求体)

```javascript
export const ResendOtpBody = Type.Object({
  customerId: Type.String({ format: "uuid" }),
  phone: Type.String(),
  email: Type.String({ format: "email" }),
  deviceId: Type.String(),
});
```

#### Schema 2: ResendOtpResponse (响应数据)

```javascript
export const ResendOtpResponse = Type.Object({
  // 标识是否新生成了 OTP
  isNew: Type.Boolean(),
  // OTP 过期时间
  expiresAt: DateTimeString,
  // OTP 本身（可选，看业务需求是否返回）
  token: Type.Optional(Type.String()),
});
```

---

## 7. Flow 层实现

### 7.1 新建 `src/flow/otp-flow.js`

#### 函数: `resendOtp()`

```javascript
/**
 * 重新发送 OTP
 * - 如果已有未过期的 OTP，直接返回
 * - 如果 OTP 已过期但在冷却期内（<2分钟），返回错误
 * - 如果 OTP 已过期且超过冷却期（>=2分钟），生成新的并更新数据库
 * @param {Object} request - Fastify request 对象
 * @param {Object} fastify - Fastify 实例
 * @returns {Promise<Object>} 包含 isNew, expiresAt, token 的对象
 * @throws {OtpFlowError} 如果 OTP 在冷却期内
 */
export const resendOtp = async (request, fastify) => {
  // 1. 解构参数
  const { customerId, phone, email, deviceId } = request.body;
  const logger = request.log;

  // 2. 访问仓储
  const { registrationTokens: regTokenRepo } = fastify.repos;

  // 3. 查询现有 token
  // 调用 registrationTokens repo 的 findByCustomerAndDetails()

  // 4. 检查过期状态
  const now = new Date();
  // 比较 token.expiresAt 与 now

  // 5.1 如果未过期 (expiresAt > now)
  // 返回 { isNew: false, expiresAt, token }

  // 5.2 如果已过期 (expiresAt <= now)
  // - 计算冷却期时间差 (now - expiresAt)
  // - 检查是否在 2 分钟冷却期内
  //   ├─ 是 → 抛出 OtpFlowError("OTP_RECENTLY_EXPIRED")
  //   │      供 route 层捕获并返回 429
  //   │
  //   └─ 否 → 继续生成新 OTP
  //      ├─ 生成新 OTP (generateOTP())
  //      ├─ 计算新过期时间 (now + 5分钟)
  //      ├─ 计算 tokenHash (hash(newOtp))
  //      ├─ 调用 registrationTokens repo 的 updateToken()
  //      ├─ 发送 SMS (sendSms())
  //      ├─ 发送 Email (sendEmail())
  //      └─ 返回 { isNew: true, expiresAt, token: newOtp }
};
```

**冷却期检查逻辑:**

```javascript
const COOLDOWN_PERIOD = 2 * 60 * 1000; // 2 分钟（毫秒）
const timeSinceExpiry = now.getTime() - token.expiresAt.getTime();

if (timeSinceExpiry <= COOLDOWN_PERIOD) {
  throw new OtpFlowError("OTP_RECENTLY_EXPIRED", {
    error: "OTP_RECENTLY_EXPIRED",
    message: "OTP 最近过期，请在 2 分钟后再试",
    expiresAt: token.expiresAt,
    retryAfter: new Date(token.expiresAt.getTime() + COOLDOWN_PERIOD),
  });
}
```

---

## 8. Route 层实现

### 8.1 新建 `src/routes/otp.js`

#### 端点: `POST /resend`

```javascript
fastify.post(
  "/resend",
  {
    schema: {
      tags: ["otp"],
      description: "重新发送 OTP 或返回现有未过期的 OTP，实现冷却期保护防止频繁请求",
      summary: "OTP 重新发送（带冷却期保护）",
      body: ResendOtpBody,
      response: {
        200: SuccessResponse(ResendOtpResponse), // 返回现有有效 OTP
        201: SuccessResponse(ResendOtpResponse), // 生成并返回新 OTP
        400: Type.Object({
          success: Type.Boolean(),
          error: Type.String(),
          message: Type.String(),
        }),
        404: Type.Object({
          success: Type.Boolean(),
          error: Type.String(),
          message: Type.String(),
        }),
        429: Type.Object({
          // ⭐️ 新增：冷却期错误
          success: Type.Boolean(),
          error: Type.String(),
          message: Type.String(),
          retryAfter: Type.String({ format: "date-time" }),
        }),
        500: Type.Object({
          success: Type.Boolean(),
          error: Type.String(),
          message: Type.String(),
        }),
      },
    },
  },
  async (request, reply) => {
    // 1. 参数验证
    // 2. 调用 flow 层的 resendOtp()
    // 3. 根据 isNew 返回不同的状态码 (200 or 201)
    // 4. 错误处理
    //    - 捕获 OtpFlowError("OTP_RECENTLY_EXPIRED") → 返回 429
    //    - 其他错误按原规则处理
  }
);
```

**429 错误响应示例:**

```json
{
  "success": false,
  "error": "OTP_RECENTLY_EXPIRED",
  "message": "OTP 最近过期，请在 2 分钟后再试",
  "retryAfter": "2025-12-21T13:07:00.000Z"
}
```

---

## 9. 路由注册

### 9.1 修改 `src/routes/index.js`

在现有注册逻辑中添加：

```javascript
import otpRoutes from "./otp.js";

export function registerRoutes(fastify) {
  // 现有路由...
  fastify.register(customersRoutes, { prefix: "/api/customers" });
  fastify.register(registrationRoutes, { prefix: "/api/registration" });
  fastify.register(deviceRoutes, { prefix: "/api/device" });

  // 新增路由
  fastify.register(otpRoutes, { prefix: "/api/otp" });

  fastify.log.info("Routes registered successfully");
}
```

---

## 10. 错误处理策略

### 10.1 可能的错误情况

| 错误情况                     | HTTP 状态码 | 错误类型               | 说明                                        |
| ---------------------------- | ----------- | ---------------------- | ------------------------------------------- |
| 缺少必需参数                 | 400         | InvalidRequest         | 参数不完整                                  |
| 找不到对应的 token           | 404         | TokenNotFound          | 该客户没有 OTP 记录                         |
| **OTP 最近过期（冷却期内）** | **429**     | **OtpRecentlyExpired** | **防频繁请求：OTP 过期不到 2 分钟** ⭐️ 新增 |
| 发送 SMS/Email 失败          | 500         | SendingFailed          | 通知服务失败                                |
| 数据库更新失败               | 500         | DatabaseError          | 更新 token 失败                             |
| 其他异常                     | 500         | InternalServerError    | 未预期的错误                                |

### 10.2 错误处理实现

在 `otp.js` route 中使用 try-catch 和自定义错误类（如 `OtpFlowError`）

---

## 11. 测试清单

### 11.1 单元测试场景

- [ ] 未过期 OTP 存在 → 返回 200 + 现有 OTP
- [ ] **过期 OTP 在冷却期内（<2分钟）→ 返回 429 + 重试时间** ⭐️ 新增
- [ ] **过期 OTP 超出冷却期（>=2分钟）→ 返回 201 + 新生成的 OTP** ⭐️ 修改
- [ ] 没有 OTP 记录 → 返回 404
- [ ] 缺少参数 → 返回 400
- [ ] SMS/Email 发送失败 → 返回 500

### 11.2 手动测试

#### 测试场景 1: 过期 OTP 在冷却期内

```
1. 创建一个 OTP，设置过期时间为 now - 1 分钟
2. POST /api/otp/resend
   {
     "customerId": "uuid",
     "phone": "+8613800000000",
     "email": "user@example.com",
     "deviceId": "device-uuid"
   }
3. 预期响应: 429 Too Soon
   {
     "success": false,
     "error": "OTP_RECENTLY_EXPIRED",
     "message": "OTP 最近过期，请在 2 分钟后再试",
     "retryAfter": "2025-12-21T13:07:00.000Z"
   }
```

#### 测试场景 2: 过期 OTP 超出冷却期

```
1. 创建一个 OTP，设置过期时间为 now - 3 分钟
2. POST /api/otp/resend
   {
     "customerId": "uuid",
     "phone": "+8613800000000",
     "email": "user@example.com",
     "deviceId": "device-uuid"
   }
3. 预期响应: 201 Created
   {
     "success": true,
     "data": {
       "isNew": true,
       "expiresAt": "2025-12-21T13:08:00.000Z",
       "token": "123456"
     }
   }
```

---

## 12. 实施步骤

### 第一阶段: 数据层

1. ✅ 分析 `registration_tokens` 表的现有方法
2. ⏳ 添加 `findByCustomerAndDetails()` 方法到 `RegistrationTokensRepo`
3. ⏳ 添加 `updateToken()` 方法到 `RegistrationTokensRepo`

### 第二阶段: Schema 层

4. ⏳ 创建 `src/schemas/otp.js`
5. ⏳ 定义 `ResendOtpBody` 和 `ResendOtpResponse`

### 第三阶段: 业务逻辑层

6. ⏳ 创建 `src/flow/otp-flow.js`
7. ⏳ 实现 `resendOtp()` 函数

### 第四阶段: API 层

8. ⏳ 创建 `src/routes/otp.js`
9. ⏳ 实现 `/resend` 端点

### 第五阶段: 整合

10. ⏳ 修改 `src/routes/index.js` 注册新路由
11. ⏳ 验证路由在 Swagger 中显示

### 第六阶段: 验证

12. ⏳ 单元测试
13. ⏳ 手动测试所有场景
14. ⏳ 代码审查和格式化

---

## 13. 参考信息

### 13.1 现有相似实现参考

- **类似流程**: `src/flow/register-flow.js` 中的 OTP 生成和发送逻辑
- **参考 Repo**: `src/repo/registration-tokens.js` 中的查询和更新方法
- **参考 Schema**: `src/schemas/registration.js` 中的响应格式

### 13.2 关键工具函数

```javascript
// 已存在的工具函数
import { generateOTP } from "../utils/otp.js"; // 生成 OTP
import { hash } from "../utils/crypto.js"; // Hash 函数
import { sendSms } from "../lib/send-sms.js"; // 发送 SMS
import { sendEmail } from "../lib/send-email.js"; // 发送 Email
```

---

## 14. 成功标准

实现完成后应满足：

- ✅ 所有新文件都按照项目架构规范创建
- ✅ 代码遵循 `developmentPrinciple.md` 中的所有规范
- ✅ 通过所有错误场景的处理
- ✅ Swagger 文档完整准确
- ✅ 通过所有手动测试场景
- ✅ ESLint 验证通过
- ✅ 代码审查无误

---

## 总结

```
新增文件数: 3 个
修改文件数: 2 个
新增 Repo 方法数: 2 个
新增核心特性: 冷却期保护（2分钟）防止频繁请求 ⭐️
预计代码行数: 350-450 行（含冷却期逻辑）
预计开发时间: 1.5-2.5 小时

核心改进:
✅ 原有逻辑：过期 → 直接生成新 OTP
✅ 改进后：过期 → 检查冷却期 → 根据冷却期决定是否生成
✅ 防护作用：防止恶意频繁请求导致数据库压力
✅ 用户体验：明确的错误提示和建议重试时间
```
