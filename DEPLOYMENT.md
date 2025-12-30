# Deployment Guide

This guide covers two deployment options:
1. **Vercel + Neon** (Recommended) - Deploy in 5 minutes
2. **Oracle Cloud Free Tier** - Self-hosted for $0/month

---

## Option 1: Vercel + Neon (Recommended)

**Time:** 5-10 minutes
**Cost:** $0/month (Vercel Hobby + Neon Free Tier)
**Best for:** Quick deployment, automatic HTTPS, global CDN

### Prerequisites

- GitHub account
- Credit card (for Vercel verification - won't be charged on Hobby plan)

### Step 1: Fork/Clone Repository

1. Fork this repository to your GitHub account, or
2. Push your local repository to GitHub

### Step 2: Create Neon Database

1. Go to [neon.tech](https://neon.tech)
2. Sign up with GitHub (free)
3. Create a new project:
   - Name: `sharristh-budget`
   - Region: Choose closest to your users
   - PostgreSQL version: 16 (latest)
4. Click **Create Project**
5. Copy the connection strings:
   - **DATABASE_URL** (pooled connection)
   - **DATABASE_URL_UNPOOLED** (direct connection)

### Step 3: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub
3. Click **Add New Project**
4. Import your repository
5. Configure project:
   - **Framework Preset:** Next.js (auto-detected)
   - **Root Directory:** `./` (leave default)
   - **Build Command:** (leave default - uses vercel.json)
   - **Output Directory:** (leave default - uses vercel.json)

### Step 4: Configure Environment Variables

In Vercel project settings → Environment Variables, add:

```bash
# Database (from Neon)
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
POSTGRES_PRISMA_URL=postgresql://user:pass@host/db?pgbouncer=true&sslmode=require
POSTGRES_URL_NON_POOLING=postgresql://user:pass@host/db?sslmode=require

# Authentication Secret (generate new one)
AUTH_SECRET=<run: openssl rand -base64 32>

# WebAuthn Configuration (update after deployment)
AUTH_WEBAUTHN_RP_ID=your-project.vercel.app
AUTH_WEBAUTHN_RP_ORIGIN=https://your-project.vercel.app
```

**Important:** For `AUTH_SECRET`, run this locally to generate:
```bash
openssl rand -base64 32
```

### Step 5: Deploy

1. Click **Deploy**
2. Wait 2-3 minutes for build
3. Your app will be live at `https://your-project.vercel.app`

### Step 6: Update WebAuthn Settings

After first deployment:

1. Copy your Vercel URL (e.g., `sharristh-budget.vercel.app`)
2. Update environment variables:
   ```bash
   AUTH_WEBAUTHN_RP_ID=sharristh-budget.vercel.app
   AUTH_WEBAUTHN_RP_ORIGIN=https://sharristh-budget.vercel.app
   ```
3. Redeploy (Vercel will auto-redeploy on env change)

### Step 7: Run Database Migrations

You have two options:

**Option A: Using Vercel CLI (Recommended)**

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Link to your project
vercel link

# Run migrations
vercel env pull .env.local
pnpm prisma generate
pnpm prisma migrate deploy

# Seed default categories
pnpm db:seed
```

**Option B: Using Neon SQL Editor**

1. Go to Neon Console → SQL Editor
2. Copy the SQL from `packages/db/prisma/migrations/` folders
3. Run each migration in order

### Step 8: Set Up Custom Domain (Optional)

1. In Vercel project → Settings → Domains
2. Add your domain (e.g., `budget.yourdomain.com`)
3. Update DNS records as shown
4. Update environment variables:
   ```bash
   AUTH_WEBAUTHN_RP_ID=budget.yourdomain.com
   AUTH_WEBAUTHN_RP_ORIGIN=https://budget.yourdomain.com
   ```

### You're Done! 🎉

Your app is now live at `https://your-project.vercel.app`

**Next Steps:**

1. Register with WebAuthn (Face ID/Touch ID)
2. Connect Israeli bank accounts
3. Transactions sync automatically

### Automatic Updates

When you push to `main` branch, Vercel will automatically:
- Build and deploy new version
- Run database migrations (if configured)
- Keep your app updated

### Cost Breakdown

- **Vercel Hobby:** $0/month (unlimited sites)
- **Neon Free Tier:** $0/month (3GB storage, 192 hours compute)
- **Custom Domain:** $10-15/year (optional)

**Total: $0-1.25/month** 🎉

### Troubleshooting Vercel

#### Prisma Client Error

If you see: `@prisma/client did not initialize yet`

**Fix:** Already handled in `vercel.json` - runs `prisma generate` before build.

If still failing, check:
1. `DATABASE_URL` is set in environment variables
2. Re-deploy to regenerate Prisma client

#### WebAuthn Not Working

**Symptoms:** Can't register/login with Face ID/Touch ID

**Fix:**
1. Check `AUTH_WEBAUTHN_RP_ID` matches your domain exactly
2. Check `AUTH_WEBAUTHN_RP_ORIGIN` includes `https://` prefix
3. No trailing slashes in URLs

#### Build Fails with Type Errors

**Fix:** These should be fixed now, but if you add new code:
```bash
# Test build locally first
pnpm build

# Check for type errors
pnpm typecheck
```

#### Environment Variables Not Available

If turbo warns about missing env vars:

**Fix:** Add them to `turbo.json` under `build.env`:
```json
{
  "build": {
    "env": ["YOUR_NEW_VAR"]
  }
}
```

---

## Option 2: Oracle Cloud Free Tier (Self-Hosted)

**Time:** 1-2 days (mostly waiting for approval)
**Cost:** $0/month
**Best for:** Full control, no vendor lock-in, larger databases

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
