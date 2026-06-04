# Billionaire 博客部署指南

> 目标环境：腾讯云 Ubuntu，2核2G

## 一、服务器初始化

```bash
# 1. 更新系统
sudo apt update && sudo apt upgrade -y

# 2. 安装常用工具
sudo apt install -y curl git nginx certbot python3-certbot-nginx

# 3. 安装 Node.js 20 (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 4. 验证
node -v   # v20.x
npm -v    # 10.x

# 5. 安装 PM2 (进程守护)
sudo npm install -g pm2
```

## 二、安装 MariaDB

```bash
# 1. 安装 MariaDB
sudo apt install -y mariadb-server

# 2. 安全初始化
sudo mysql_secure_installation
# - Set root password? Y → 输入你的密码
# - Remove anonymous users? Y
# - Disallow root login remotely? Y
# - Remove test database? Y
# - Reload privilege tables? Y

# 3. 创建数据库和用户
sudo mysql -u root -p
```

```sql
-- 在 MySQL 命令行中执行：
CREATE DATABASE billionaire CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'blog'@'localhost' IDENTIFIED BY '你的安全密码';
GRANT ALL PRIVILEGES ON billionaire.* TO 'blog'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

## 三、部署项目代码

```bash
# 1. 创建部署目录
sudo mkdir -p /var/www/billionaire
sudo chown $USER:$USER /var/www/billionaire

# 2. 克隆代码（或用 scp/rsync 上传）
cd /var/www/billionaire
git clone <你的仓库地址> .

# 3. 安装依赖
npm install

# 4. 生成 Prisma Client
npx prisma generate

# 5. 初始化数据库表
npx prisma db push
```

## 四、配置环境变量

```bash
# 创建生产环境配置
nano /var/www/billionaire/.env
```

写入以下内容（按实际情况修改）：

```env
# 数据库
DATABASE_URL="mysql://blog:你的安全密码@localhost:3306/billionaire"

# NextAuth
NEXTAUTH_SECRET="用 openssl rand -base64 32 生成一个随机密钥"
NEXTAUTH_URL="https://你的域名"

# 站点 URL（用于 SEO、RSS、OG 标签）
NEXT_PUBLIC_SITE_URL="https://你的域名"
```

生成密钥：
```bash
openssl rand -base64 32
```

## 五、构建并启动

```bash
# 1. 构建生产版本
cd /var/www/billionaire
npm run build

# 2. 用 PM2 启动
pm2 start npm --name "billionaire" -- start

# 3. 设置开机自启
pm2 startup
pm2 save

# 4. 查看运行状态
pm2 status
pm2 logs billionaire
```

## 六、配置 Nginx 反向代理

```bash
sudo nano /etc/nginx/sites-available/billionaire
```

写入：

```nginx
server {
    listen 80;
    server_name 你的域名;   # 替换为你的域名，如 blog.example.com

    # 上传文件大小限制
    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

启用站点并重启：

```bash
sudo ln -s /etc/nginx/sites-available/billionaire /etc/nginx/sites-enabled/
sudo nginx -t           # 测试配置
sudo systemctl reload nginx
```

## 七、配置 SSL (HTTPS)

```bash
# 使用 Let's Encrypt 免费证书（需要域名已解析到服务器 IP）
sudo certbot --nginx -d 你的域名

# 自动续期已内置，可手动测试：
sudo certbot renew --dry-run
```

## 八、防火墙

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

## 九、2G 内存优化

2GB 内存需要做以下优化，防止 OOM：

```bash
# 1. 创建 swap 文件（关键！）
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# 永久生效
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# 2. 限制 Node.js 内存（在 PM2 启动时）
pm2 delete billionaire
NODE_OPTIONS="--max-old-space-size=512" pm2 start npm --name "billionaire" -- start
pm2 save
```

## 十、常用运维命令

```bash
# 查看应用状态
pm2 status

# 查看日志
pm2 logs billionaire --lines 50

# 重启应用
pm2 restart billionaire

# 更新代码后重新部署
cd /var/www/billionaire
git pull
npm install
npx prisma generate
npx prisma db push      # 如果有数据库变更
npm run build
pm2 restart billionaire

# 查看内存使用
free -h

# 查看 Nginx 日志
sudo tail -f /var/log/nginx/error.log
```

## 常见问题

### 构建时内存不足 (JavaScript heap out of memory)
```bash
NODE_OPTIONS="--max-old-space-size=1024" npm run build
```

### 数据库连接失败
检查 `.env` 中的 `DATABASE_URL` 是否正确，MySQL 用户权限是否生效。

### PM2 进程崩溃自动重启
PM2 默认会自动重启。查看崩溃原因：
```bash
pm2 logs billionaire --err --lines 100
```
