# 🚀 部署指南

## 快速部署到阿里云服务器

### 方法一：使用自动部署脚本

1. **上传部署脚本到服务器**
```bash
scp deploy.sh root@cursor2.com:/root/
```

2. **登录服务器执行部署**
```bash
ssh root@cursor2.com
chmod +x /root/deploy.sh
./deploy.sh
```

### 方法二：手动部署步骤

1. **登录阿里云服务器**
```bash
ssh root@cursor2.com
```

2. **进入项目目录并拉取最新代码**
```bash
cd /var/www/competition-2
git pull origin main
```

3. **安装依赖并构建**
```bash
npm install
npm run build
```

4. **重启服务**
```bash
pm2 restart competition-2
# 或者如果是首次部署
pm2 start npm --name competition-2 -- start
pm2 save
```

### 验证部署

1. **检查服务状态**
```bash
pm2 status
pm2 logs competition-2
```

2. **测试访问**
- 本地测试：`curl http://localhost:3000`
- 域名访问：http://cursor2.com

### 回滚操作

如果新版本有问题，可以快速回滚：
```bash
cd /var/backups/competition-2
# 查看备份版本
ls -la
# 恢复到指定备份（替换为实际的备份目录名）
cp -r backup_20250123_120000/* /var/www/competition-2/
cd /var/www/competition-2
pm2 restart competition-2
```

## 📋 部署检查清单

- [ ] GitHub代码已推送
- [ ] 服务器SSH连接正常
- [ ] Node.js和PM2已安装
- [ ] Nginx配置正确
- [ ] 域名解析到服务器IP
- [ ] 防火墙开放80/443端口
- [ ] 服务正常启动
- [ ] 网站可以正常访问

## 🛠️ 常用命令

```bash
# 查看PM2进程
pm2 status

# 查看应用日志
pm2 logs competition-2

# 重启应用
pm2 restart competition-2

# 停止应用
pm2 stop competition-2

# 查看Nginx状态
systemctl status nginx

# 重载Nginx配置
nginx -t && systemctl reload nginx
```
