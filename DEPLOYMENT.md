# Deployment Guide - Oracle Cloud Free Tier

This guide will help you deploy SharristhBudget on Oracle Cloud Free Tier for **$0/month**.

## Overview

- **Platform:** Oracle Cloud Free Tier (4 cores, 24GB RAM)
- **Database:** SQLite (no migration needed)
- **Remote Access:** Cloudflare Tunnel (free HTTPS)
- **Cost:** $0/month (or $10-15/year if you buy a domain)
- **Setup Time:** 1-2 days (mostly waiting for Oracle approval)

## Prerequisites

- Git installed
- SSH client
- Credit card (for Oracle verification - won't be charged)
- Domain name (optional, can use free subdomain)

## Quick Start

### Step 1: Generate Authentication Secret

On your local machine:

```bash
openssl rand -base64 32
```

Save this secret - you'll need it later.

### Step 2: Create Oracle Cloud Account

1. Go to https://oracle.com/cloud/free
2. Sign up with email and verify phone
3. Choose region closest to you (Germany/UK recommended for Israel)
4. Wait for account approval (5-30 minutes)

### Step 3: Create Free ARM VM

1. In Oracle Cloud Console: Compute → Instances → Create Instance
2. Configure:
   - Name: `sharristh-budget`
   - Image: Ubuntu 22.04 LTS
   - Shape: Ampere (ARM) - 4 OCPUs, 24GB RAM
   - Network: Public subnet, assign IPv4
   - SSH keys: Generate and download private key
3. Launch instance (takes 2-3 minutes)
4. Note the public IP address

### Step 4: Configure Firewall

In Oracle Cloud Console:
1. Networking → VCN → Security Lists → Default Security List
2. Add Ingress Rules:
   - SSH: Port 22, Source 0.0.0.0/0
   - HTTP: Port 80, Source 0.0.0.0/0
   - HTTPS: Port 443, Source 0.0.0.0/0

### Step 5: SSH and Install Docker

```bash
# Save your downloaded SSH key
chmod 600 ~/.ssh/oracle_cloud_key.pem

# SSH into the VM
ssh -i ~/.ssh/oracle_cloud_key.pem ubuntu@<PUBLIC_IP>

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker ubuntu

# Log out and back in
exit
ssh -i ~/.ssh/oracle_cloud_key.pem ubuntu@<PUBLIC_IP>

# Verify Docker
docker --version
docker run hello-world

# Install Docker Compose
sudo apt install docker-compose-plugin -y
docker compose version

# Configure firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### Step 6: Clone Repository

On the Oracle VM:

```bash
git clone <your-repo-url>
cd SharristhBudget
```

### Step 7: Create .env File

```bash
nano .env
```

Paste the following (update with your values):

```bash
# Your generated secret from Step 1
AUTH_SECRET=<your-secret-here>

# Will update these after Cloudflare setup
AUTH_WEBAUTHN_RP_ID=budget.yourdomain.com
AUTH_WEBAUTHN_RP_ORIGIN=https://budget.yourdomain.com

# Will get this from Cloudflare in Step 8
CLOUDFLARE_TUNNEL_TOKEN=<cloudflare-token>
```

Save and exit (Ctrl+X, Y, Enter).

### Step 8: Set Up Cloudflare Tunnel

1. Go to https://dash.cloudflare.com
2. Sign up / Log in (free plan)
3. Add your domain (or get a free subdomain)
4. Navigate to: Zero Trust → Networks → Tunnels
5. Create Tunnel:
   - Name: `sharristh-budget`
   - Environment: Docker
6. Copy the tunnel token (long string starting with `eyJ...`)
7. Configure Public Hostname:
   - Subdomain: `budget`
   - Domain: `yourdomain.com`
   - Service Type: HTTP
   - URL: `web:3000`
8. Save tunnel

Update your .env file with the tunnel token:

```bash
nano .env
# Add: CLOUDFLARE_TUNNEL_TOKEN=eyJ...
# Update: AUTH_WEBAUTHN_RP_ID and AUTH_WEBAUTHN_RP_ORIGIN
```

### Step 9: Copy Existing Database (if you have one)

From your local machine:

```bash
# Create data directory on VM
ssh -i ~/.ssh/oracle_cloud_key.pem ubuntu@<PUBLIC_IP> "mkdir -p ~/SharristhBudget/data"

# Copy database
scp -i ~/.ssh/oracle_cloud_key.pem \
  packages/db/prisma/dev.db \
  ubuntu@<PUBLIC_IP>:~/SharristhBudget/data/dev.db
```

Or skip this if starting fresh - database will be created automatically.

### Step 10: Build and Start

On the Oracle VM:

```bash
cd ~/SharristhBudget

# Build Docker image (takes 5-10 minutes)
docker compose build

# Start services
docker compose up -d

# Check logs
docker compose logs -f web

# Wait for: "ready started server on 0.0.0.0:3000"
```

### Step 11: Run Migrations

```bash
# Run Prisma migrations
docker compose exec web pnpm prisma migrate deploy

# Seed default categories (if new database)
docker compose exec web pnpm db:seed
```

### Step 12: Verify Deployment

```bash
# Check health locally
curl http://localhost:3000/api/health
# Should return: {"status":"healthy", ...}

# Check via Cloudflare Tunnel
curl https://budget.yourdomain.com/api/health
# Should also return: {"status":"healthy", ...}
```

### Step 13: Set Up Backups

```bash
# Create backup script
cat > ~/backup-budget.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/home/ubuntu/backups"
DB_FILE="/home/ubuntu/SharristhBudget/data/dev.db"
DATE=$(date +%Y-%m-%d)
BACKUP_FILE="$BACKUP_DIR/budget-backup-$DATE.db"

mkdir -p "$BACKUP_DIR"
cp "$DB_FILE" "$BACKUP_FILE"
if [ -f "$DB_FILE-journal" ]; then
  cp "$DB_FILE-journal" "$BACKUP_FILE-journal"
fi
gzip -f "$BACKUP_FILE"
find "$BACKUP_DIR" -name "budget-backup-*.db.gz" -mtime +30 -delete
echo "$(date): Backup completed - $BACKUP_FILE.gz" >> "$BACKUP_DIR/backup.log"
EOF

# Make executable
chmod +x ~/backup-budget.sh

# Test backup
~/backup-budget.sh
ls -lh ~/backups/

# Schedule daily backups at 2 AM
crontab -e
# Add this line:
# 0 2 * * * /home/ubuntu/backup-budget.sh
```

## You're Done! 🎉

Your app is now running at `https://budget.yourdomain.com`

### Next Steps

1. **Test from your phone:**
   - Open `https://budget.yourdomain.com`
   - Register with WebAuthn (Face ID/Touch ID)
   - Add to home screen for app-like experience

2. **Connect Israeli banks:**
   - Add OneZero or Isracard connection
   - Transactions will sync daily at 6 AM Israel time

3. **Monitor:**
   - Check logs: `docker compose logs -f web`
   - Check backups: `ls -lh ~/backups/`
   - Check disk space: `df -h`

## Maintenance

### Weekly (2 minutes)

```bash
ssh -i ~/.ssh/oracle_cloud_key.pem ubuntu@<PUBLIC_IP>
cd ~/SharristhBudget
docker compose ps
docker compose logs --tail=50 web
df -h
```

### Monthly (5 minutes)

```bash
# Update Docker images
docker compose pull
docker compose up -d

# Update system
sudo apt update && sudo apt upgrade -y

# Verify backups
ls -lh ~/backups/
```

### Updates (when you add features)

```bash
# On Oracle VM
cd ~/SharristhBudget
git pull origin master
docker compose build web
docker compose up -d
docker compose logs -f web
```

## Troubleshooting

### Can't access remotely

```bash
# Check Cloudflare Tunnel
docker compose logs cloudflared
# Should see: "Connection ... registered"

# Restart tunnel
docker compose restart cloudflared
```

### WebAuthn fails

```bash
# Verify domain matches exactly
cat .env | grep AUTH_WEBAUTHN
# Should be: https://budget.yourdomain.com (no trailing slash)

# Restart if wrong
docker compose restart web
```

### Database locked

```bash
docker compose down
docker compose up -d
```

### Out of disk space

```bash
# Remove old Docker images
docker system prune -a

# Remove old backups
find ~/backups -name "*.gz" -mtime +7 -delete
```

## Optional: Enable AI Categorization

If you want AI-powered transaction categorization:

```bash
# Add to docker-compose.yml
nano docker-compose.yml
# Add ollama service (see plan for details)

# Pull model
docker compose up -d ollama
docker compose exec ollama ollama pull llama3.2:3b

# Update .env
nano .env
# Set: OLLAMA_ENABLED=true
# Set: OLLAMA_BASE_URL=http://ollama:11434

# Restart web
docker compose restart web
```

**Note:** This will use ~4GB RAM and inference takes 2-5 seconds per transaction.

## Support

- Full plan: `/Users/snirsh/.claude/plans/lexical-wondering-ritchie.md`
- Oracle Cloud Docs: https://docs.oracle.com/iaas/Content/FreeTier
- Cloudflare Tunnel Docs: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps
- Docker Compose Docs: https://docs.docker.com/compose

## Cost

- Oracle Cloud Free Tier: **$0/month**
- Cloudflare Tunnel: **$0/month**
- Domain (optional): **$10-15/year**

**Total: $0-1.25/month** 🎉
