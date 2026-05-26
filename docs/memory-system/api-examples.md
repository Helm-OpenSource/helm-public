---
status: active
owner: helm-core
created: 2026-03-15
review_after: 2026-06-13
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# 记忆系统 API 示例

## 文档目的

本文件用于给“经营分身控制台”记忆系统提供接口示例。

目标：
1. 让前后端都能快速对齐请求和响应结构
2. 让 Codex 在实现 API 时有明确参考
3. 让后续联调、演示、测试更顺畅

本文只提供第一阶段的代表性示例，不代表最终完整协议。

---

## 一、通用约定

### 1. 接口风格
- 使用 JSON
- 时间统一使用 ISO 8601
- 所有写接口都返回：
  - `success`
  - `data`
  - `message`
- 错误返回统一：
  - `success: false`
  - `errorCode`
  - `message`

### 2. 对象类型枚举示例
- CONTACT
- COMPANY
- OPPORTUNITY
- MEETING
- ACTION_ITEM
- APPROVAL_TASK
- POLICY_RULE
- EMAIL_THREAD

### 3. 来源类型枚举示例
- EMAIL_MESSAGE
- EMAIL_THREAD
- MEETING_NOTE
- MEETING
- ACTION_ITEM
- APPROVAL_TASK
- POLICY_RULE
- CSV_IMPORT
- USER_EDIT
- SYSTEM_INFERENCE

---

## 二、Memory Facts

### 1. 获取对象记忆列表

**Request**

`GET /api/memory/facts?objectType=CONTACT&objectId=contact_001`

