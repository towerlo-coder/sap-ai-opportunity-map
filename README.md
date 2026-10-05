# SAP AI Opportunity Map

AI 在 SAP 项目中的机会地图（内部头脑风暴材料），需要登录才能查看。

- 客户运营：S2P、O2C、R2R 按 L1 / L2 拆解，列出负责团队、痛点和 AI 抓手
- 项目实施：SAP Activate 各阶段按 L1 / L2 拆解，列出负责角色、痛点和 AI 抓手

## 结构

- `site/index.html`：网站本体，内容都在脚本顶部的 `DATA` 对象里
- `login.html`：登录页
- `server.js`：Node 服务（无第三方依赖），只有登录后才返回网站内容

## 部署（Zeabur）

Zeabur 会根据 `package.json` 识别为 Node 项目，并用 `npm start` 启动。需要在服务的环境变量里设置：

| 变量 | 说明 |
| --- | --- |
| `ADMIN_USER` | 登录用户名（默认 `admin`） |
| `ADMIN_PASSWORD` | 登录密码，必填；不设置时网站返回 503 |
| `SESSION_SECRET` | 一串随机字符，用于签名登录 cookie；不设置时每次重启都要重新登录 |
| `SESSION_HOURS` | 登录有效时长，默认 12 小时 |

密码不要写进仓库。退出登录访问 `/logout`，页面右下角也有按钮。

## 本地运行

```
ADMIN_PASSWORD=你的密码 npm start
```

然后打开 http://localhost:8080
