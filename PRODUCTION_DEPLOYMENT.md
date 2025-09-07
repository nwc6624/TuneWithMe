# TuneWithMe Production Deployment Guide

## Overview
This guide will help you deploy TuneWithMe to production using Docker and Docker Compose.

## Prerequisites
- Docker and Docker Compose installed
- A domain name pointing to your server
- SSL certificate (Let's Encrypt recommended)
- Spotify Developer Account with OAuth app configured

## Step 1: Environment Setup

1. **Copy the environment template:**
   ```bash
   cp env.production.template .env.production
   ```

2. **Generate secure secrets:**
   ```bash
   # Generate session secret
   openssl rand -base64 32
   
   # Generate Redis password
   openssl rand -base64 32
   ```

3. **Update `.env.production` with your values:**
   ```bash
   # Redis Configuration
   REDIS_PASSWORD=your_generated_redis_password
   
   # Session Secret
   SESSION_SECRET=your_generated_session_secret
   
   # Spotify OAuth Configuration
   SPOTIFY_CLIENT_ID=your_spotify_client_id
   SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
   SPOTIFY_REDIRECT_URI=https://yourdomain.com/auth/spotify/callback
   
   # CORS Origins
   CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
   ```

## Step 2: Spotify OAuth Setup

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Add redirect URI: `https://yourdomain.com/auth/spotify/callback`
4. Copy Client ID and Client Secret to your `.env.production`

## Step 3: SSL Certificate Setup

### Using Let's Encrypt with Certbot:
```bash
# Install certbot
sudo apt update
sudo apt install certbot

# Get certificate
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com
```

## Step 4: Reverse Proxy Setup (Nginx)

Create `/etc/nginx/sites-available/tunewithme`:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Frontend
    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Auth endpoints
    location /auth/ {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket
    location /ws/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Overlay endpoints
    location /overlay/ {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/tunewithme /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Step 5: Deploy with Docker

1. **Build and start services:**
   ```bash
   docker-compose -f docker-compose.prod.yml --env-file .env.production up -d
   ```

2. **Check service status:**
   ```bash
   docker-compose -f docker-compose.prod.yml ps
   ```

3. **View logs:**
   ```bash
   docker-compose -f docker-compose.prod.yml logs -f
   ```

## Step 6: Monitoring and Maintenance

### Health Checks
- Frontend: `https://yourdomain.com/health`
- Backend: `https://yourdomain.com/health`

### Log Management
```bash
# View logs
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f frontend
docker-compose -f docker-compose.prod.yml logs -f redis

# Log rotation (add to crontab)
0 2 * * * docker system prune -f
```

### Updates
```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d
```

### Backup
```bash
# Backup Redis data
docker exec tunewithme_redis_1 redis-cli --rdb /data/backup.rdb
docker cp tunewithme_redis_1:/data/backup.rdb ./redis-backup-$(date +%Y%m%d).rdb
```

## Security Considerations

1. **Firewall Configuration:**
   ```bash
   sudo ufw allow 22/tcp
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```

2. **Regular Updates:**
   - Keep Docker images updated
   - Monitor for security vulnerabilities
   - Update dependencies regularly

3. **Monitoring:**
   - Set up log monitoring
   - Monitor resource usage
   - Set up alerts for service failures

## Troubleshooting

### Common Issues:

1. **WebSocket Connection Failed:**
   - Check nginx WebSocket configuration
   - Verify SSL certificate is valid
   - Check firewall settings

2. **Spotify OAuth Issues:**
   - Verify redirect URI matches exactly
   - Check client ID and secret
   - Ensure domain is whitelisted

3. **Redis Connection Issues:**
   - Check Redis password
   - Verify network connectivity
   - Check Redis logs

### Debug Commands:
```bash
# Check container status
docker-compose -f docker-compose.prod.yml ps

# Check logs
docker-compose -f docker-compose.prod.yml logs backend

# Access container shell
docker-compose -f docker-compose.prod.yml exec backend sh

# Test Redis connection
docker-compose -f docker-compose.prod.yml exec redis redis-cli ping
```

## Performance Optimization

1. **Enable Redis persistence:**
   - Already configured in docker-compose.prod.yml

2. **Monitor resource usage:**
   ```bash
   docker stats
   ```

3. **Scale if needed:**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d --scale backend=2
   ```

## Support

For issues and questions:
1. Check the logs first
2. Verify environment configuration
3. Test individual components
4. Check network connectivity
5. Review this deployment guide
