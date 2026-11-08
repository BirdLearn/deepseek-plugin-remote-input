# dsh-remote-input

[English](README.md) | [中文](README.zh-CN.md)

**用手机把文字和照片直接送进 DeepSeek Harness 的输入框。**

在手机上打字、拍照，内容直接落到电脑端的输入框里——不用数据线、不用云服务、不用装 App。
插件在 Harness 输入框工具栏显示一个二维码按钮，扫一下，手机就变成了给智能体用的第二块键盘。

这是一个仓库外（out-of-tree）的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
bundle：通过 Harness 的 **插件** 页面安装，只往输入框工具栏里加一个控件。

## 工作原理

```
   手机（相机 / 键盘）                     电脑（DeepSeek Harness）
 ┌──────────────────────────┐            ┌────────────────────────────────────┐
 │  采集页面                │  POST      │  Host：采集服务器  :8765            │
 │  ┌────────────────────┐  │ ─────────► │    队列 ──► 领取 ──► 输入框        │
 │  │ 文本框 + 拍照按钮   │  │  /submit   │                                    │
 │  └────────────────────┘  │            │  浏览器：轮询 /scan/claim           │
 └──────────────────────────┘            │    文字 ──► insertText()            │
                                         │    图片 ──► 草稿附件                │
   扫二维码 ──► http://<局域网 IP>:8765/  └────────────────────────────────────┘
```

1. **Host 半边**（[index.js](index.js)）在局域网上起一个小 HTTP 服务器，给手机提供采集页面，
   并把手机发来的内容放进队列。
2. **手机页面**（[mobile-page.js](mobile-page.js)）收集文字和照片，把照片缩到合适的大小，
   再回传到同一个地址。
3. **浏览器半边**（[client.js](client.js)）轮询 Host 取内容，放进当前会话的输入框：
   照片变成草稿附件，文字插到光标处。
4. 二维码由 Host 渲染（`/scan/qr.svg`），内容是采集地址加一个本次运行随机生成的 token。

两半在同一个包里：`index.js` 是 Node/Host 入口，`client.js` 是 Harness 懒加载的浏览器模块。

## 环境要求

- 支持插件的 DeepSeek Harness（桌面版或 Web 版）。
- 手机和电脑在同一网络（Wi-Fi 或局域网）。插件监听所有网卡，不需要做端口转发。

## 安装

### 本地目录安装（桌面版）

```sh
git clone https://github.com/BirdLearn/deepseek-plugin-remote-input.git
cd deepseek-plugin-remote-input
npm install            # 运行期依赖：qrcode + @deepseek-ai/schemastery
```

在 DeepSeek Harness 里打开 **设置 → 插件**，从本地路径安装（就是放着这个 `package.json` 的目录），
然后重启一次应用，让 Host 半边激活。

> 本地（link）安装会从该目录的 `node_modules` 解析 `qrcode` 和 `@deepseek-ai/schemastery`，
> 所以装 bundle 之前先跑一次 `npm install`。

### 从 npm 安装

```sh
npm install dsh-remote-input
```

然后在 Harness 的 **插件** 页面里安装 `dsh-remote-input`。

## 使用

1. 在 Harness 里打开一个会话。输入框工具栏里（权限、计划控件左侧）会出现一个**二维码小图标**。
2. 点开面板，里面有二维码、投送地址和队列计数。
3. 用手机扫码，打字或拍照，按 **发送到电脑**。内容会出现在你刚才看的那个会话的输入框里，
   确认无误后按平时的发送按钮即可。

手机对不上焦时，也可以手动输入采集地址（面板里会显示，并带复制按钮）。

## 配置

bundle 会插入一行 Host 记录，它的 `config` 支持：

| 配置 | 默认值 | 说明 |
|---|---|---|
| `port` | `8765` | 采集服务器的 TCP 端口，`0` 表示随机可用端口。 |
| `host` | `0.0.0.0` | 监听地址。 |
| `maxImages` | `9` | 单次投送最多几张图片。 |
| `maxTextChars` | `8000` | 单次投送文字的最大字符数。 |
| `maxUploadBytes` | `33554432` | 接受的请求体最大字节数。 |

## HTTP 路由

采集服务器（局域网，带 token）：

| 路由 | 用途 |
|---|---|
| `GET /?k=<token>` | 手机采集页面。 |
| `POST /submit?k=<token>` | `{ text, images: [{ name, type, data }] }`，图片是 base64。 |
| `GET /status?k=<token>` | `{ ok, pending }`。 |

Harness 自己的 web server（本地，浏览器半边使用）：

| 路由 | 用途 |
|---|---|
| `GET /scan/config` | `{ urls, primary, port, pending }`：投送地址与队列深度。 |
| `GET /scan/claim` | `{ items }`：领取队列内容（独占领取）。 |
| `GET /scan/qr.svg` | 投送地址的二维码，SVG。 |

## 安全与隐私

- **数据不出本机。** 采集服务器只监听局域网，手机直连它，图片不会经过任何云服务；
  它只会被上传一次到 Harness 自己的附件库，和你手动拖进输入框的文件走同一条路。
- **二维码里带 token。** 地址带一个本次运行随机生成的 token，没扫过码的设备访问采集路由会拿到 `403`。
- **每次运行换 token。** Host 半边一重启 token 就变，所以旧的二维码截图会失效。
- `/scan/` 这几个路由注册在 Harness 的 web server 上，能访问该服务的人都能访问，
  请保持 Harness 绑定在本地（默认如此）。

## 开发

```sh
npm install
npm test            # node --test：Host 路由、队列流转、客户端渲染
```

目录结构：

```
index.js          Host 半边：采集服务器、队列、Harness 路由
config.js         配置 schema（schemastery）
mobile-page.js    手机端采集页面（单文件自包含）
client.js         浏览器半边：输入框按钮 + 二维码面板
locale/*.json     插件页展示用的元数据（标题、描述）
icon.svg          插件图标
test/             Node 测试套件
```

浏览器半边是 Harness 懒加载工厂格式（`window.__ModuleLoader__.load`）下的纯 JavaScript 模块，
没有构建步骤：改完 `client.js`，重启应用（或刷新页面）即可加载新代码——
客户端版本号由文件 mtime 推导，刷新就能拿到最新内容。

插件不引用任何 Harness 客户端包，只使用运行时提供的 `slots`、`locale`、`conversation` 服务。

## 已知限制

- 一次投送只会进**一个**会话：同时开了多个 Harness 窗口时，谁先轮询到就进谁的会话。
- 输入框正忙（正在发送消息）时，内容会先缓存在本地缓冲区，等输入框空闲后再插入，
  按钮上会显示等待中的条数。
- 照片在手机上先缩到 1600 像素（JPEG 质量 0.85）再上传，超大照片会损失一些细节。
- 采集页面需要支持 `<input type="file" capture>` 的浏览器，当前手机浏览器都支持。

## 许可证

[MIT](LICENSE)
