# 在 VPS 上运行以下命令来部署更新

# 1. 进入项目目录（根据你的实际路径修改）
cd /root/aggregateapi   # 或者你的项目路径，如 /home/ubuntu/aggregateapi

# 2. 拉取最新代码
git pull origin main

# 3. 重新构建并重启容器（无需停机时间）
docker compose build web
docker compose up -d web

# 4. 查看日志确认启动成功
docker compose logs -f web --tail=50
