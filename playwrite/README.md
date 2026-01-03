# Playwright Test Suite for Dossh App API

完整的 API 集成测试套件，使用 Playwright 进行真实 HTTP 请求测试，并验证数据库状态。

## 📁 文件结构

```
playwrite/
├── helpers/
│   ├── db-helper.js          # 数据库辅助函数（清理、查询）
│   └── api-helper.js         # API 请求辅助函数
├── registration-success.spec.js   # 注册成功场景测试
├── verification-success.spec.js   # 验证成功场景测试
└── registration-errors.spec.js    # 错误场景测试
```

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install --save-dev @playwright/test
npx playwright install
```

### 2. 启动 API 服务

```bash
npm run dev
```

### 3. 运行测试

```bash
# 运行所有测试
npm test

# 以 UI 模式运行
npm run test:ui

# 以有头模式运行（显示浏览器）
npm run test:headed

# 调试模式
npm run test:debug

# 查看测试报告
npm run test:report
```

## 📋 测试覆盖

### ✅ 注册流程成功场景 (registration-success.spec.js)

1. **完整注册流程**
   - 创建设备 → 初始化注册 → 验证 OTP
   - 验证所有数据库表记录正确
   - 验证 token 过期时间
   - 验证密码哈希
   - 验证设备关联

2. **多用户同时注册**
   - 验证数据隔离
   - 验证并发处理

3. **密码哈希验证**
   - 确保密码不以明文存储

4. **设备关联验证**
   - 验证 customer-device 关系

5. **事务完整性**
   - 确保所有记录在单个事务中创建

### ✅ 验证流程测试 (verification-success.spec.js)

1. **成功验证 OTP**
   - 激活客户账户
   - 标记 token 为已验证
   - 创建账户记录

2. **使用邮箱验证**
   - 支持 phone 或 email 验证

3. **账户创建**
   - 验证账户类型和计划

4. **时间戳验证**
   - 验证 verifiedAt 时间戳

5. **成功记录**
   - 验证成功的 registration_attempts

### ❌ 错误场景测试 (registration-errors.spec.js)

1. **设备验证失败**
   - 设备不存在
   - 设备未激活
   - 设备被封禁

2. **缺少必填字段**
   - 验证字段完整性

3. **OTP 验证失败**
   - 无效 OTP
   - Token 不存在
   - Token 已过期

4. **失败次数限制**
   - 增加失败次数
   - 达到最大次数后封禁设备

5. **手机号封禁**
   - 验证封禁逻辑

## 🔍 数据库验证

每个测试都会验证以下数据库表：

- ✅ `devices` - 设备记录
- ✅ `registration_attempts` - 注册尝试记录
- ✅ `registration_tokens` - OTP token
- ✅ `sms_events` - SMS 发送事件
- ✅ `customers` - 客户记录
- ✅ `accounts` - 账户记录
- ✅ `blocks` - 封禁记录

## 🛠️ 辅助函数

### db-helper.js

```javascript
// 清理数据库
await cleanDatabase();

// 生成测试数据
const testData = generateTestData();

// 获取最新 OTP
const otp = await getLatestOTP(phone);

// 断开数据库连接
await disconnectDatabase();
```

### api-helper.js

```javascript
// 创建设备
const deviceRes = await createDevice(request, { deviceFingerprint: 'fp-123' });

// 初始化注册
const initRes = await initRegistration(request, {
  phone: '+1234567890',
  email: 'test@example.com',
  deviceId: 'device-123',
});

// 验证 OTP
const verifyRes = await verifyOTP(request, {
  phone: '+1234567890',
  otp: '123456',
  deviceId: 'device-123',
});

// 解析响应
const { status, ok, body } = await parseResponse(response);
```

## ⚙️ 配置

在 `playwright.config.js` 中配置：

- `workers: 1` - 单线程执行，避免数据库冲突
- `fullyParallel: false` - 顺序执行测试
- `webServer` - 自动启动/停止 API 服务

## 📊 测试报告

运行测试后，查看 HTML 报告：

```bash
npm run test:report
```

## 💡 最佳实践

1. **每个测试独立** - 使用 `beforeEach` 清理数据库
2. **真实数据** - 从数据库获取真实 OTP，而非 mock
3. **完整验证** - 验证 API 响应和数据库状态
4. **错误场景** - 测试所有可能的失败路径
5. **清理资源** - 使用 `afterAll` 断开数据库连接

## 🔒 环境变量

确保设置正确的数据库连接：

```env
DATABASE_URL=postgresql://user:password@localhost:5432/dossh_test
```

## 📝 添加新测试

1. 在 `playwrite/` 目录创建新的 `.spec.js` 文件
2. 导入辅助函数
3. 使用 `test.describe` 分组测试
4. 在 `beforeEach` 中清理数据库
5. 编写测试用例
6. 验证 API 响应和数据库状态

示例：

```javascript
import { test, expect } from '@playwright/test';
import { prisma, cleanDatabase } from './helpers/db-helper.js';

test.describe('My New Test', () => {
  test.beforeEach(async () => {
    await cleanDatabase();
  });

  test('should do something', async ({ request }) => {
    // 测试代码
  });
});
```

## 🐛 调试

使用 Playwright Inspector 调试：

```bash
npm run test:debug
```

或在测试中添加 `await page.pause()` 暂停执行。

## 📈 持续集成

在 CI/CD 中运行测试：

```bash
npx playwright test --reporter=github
```

---

**作者**: Dossh Team
**最后更新**: 2025-12-20
