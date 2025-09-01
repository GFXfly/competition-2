#!/bin/bash

# 公平竞争审查系统 V1.0.0 全新部署脚本
# 适用于清空后的阿里云服务器

# 配置变量
REPO_URL="https://github.com/GFXfly/competition-2.git"
PROJECT_DIR="/var/www/competition-2"
APP_NAME="competition-2"
DOMAIN="cursor2.com"
PORT="3000"

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}  公平竞争审查系统全新部署脚本 V1.0.0  ${NC}"
echo -e "${GREEN}=========================================${NC}"

# 1. 系统更新
echo -e "${BLUE}[1/10] 更新系统包...${NC}"
apt update && apt upgrade -y

# 2. 安装基础工具
echo -e "${BLUE}[2/10] 安装基础工具...${NC}"
apt install -y curl wget git vim unzip

# 3. 安装 Node.js 18 LTS
echo -e "${BLUE}[3/10] 安装 Node.js 18 LTS...${NC}"
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# 验证安装
node_version=$(node -v)
npm_version=$(npm -v)
echo -e "${GREEN}Node.js 版本: $node_version${NC}"
echo -e "${GREEN}npm 版本: $npm_version${NC}"

# 4. 安装 PM2
echo -e "${BLUE}[4/10] 安装 PM2...${NC}"
npm install -g pm2

# 配置 PM2 开机自启
pm2 startup systemd
echo -e "${YELLOW}请在部署完成后手动执行 pm2 save 保存配置${NC}"

# 5. 安装 Nginx
echo -e "${BLUE}[5/10] 安装 Nginx...${NC}"
apt install -y nginx

# 启动并设置开机自启
systemctl start nginx
systemctl enable nginx

# 6. 创建项目目录
echo -e "${BLUE}[6/10] 创建项目目录...${NC}"
mkdir -p "$PROJECT_DIR"
cd "$PROJECT_DIR"

# 7. 克隆项目代码
echo -e "${BLUE}[7/10] 克隆项目代码...${NC}"
git clone "$REPO_URL" .

if [ $? -ne 0 ]; then
    echo -e "${RED}Git 克隆失败，尝试其他方法...${NC}"
    echo -e "${YELLOW}请手动上传项目文件到 $PROJECT_DIR${NC}"
    exit 1
fi

# 8. 安装项目依赖
echo -e "${BLUE}[8/10] 安装项目依赖...${NC}"
npm install --legacy-peer-deps

if [ $? -ne 0 ]; then
    echo -e "${YELLOW}尝试使用 --force 参数重新安装...${NC}"
    npm install --force
    if [ $? -ne 0 ]; then
        echo -e "${RED}依赖安装失败${NC}"
        exit 1
    fi
fi

# 9. 构建项目
echo -e "${BLUE}[9/10] 构建项目...${NC}"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}项目构建失败${NC}"
    exit 1
fi

# 10. 配置 Nginx
echo -e "${BLUE}[10/10] 配置 Nginx...${NC}"

# 删除默认配置
rm -f /etc/nginx/sites-enabled/default

# 创建新的配置文件
cat > /etc/nginx/sites-available/competition-2 << EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
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

# 启用站点
ln -sf /etc/nginx/sites-available/competition-2 /etc/nginx/sites-enabled/

# 测试 Nginx 配置
nginx -t
if [ $? -ne 0 ]; then
    echo -e "${RED}Nginx 配置错误${NC}"
    exit 1
fi

# 重载 Nginx
systemctl reload nginx

# 启动应用
echo -e "${GREEN}启动应用...${NC}"
cd "$PROJECT_DIR"
pm2 start npm --name "$APP_NAME" -- start

# 保存 PM2 配置
pm2 save

# 健康检查
echo -e "${GREEN}执行健康检查...${NC}"
sleep 10

# 检查应用是否运行
if curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT | grep -q "200"; then
    echo -e "${GREEN}✅ 应用在端口 $PORT 运行正常！${NC}"
else
    echo -e "${RED}❌ 应用启动失败，查看日志：${NC}"
    pm2 logs "$APP_NAME" --lines 20
    exit 1
fi

# 检查域名访问
if curl -s -o /dev/null -w "%{http_code}" http://$DOMAIN | grep -q "200"; then
    echo -e "${GREEN}✅ 域名 $DOMAIN 访问正常！${NC}"
else
    echo -e "${YELLOW}⚠️  域名访问可能需要DNS传播时间${NC}"
fi

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}          部署成功完成！ 🎉              ${NC}"
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}访问地址: http://$DOMAIN${NC}"
echo -e "${GREEN}本地测试: http://localhost:$PORT${NC}"
echo -e "${YELLOW}管理命令:${NC}"
echo -e "${YELLOW}  查看状态: pm2 status${NC}"
echo -e "${YELLOW}  查看日志: pm2 logs $APP_NAME${NC}"
echo -e "${YELLOW}  重启应用: pm2 restart $APP_NAME${NC}"
echo -e "${YELLOW}  停止应用: pm2 stop $APP_NAME${NC}"
echo -e "${GREEN}=========================================${NC}"
