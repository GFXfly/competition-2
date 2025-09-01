#!/bin/bash

# 阿里云服务器清理脚本
# 警告：此脚本会删除所有相关服务和数据，请谨慎使用！

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${RED}=========================================${NC}"
echo -e "${RED}        服务器清理脚本 ⚠️  警告         ${NC}"
echo -e "${RED}=========================================${NC}"
echo -e "${YELLOW}此脚本将清理以下内容：${NC}"
echo -e "${YELLOW}  - 停止并删除所有 PM2 进程${NC}"
echo -e "${YELLOW}  - 卸载 Node.js 和 npm${NC}"
echo -e "${YELLOW}  - 卸载 PM2${NC}"
echo -e "${YELLOW}  - 删除项目文件${NC}"
echo -e "${YELLOW}  - 重置 Nginx 配置${NC}"
echo -e "${RED}=========================================${NC}"

read -p "确定要继续吗？输入 'YES' 继续: " confirm
if [ "$confirm" != "YES" ]; then
    echo -e "${GREEN}操作已取消${NC}"
    exit 0
fi

echo -e "${GREEN}开始清理服务器...${NC}"

# 1. 停止并删除所有 PM2 进程
echo -e "${YELLOW}[1/7] 清理 PM2 进程...${NC}"
if command -v pm2 &> /dev/null; then
    pm2 kill
    pm2 unstartup systemd
fi

# 2. 卸载全局 npm 包
echo -e "${YELLOW}[2/7] 卸载全局 npm 包...${NC}"
if command -v npm &> /dev/null; then
    npm uninstall -g pm2
fi

# 3. 删除项目文件
echo -e "${YELLOW}[3/7] 删除项目文件...${NC}"
rm -rf /var/www/competition-2
rm -rf /var/www/backup

# 4. 重置 Nginx 配置
echo -e "${YELLOW}[4/7] 重置 Nginx 配置...${NC}"
systemctl stop nginx
rm -f /etc/nginx/sites-available/competition-2
rm -f /etc/nginx/sites-enabled/competition-2
rm -f /etc/nginx/conf.d/competition-2.conf

# 恢复默认配置
if [ ! -f /etc/nginx/sites-enabled/default ]; then
    ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/
fi

systemctl start nginx

# 5. 卸载 Node.js
echo -e "${YELLOW}[5/7] 卸载 Node.js...${NC}"
apt remove -y nodejs npm
apt autoremove -y

# 清理 NodeSource 仓库
rm -f /etc/apt/sources.list.d/nodesource.list
rm -f /usr/share/keyrings/nodesource.gpg

# 6. 清理用户数据
echo -e "${YELLOW}[6/7] 清理用户数据...${NC}"
rm -rf ~/.pm2
rm -rf ~/.npm
rm -rf ~/.nvm

# 7. 更新包列表
echo -e "${YELLOW}[7/7] 更新包列表...${NC}"
apt update

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}        服务器清理完成！ ✅             ${NC}"
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}现在可以运行全新部署脚本了${NC}"
echo -e "${GREEN}=========================================${NC}"