**Response**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "mf_001",
        "factType": "PREFERENCE",
        "title": "偏好简洁邮件",
        "content": "该联系人更偏好简洁直接的沟通方式",
        "confidence": 82,
        "importance": 70,
        "freshnessScore": 65,
        "status": "ACTIVE",
        "confirmedByUser": true,
        "sourceType": "USER_EDIT",
        "sourceId": "user_edit_001",
        "createdAt": "2026-03-15T08:10:00.000Z",
        "updatedAt": "2026-03-15T08:10:00.000Z"
      }
    ],
    "activeFacts": [
      {
        "id": "mf_001",
        "factType": "PREFERENCE",
        "title": "偏好简洁邮件",
        "content": "该联系人更偏好简洁直接的沟通方式",
        "confidence": 82,
        "importance": 70,
        "freshnessScore": 65,
        "status": "ACTIVE",
        "confirmedByUser": true,
        "sourceType": "USER_EDIT",
        "sourceId": "user_edit_001",
        "createdAt": "2026-03-15T08:10:00.000Z",
        "updatedAt": "2026-03-15T08:10:00.000Z"
      }
    ],
    "observedFacts": [],
    "archivedFacts": [],
    "invalidFacts": [],
    "pageInfo": {
      "limit": 50,
      "maxLimit": 100,
      "hasNextPage": false,
      "nextCursor": null,
      "appliedCursor": null,
      "bounded": true
    }
  },
  "message": "ok"
}
```

---

### 2. 创建记忆事实

**Request**

`POST /api/memory/facts`

```json
{
  "objectType": "OPPORTUNITY",
  "objectId": "opp_123",
  "factType": "NEXT_STEP",
  "title": "下周发送方案",
  "content": "客户希望下周三前收到方案初稿",
  "sourceType": "MEETING_NOTE",
  "sourceId": "note_123",
  "confidence": 80,
  "importance": 90
}
```

**Response**

```json
{
  "success": true,
  "data": {
    "id": "mf_123",
    "objectType": "OPPORTUNITY",
    "objectId": "opp_123",
    "factType": "NEXT_STEP",
    "title": "下周发送方案",
    "status": "ACTIVE"
  },
  "message": "memory fact created"
}
```

---

### 3. 确认记忆

**Request**

`POST /api/memory/facts/mf_123/confirm`

**Response**

```json
{
  "success": true,
  "data": {
    "id": "mf_123",
    "confirmedByUser": true,
    "status": "ACTIVE"
  },
  "message": "memory fact confirmed"
}
```

---

### 4. 修正记忆

**Request**

`POST /api/memory/facts/mf_123/correct`

```json
{
  "correctionType": "CONTENT_UPDATE",
  "afterValue": {
    "content": "客户更关心付款周期，不是总价"
  },
  "reason": "会后电话确认"
}
```

**Response**

```json
{
  "success": true,
  "data": {
    "memoryFactId": "mf_123",
    "correctionId": "mc_001",
    "updatedContent": "客户更关心付款周期，不是总价"
  },
  "message": "memory fact corrected"
}
```

---

### 5. 失效记忆

**Request**

`POST /api/memory/facts/mf_123/invalidate`

```json
{
  "reason": "该结论已不再成立"
}
```

**Response**

```json
{
  "success": true,
  "data": {
    "id": "mf_123",
    "status": "INVALID"
  },
  "message": "memory fact invalidated"
}
```

---

## 三、Commitments

### 1. 获取对象承诺列表

**Request**

`GET /api/commitments?relatedOpportunityId=opp_123`

**Response**

```json
{
  "success": true,
  "data": [
    {
      "id": "com_001",
      "title": "发送方案初稿",
      "commitmentText": "在下周三前发送方案初稿",
      "status": "OPEN",
      "dueDate": "2026-03-20T10:00:00.000Z",
      "overdueFlag": false,
      "relatedOpportunityId": "opp_123",
      "relatedContactId": "contact_002",
      "confidence": 84
    }
  ],
  "message": "ok"
}
```

---

### 2. 创建承诺

**Request**

`POST /api/commitments`

```json
{
  "title": "安排技术沟通",
  "commitmentText": "客户建议下周安排技术沟通",
  "sourceType": "MEETING_NOTE",
  "sourceId": "note_123",
  "relatedOpportunityId": "opp_123",
  "relatedContactId": "contact_002",
  "dueDate": "2026-03-21T09:00:00.000Z",
  "ownerUserId": "user_001"
}
```

**Response**

```json
{
  "success": true,
  "data": {
    "id": "com_002",
    "status": "OPEN"
  },
  "message": "commitment created"
}
```

---

### 3. 更新承诺状态

**Request**

`POST /api/commitments/com_002/status`

```json
{
  "status": "FULFILLED"
}
```

**Response**

```json
{
  "success": true,
  "data": {
    "id": "com_002",
    "status": "FULFILLED",
    "fulfilledAt": "2026-03-16T08:00:00.000Z"
  },
  "message": "commitment status updated"
}
```

---

### 4. 获取逾期承诺

> 当前状态：文档预留，当前代码未实现该接口。

**Request**

`GET /api/commitments/overdue?workspaceId=ws_001`（文档预留，当前代码未实现）

**Response**

```json
{
  "success": true,
  "data": [
    {
      "id": "com_009",
      "title": "发送候选人反馈",
      "relatedOpportunityId": "opp_777",
      "dueDate": "2026-03-10T10:00:00.000Z",
      "overdueFlag": true,
      "status": "OVERDUE"
    }
  ],
  "message": "ok"
}
```

---

## 四、Blockers

### 1. 获取阻碍列表

**Request**

`GET /api/blockers?relatedOpportunityId=opp_123`

**Response**

```json
{
  "success": true,
  "data": [
    {
      "id": "blk_001",
      "title": "预算尚未确认",
      "blockerType": "budget",
      "blockerText": "客户内部预算尚未审批通过",
      "severity": 78,
      "status": "OPEN",
      "relatedOpportunityId": "opp_123"
    }
  ],
  "message": "ok"
}
```

---

### 2. 创建阻碍

**Request**

`POST /api/blockers`

```json
{
  "title": "候选人薪资顾虑",
  "blockerType": "salary_gap",
  "blockerText": "候选人对当前薪资范围不满意",
  "severity": 82,
  "sourceType": "MEETING_NOTE",
  "sourceId": "note_456",
  "relatedOpportunityId": "opp_recruit_001",
  "relatedContactId": "contact_candidate_001"
}
```

**Response**

```json
{
  "success": true,
  "data": {
    "id": "blk_002",
    "status": "OPEN"
  },
  "message": "blocker created"
}
```

---

### 3. 解决阻碍

**Request**

`POST /api/blockers/blk_002/resolve`

```json
{
  "resolutionNote": "客户同意调整预算区间"
}
```

**Response**

```json
{
  "success": true,
  "data": {
    "id": "blk_002",
    "status": "RESOLVED",
    "resolvedAt": "2026-03-16T09:30:00.000Z"
  },
  "message": "blocker resolved"
}
```

---

### 4. 更新阻碍状态

**Request**

`POST /api/blockers/blk_002/status`

```json
{
  "status": "MONITORING",
  "resolutionNote": "先观察客户预算审批节奏，本周内不直接升级风险。"
}
```

**Response**

```json
{
  "success": true,
  "data": {
    "id": "blk_002",
    "status": "MONITORING",
    "resolvedAt": null
  },
  "message": "blocker status updated"
}
```

---

## 五、Briefings

### 1. 生成会前 briefing

**Request**

`POST /api/briefings/meeting/meeting_001`

**Response**

```json
{
  "success": true,
  "data": {
    "snapshotId": "bs_001",
    "summary": "本次会议建议聚焦方案范围、交付时间和内部预算节奏。",
    "recentFacts": [
      {
        "id": "mf_010",
        "title": "客户更关心付款周期"
      }
    ],
    "openCommitments": [
      {
        "id": "com_001",
        "title": "发送方案初稿",
        "dueDate": "2026-03-20T10:00:00.000Z"
      }
    ],
    "activeBlockers": [
      {
        "id": "blk_001",
        "title": "预算尚未确认"
      }
    ],
    "recommendedQuestions": [
      "预算审批预计何时完成？",
      "是否需要先交付精简版方案？"
    ],
    "recommendedNextSteps": [
      "会后 24 小时内发送方案结构草稿"
    ]
  },
  "message": "briefing generated"
}
```

---

### 2. 获取 briefing 快照

> 当前状态：文档预留，当前代码未实现该接口。

**Request**

`GET /api/briefings/snapshots?objectType=MEETING&objectId=meeting_001&snapshotType=pre_meeting_brief`（文档预留，当前代码未实现）

**Response**

```json
{
  "success": true,
  "data": {
    "id": "bs_001",
    "snapshotType": "pre_meeting_brief",
    "content": "本次会议建议聚焦方案范围、交付时间和内部预算节奏。",
    "sourceFactIds": ["mf_010", "mf_011"],
    "generatedAt": "2026-03-16T07:50:00.000Z",
    "version": 1
  },
  "message": "ok"
}
```

---

## 六、Recommendations

### 1. 获取对象下一步动作建议

**Request**

`GET /api/recommendations/next-actions?objectType=OPPORTUNITY&objectId=opp_123`

**Response**

```json
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "id": "rec_001",
        "title": "发送方案结构草稿",
        "description": "建议在 24 小时内发送精简版方案，降低客户等待焦虑",
        "riskLevel": 58,
        "policyResult": "REQUIRES_APPROVAL"
      }
    ],
    "supportingFactIds": ["mf_010", "mf_012"],
    "blockerIds": ["blk_001"],
    "commitmentIds": ["com_001"],
    "policyResult": "REQUIRES_APPROVAL"
  },
  "message": "ok"
}
```

---

### 2. 获取今日重点

**Request**

`GET /api/recommendations/today-focus?workspaceId=ws_001`

**Response**

```json
{
  "success": true,
  "data": {
    "topPriorities": [
      {
        "objectType": "OPPORTUNITY",
        "objectId": "opp_123",
        "title": "A 客户方案推进"
      }
    ],
    "highRiskItems": [
      {
        "objectType": "BLOCKER",
        "objectId": "blk_001",
        "title": "预算尚未确认"
      }
    ],
    "overdueCommitments": [
      {
        "objectType": "COMMITMENT",
        "objectId": "com_009",
        "title": "发送候选人反馈"
      }
    ],
    "stalledOpportunities": [],
    "suggestedActions": [
      {
        "title": "尽快发送方案结构草稿"
      }
    ]
  },
  "message": "ok"
}
```

---

## 七、Memory Timeline

### 1. 获取对象时间线

**Request**

`GET /api/memory/timeline?objectType=CONTACT&objectId=contact_001`

**Response**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "type": "COMMITMENT",
        "id": "com_001",
        "title": "发送方案初稿",
        "occurredAt": "2026-03-15T14:31:00.000Z"
      },
      {
        "type": "MEMORY_FACT",
        "id": "mf_010",
        "title": "客户更关心付款周期",
        "occurredAt": "2026-03-15T14:30:00.000Z"
      },
      {
        "type": "MEETING",
        "id": "meeting_001",
        "title": "A 客户需求澄清会",
        "occurredAt": "2026-03-15T14:00:00.000Z"
      },
      {
        "type": "EMAIL_THREAD",
        "id": "thread_001",
        "title": "客户回复方案讨论",
        "occurredAt": "2026-03-15T10:00:00.000Z"
      }
    ],
    "pageInfo": {
      "limit": 50,
      "maxLimit": 100,
      "hasNextPage": false,
      "nextCursor": null,
      "appliedCursor": null,
      "bounded": true
    }
  },
  "message": "ok"
}
```

