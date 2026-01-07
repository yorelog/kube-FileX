# KubeFileX 使用指南

## 快速开始

### 1. 本地开发环境

#### 启动后端服务

```bash
# 确保你有 kubectl 配置
kubectl config current-context

# 构建并运行后端
go build -o bin/kube-filex ./cmd/server
./bin/kube-filex --port 8080
```

后端将在 `http://localhost:8080` 启动。

#### 启动前端开发服务器

```bash
cd web/frontend
npm install
npm run dev
```

前端将在 `http://localhost:5173` 启动。

访问 `http://localhost:5173` 即可使用应用。

### 2. 使用 Docker Compose

```bash
# 构建并启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

访问 `http://localhost:3000` 即可使用应用。

### 3. Kubernetes 部署

#### 部署到 Kubernetes 集群

```bash
# 1. 创建必要的 RBAC 权限
kubectl apply -f k8s/rbac.yaml

# 2. 部署应用
kubectl apply -f k8s/deployment.yaml

# 3. 创建服务
kubectl apply -f k8s/service.yaml

# 4. （可选）创建 Ingress
kubectl apply -f k8s/ingress.yaml
```

#### 访问应用

使用 port-forward：
```bash
kubectl port-forward svc/kube-filex 8080:80
```

然后访问 `http://localhost:8080`

或者通过 NodePort：
```bash
# 获取 NodePort
kubectl get svc kube-filex

# 访问 http://<node-ip>:<node-port>
```

## 功能使用

### 浏览 Pod 文件

1. 在页面顶部输入命名空间（默认为 `default`）
2. 在左侧面板选择一个 Pod
3. 选择要访问的容器
4. 在右侧文件浏览器中浏览文件系统
5. 带有绿色标记（PV）的目录表示该路径挂载了持久卷

### 文件操作

#### 下载文件
- 在文件列表中点击文件名可查看文件详情
- 点击"Download"按钮下载文件

#### 上传文件
- 点击文件浏览器顶部的文件选择按钮
- 选择要上传的文件
- 点击"Upload"按钮

#### 删除文件
- 在文件列表中点击"Delete"按钮
- 确认删除操作

### 搜索文件

#### 按文件名搜索
1. 点击"By Name"按钮
2. 输入搜索路径（默认为 `/`）
3. 输入文件名模式（如 `*.log`、`config.*`）
4. 点击"Search"按钮

#### 按内容搜索
1. 点击"By Content"按钮
2. 输入搜索路径（默认为 `/`）
3. 输入要搜索的文本内容
4. 点击"Search"按钮

搜索结果将显示在搜索栏下方。

### 跨 Pod 文件复制

使用 API 端点 `/api/files/copy` 可以在不同 Pod 之间复制文件：

```bash
curl -X POST http://localhost:8080/api/files/copy \
  -H "Content-Type: application/json" \
  -d '{
    "srcNamespace": "default",
    "srcPod": "pod-1",
    "srcContainer": "container-1",
    "srcPath": "/path/to/source/file",
    "dstNamespace": "default",
    "dstPod": "pod-2",
    "dstContainer": "container-2",
    "dstPath": "/path/to/destination/file"
  }'
```

## 安全注意事项

### RBAC 权限

KubeFileX 需要以下 Kubernetes RBAC 权限：

- `pods/get` - 获取 Pod 信息
- `pods/list` - 列出 Pod
- `pods/exec` - 在 Pod 中执行命令

确保 ServiceAccount 拥有这些权限。参考 `k8s/rbac.yaml` 文件。

### 生产环境部署

在生产环境中，建议：

1. **启用认证**：在前端添加身份验证
2. **限制命名空间**：只允许访问特定命名空间
3. **审计日志**：记录所有文件操作
4. **使用 HTTPS**：配置 TLS 证书
5. **资源限制**：设置适当的资源 limits 和 requests

### 文件操作限制

- 删除操作不可恢复，请谨慎使用
- 大文件传输可能影响性能
- 某些系统文件可能受容器安全策略保护
- 修改配置文件可能影响应用运行

## 故障排查

### 无法连接到 Kubernetes 集群

检查 kubeconfig 配置：
```bash
kubectl config current-context
kubectl cluster-info
```

### 权限不足错误

检查 ServiceAccount 权限：
```bash
kubectl get clusterrole kube-filex -o yaml
kubectl get clusterrolebinding kube-filex -o yaml
```

### Pod exec 失败

确保：
- Pod 处于 Running 状态
- 容器正在运行
- Pod 中有 `sh` 或 `bash` shell

### 文件列表为空

检查：
- 路径是否正确
- 容器是否有文件系统访问权限
- Pod 是否使用了只读文件系统

## API 参考

详细的 API 文档请参考 README.md 中的 API 文档部分。

## 高级配置

### 自定义端口

```bash
./bin/kube-filex --port 9090
```

### 指定 kubeconfig 文件

```bash
./bin/kube-filex --kubeconfig /path/to/kubeconfig
```

### 环境变量

- `KUBECONFIG` - kubeconfig 文件路径
- `PORT` - 服务器端口

## 常见问题

**Q: 为什么某些文件无法下载？**
A: 文件可能太大或受到容器安全策略限制。

**Q: 可以同时访问多个集群吗？**
A: 当前版本只支持单个集群。多集群支持在路线图中。

**Q: 文件搜索速度慢怎么办？**
A: 尝试限制搜索路径，避免搜索整个文件系统。

**Q: 支持哪些文件类型？**
A: 支持所有文件类型，但只能下载二进制文件，不能在浏览器中预览。

## 获取帮助

如有问题或建议，请：
- 提交 [GitHub Issue](https://github.com/yorelog/kube-FileX/issues)
- 查看项目文档
- 联系维护团队
