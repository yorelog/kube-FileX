# KubeFileX

**Connect, Browse, Transfer – All Your Pod Files in One Place.**

KubeFileX 是一个基于 Web 的视觉化工具，用于在 Kubernetes 集群命名空间内浏览、搜索和传输 Pod 中的文件。告别繁琐的 `kubectl cp` 和 `kubectl exec` 命令，像使用本地文件管理器一样管理你的容器文件。

## ✨ 核心特性

*   **跨 Pod 文件浏览**：在统一的 Web 界面中无缝浏览同一命名空间下所有 Pod 的文件系统，对目录挂载 PV 有标注。
*   **智能全局搜索**：支持跨多个 Pod 进行文件名和文件内容的快速搜索。
*   **便捷文件传输**：轻松地在不同 Pod 之间，或 Pod 与本地之间上传、下载、复制、移动文件。
*   **实时文件监控**：（计划中）监听指定目录的文件变化，便于调试和日志跟踪，或者执行数据任务。
*   **安全与权限**：完全遵循 Kubernetes RBAC，仅需 Pod 的 `exec` 权限，安全无忧。
*   **现代化界面**：基于 React 和 Tailwind CSS 的直观、响应式用户界面。

## 🚀 快速开始

### 前置要求

- Go 1.21+
- Node.js 18+
- Kubernetes 集群访问权限
- kubectl 配置好的集群连接

### 本地开发

#### 1. 启动后端服务

```bash
# 构建后端
go build -o bin/kube-filex ./cmd/server

# 运行后端服务（将使用 ~/.kube/config）
./bin/kube-filex --port 8080
```

#### 2. 启动前端开发服务器

```bash
cd web/frontend
npm install
npm run dev
```

前端将在 `http://localhost:5173` 启动，并代理 API 请求到后端。

### Docker 部署

#### 构建镜像

```bash
# 构建后端镜像
docker build -t kube-filex:latest -f Dockerfile .

# 构建前端镜像
docker build -t kube-filex-frontend:latest -f Dockerfile.frontend .
```

#### 使用 Docker Compose 运行

```bash
docker-compose up -d
```

### Kubernetes 部署

#### 1. 创建 RBAC 权限

```bash
kubectl apply -f k8s/rbac.yaml
```

#### 2. 部署应用

```bash
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
```

#### 3. 访问应用

```bash
# 使用 port-forward
kubectl port-forward svc/kube-filex 8080:8080

# 或者通过 Ingress（需要先配置 k8s/ingress.yaml）
kubectl apply -f k8s/ingress.yaml
```

## 📖 API 文档

### 接口列表

#### Pod 操作

- `GET /api/pods?namespace=<namespace>` - 列出指定命名空间的所有 Pod

#### 文件操作

- `GET /api/files/list?namespace=<ns>&pod=<pod>&container=<container>&path=<path>` - 列出目录内容
- `GET /api/files/read?namespace=<ns>&pod=<pod>&container=<container>&path=<path>` - 下载文件
- `POST /api/files/write?namespace=<ns>&pod=<pod>&container=<container>&path=<path>` - 上传文件
- `DELETE /api/files/delete?namespace=<ns>&pod=<pod>&container=<container>&path=<path>` - 删除文件
- `POST /api/files/copy` - 复制文件（支持跨 Pod）

#### 搜索操作

- `GET /api/search/name?namespace=<ns>&pod=<pod>&container=<container>&searchPath=<path>&pattern=<pattern>` - 按文件名搜索
- `GET /api/search/content?namespace=<ns>&pod=<pod>&container=<container>&searchPath=<path>&content=<text>` - 按内容搜索

## 🔒 安全性

KubeFileX 遵循 Kubernetes RBAC 权限模型，仅需要以下权限：

- `pods/exec` - 用于在 Pod 中执行命令
- `pods/list` - 用于列出 Pod
- `pods/get` - 用于获取 Pod 详情

所有操作都通过 Kubernetes API 进行，不会绕过集群的安全机制。

## 🏗️ 架构

```
┌─────────────────┐
│  Frontend       │
│  (React + TS)   │
└────────┬────────┘
         │
         ↓ HTTP/REST
┌────────────────────┐
│  Backend           │
│  (Go)              │
└────────┬───────────┘
         │
         ↓ Kubernetes API
┌────────────────────┐
│  Kubernetes        │
│  Cluster           │
└────────────────────┘
```

### 技术栈

**前端**:
- React 18
- TypeScript
- Tailwind CSS
- Vite

**后端**:
- Go 1.21+
- Kubernetes client-go
- Standard library HTTP server

## 🛠️ 开发

### 项目结构

```
kube-FileX/
├── cmd/
│   └── server/          # 后端入口
├── internal/
│   ├── api/             # HTTP API 处理
│   └── k8s/             # Kubernetes 客户端封装
├── web/
│   └── frontend/        # React 前端应用
├── k8s/                 # Kubernetes 部署清单
├── Dockerfile           # 后端 Docker 镜像
├── Dockerfile.frontend  # 前端 Docker 镜像
└── docker-compose.yml   # 本地开发编排
```

### 构建

```bash
# 构建后端
go build -o bin/kube-filex ./cmd/server

# 构建前端
cd web/frontend
npm run build
```

### 测试

```bash
# 运行后端测试
go test ./...

# 运行前端测试
cd web/frontend
npm test
```

## 📝 许可证

本项目采用 Apache License 2.0 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🤝 贡献

欢迎贡献！请随时提交 Pull Request。

## 📞 联系

如有问题或建议，请提交 [Issue](https://github.com/yorelog/kube-FileX/issues)。

## ⚠️ 注意事项

- 此工具需要在 Pod 中执行命令，请确保只在受信任的环境中使用
- 建议在生产环境中启用认证和授权
- 文件操作可能会影响 Pod 的运行，请谨慎使用
- 大文件传输可能会消耗较多资源

## 🗺️ 路线图

- [x] 基础文件浏览功能
- [x] 文件上传/下载
- [x] 文件搜索（名称和内容）
- [x] PV 挂载标识
- [ ] 实时文件监控
- [ ] 文件编辑器
- [ ] 批量操作
- [ ] 用户认证和授权
- [ ] 操作审计日志
- [ ] 多集群支持