---

### 2. 搜索记忆

> 当前状态：文档预留，当前代码未实现该接口。

**Request**

`GET /api/memory/search?q=预算&objectType=COMPANY`（文档预留，当前代码未实现）

**Response**

```json
{
  "success": true,
  "data": [
    {
      "id": "mf_099",
      "objectType": "COMPANY",
      "objectId": "company_001",
      "factType": "BLOCKER",
      "title": "预算审批慢",
      "content": "客户内部预算审批通常需要两周",
      "confidence": 76
    }
  ],
  "message": "ok"
}
```

---

### 3. 获取修正历史

> 当前状态：文档预留，当前代码未实现该接口。

**Request**

`GET /api/memory/facts/mf_123/corrections`（文档预留，当前代码未实现）

**Response**

```json
{
  "success": true,
  "data": [
    {
      "id": "mc_001",
      "correctionType": "CONTENT_UPDATE",
      "beforeValue": {
        "content": "客户更关心总价"
      },
      "afterValue": {
        "content": "客户更关心付款周期，不是总价"
      },
      "reason": "会后电话确认",
      "createdAt": "2026-03-16T11:00:00.000Z"
    }
  ],
  "message": "ok"
}
```

---

## 八、错误返回示例

### 1. 参数缺失

```json
{
  "success": false,
  "errorCode": "INVALID_REQUEST",
  "message": "objectType 和 objectId 不能为空"
}
```

### 2. 目标对象不存在

```json
{
  "success": false,
  "errorCode": "NOT_FOUND",
  "message": "未找到对应对象"
}
```

### 3. 修正失败

```json
{
  "success": false,
  "errorCode": "CORRECTION_FAILED",
  "message": "记忆修正失败，请稍后重试"
}
```

---

## 九、前端联调建议

前端在联调这些接口时，优先处理：

1. Contact 页的关键记忆模块
2. Opportunity 页的 blocker 和 commitment 模块
3. Meeting 页的 briefing 和 supporting facts
4. 记忆页的 4 个 tab
5. recommendation 的依据展示

建议所有展示组件都保留以下字段：
- 来源
- 置信度
- 最近更新时间
- 状态
- 修正入口

---

## 十、实施建议

第一阶段实现时，优先保证：

1. 返回结构简单稳定
2. 能支持页面展示
3. 能支持 recommendation 解释链
4. 能支持修正与审计

不要一开始做过度通用的查询 DSL。
先把对象级查询做好。
