#!/bin/bash

# 公平竞争审查系统 V2.0.0 部署脚本
# 适用于阿里云服务器部署和更新

echo "🚀 开始部署公平竞争审查系统 V2.0.0..."

# 设置变量
PROJECT_NAME="competition-2"
DOMAIN="cursor2.com"
GITHUB_REPO="https://github.com/GFXfly/competition-2.git"
PROJECT_DIR="/var/www/${PROJECT_NAME}"
BACKUP_DIR="/var/backups/${PROJECT_NAME}"

# 创建备份目录
mkdir -p $BACKUP_DIR

# 1. 备份当前版本
echo "📦 备份当前版本..."
if [ -d "$PROJECT_DIR" ]; then
    BACKUP_NAME="backup_$(date +%Y%m%d_%H%M%S)"
    cp -r $PROJECT_DIR "$BACKUP_DIR/$BACKUP_NAME"
    echo "✅ 备份完成: $BACKUP_DIR/$BACKUP_NAME"
fi

# 2. 停止当前服务
echo "⏹️  停止当前服务..."
pm2 stop $PROJECT_NAME 2>/dev/null || echo "服务未运行"

# 3. 拉取最新代码
echo "📥 拉取最新代码..."
if [ -d "$PROJECT_DIR" ]; then
    cd $PROJECT_DIR
    git pull origin main
else
    git clone $GITHUB_REPO $PROJECT_DIR
    cd $PROJECT_DIR
fi

# 4. 安装依赖
echo "📦 安装依赖..."
npm install

# 5. 构建项目
echo "🔨 构建项目..."
npm run build

# 6. 启动服务
echo "🚀 启动服务..."
pm2 start npm --name $PROJECT_NAME -- start
pm2 save

# 7. 配置Nginx（如果需要）
echo "⚙️  配置Nginx..."
NGINX_CONFIG="/etc/nginx/sites-available/${PROJECT_NAME}"
if [ ! -f "$NGINX_CONFIG" ]; then
    cat > $NGINX_CONFIG << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

    ln -sf $NGINX_CONFIG /etc/nginx/sites-enabled/
    nginx -t && systemctl reload nginx
    echo "✅ Nginx配置完成"
fi

# 8. 检查服务状态
echo "🔍 检查服务状态..."
sleep 5
pm2 status $PROJECT_NAME

# 9. 测试部署
echo "🧪 测试部署..."
curl -f http://localhost:3001 > /dev/null
if [ $? -eq 0 ]; then
    echo "✅ 部署成功！服务正常运行"
    echo "🌐 访问地址: http://$DOMAIN"
    echo "📊 PM2状态: pm2 status"
    echo "📋 查看日志: pm2 logs $PROJECT_NAME"
else
    echo "❌ 部署失败！请检查日志"
    pm2 logs $PROJECT_NAME --lines 20
fi

echo "🎉 部署脚本执行完成！"
