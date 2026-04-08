#!/bin/bash
# Luanna Deploy Script - Automated deployment to Railway

set -e

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║          🚀 LUANNA DEPLOYMENT SCRIPT 🚀                       ║"
echo "║                                                                ║"
echo "║     This script will help you deploy Luanna to Railway        ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v git &> /dev/null; then
    echo "❌ git not found. Install from: https://git-scm.com/download"
    exit 1
fi

if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "⚠️  Not a git repository. Initializing..."
    git init
    git add .
    git commit -m "Initial commit - Luanna Travel Agent

- 17-node LangGraph architecture
- Meta Cloud API integration
- Async parallel execution
- HITL confirmations with Redis
- LangSmith observability
- Token optimization ready

Co-Authored-By: Claude <noreply@anthropic.com>" || echo "⚠️  Could not create initial commit"
fi

echo "✅ Prerequisites OK"
echo ""

# Step 1: GitHub repo
echo "🔧 STEP 1: GitHub Repository"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "You need a GitHub repository to deploy:"
echo ""
echo "1. Go to https://github.com/new"
echo "2. Create a new repository:"
echo "   - Name: luanna-travel-agent"
echo "   - Description: Vora MoA WhatsApp chatbot for travel planning"
echo "   - Public or Private (your choice)"
echo "   - Click 'Create repository'"
echo ""
echo "3. Copy the git command from GitHub (should be):"
echo "   git remote add origin https://github.com/YOUR_USERNAME/luanna-travel-agent.git"
echo ""
read -p "Have you created the GitHub repo? (yes/no): " github_done

if [ "$github_done" != "yes" ]; then
    echo "⚠️  Please create the GitHub repo first, then run this script again."
    exit 1
fi

echo ""
read -p "Enter your GitHub repo URL (https://github.com/YOUR_USERNAME/luanna-travel-agent.git): " github_url

# Add remote if not already exists
if ! git remote get-url origin &> /dev/null; then
    git remote add origin "$github_url"
    echo "✅ Remote added"
else
    git remote set-url origin "$github_url"
    echo "✅ Remote updated"
fi

# Push to GitHub
echo "Pushing to GitHub..."
git branch -M main
git push -u origin main
echo "✅ Pushed to GitHub"
echo ""

# Step 2: Railway
echo "🚀 STEP 2: Railway Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps in Railway:"
echo ""
echo "1. Go to https://railway.app"
echo "2. Sign up with GitHub (or log in)"
echo "3. Click 'New Project'"
echo "4. Select 'Deploy from GitHub repo'"
echo "5. Authorize Railway access to GitHub"
echo "6. Select your repository: luanna-travel-agent"
echo "7. Click 'Deploy'"
echo ""
echo "Railway will automatically:"
echo "  ✅ Clone your repo"
echo "  ✅ Read Dockerfile"
echo "  ✅ Build & deploy"
echo "  ✅ Give you a public URL"
echo ""
read -p "Have you deployed to Railway? (yes/no): " railway_done

if [ "$railway_done" != "yes" ]; then
    echo "⚠️  Please deploy to Railway first, then run this script again."
    exit 1
fi

echo ""
read -p "Enter your Railway URL (e.g., https://luanna-travel-agent.up.railway.app): " railway_url

# Test endpoint
echo ""
echo "🧪 Testing deployment..."
if curl -s "$railway_url/health" > /dev/null; then
    echo "✅ Health check passed!"
    echo "   Response: $(curl -s $railway_url/health)"
else
    echo "⚠️  Health check failed. Check Railway logs."
    echo "   URL might still be deploying. Wait a few seconds and test again."
fi

echo ""

# Step 3: Environment Variables
echo "⚙️  STEP 3: Environment Variables"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "You need to set environment variables in Railway Dashboard:"
echo ""
echo "Required:"
echo "  • ANTHROPIC_API_KEY (from https://console.anthropic.com/account/keys)"
echo "  • META_ACCESS_TOKEN (from https://developers.facebook.com/apps)"
echo "  • META_PHONE_NUMBER_ID"
echo "  • META_BUSINESS_ACCOUNT_ID"
echo "  • META_WEBHOOK_VERIFY_TOKEN (e.g., luanna_webhook_token)"
echo "  • META_APP_SECRET"
echo "  • TRAVELPAYOUTS_TOKEN"
echo "  • TRAVELPAYOUTS_MARKER (e.g., luanna)"
echo ""
echo "Instructions:"
echo "1. Go to Railway Dashboard → Your Project"
echo "2. Click 'Variables' (or 'Environment')"
echo "3. Add each variable above"
echo "4. Click 'Deploy' to apply changes"
echo ""
read -p "Have you added all environment variables? (yes/no): " env_done

if [ "$env_done" != "yes" ]; then
    echo "⚠️  Please add environment variables first."
    exit 1
fi

echo "✅ Environment variables configured"
echo ""

# Step 4: Redis
echo "💾 STEP 4: Redis (for HITL confirmations)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Instructions:"
echo "1. Railway Dashboard → Project → Marketplace"
echo "2. Search 'Redis'"
echo "3. Click 'Add'"
echo "4. Select plan (free available)"
echo "5. Click 'Add Plugin'"
echo ""
echo "Railway will automatically inject REDIS_URL"
echo ""
read -p "Have you added Redis? (yes/no): " redis_done

if [ "$redis_done" != "yes" ]; then
    echo "⚠️  Redis is required for HITL. Please add it."
    exit 1
fi

echo "✅ Redis configured"
echo ""

# Step 5: Meta Webhook
echo "🔗 STEP 5: Meta Cloud API Webhook"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Configure the webhook in Meta:"
echo ""
echo "1. Go to https://developers.facebook.com/apps"
echo "2. Select your app"
echo "3. WhatsApp → Configuration"
echo "4. Callback URL: $railway_url/webhook"
echo "5. Verify Token: luanna_webhook_token (or your custom token)"
echo "6. Subscribe to: messages, message_status"
echo "7. Click 'Verify and Save'"
echo ""
echo "Meta will:"
echo "  • Send a GET request to verify the webhook"
echo "  • Show ✅ Active when verified"
echo ""
read -p "Have you configured the Meta webhook? (yes/no): " webhook_done

if [ "$webhook_done" != "yes" ]; then
    echo "⚠️  Please configure the Meta webhook."
    exit 1
fi

echo "✅ Meta webhook configured"
echo ""

# Step 6: Test
echo "🧪 STEP 6: Final Test"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Send a test message from WhatsApp:"
echo ""
echo "1. Go to Meta Dashboard → WhatsApp → Configuration"
echo "2. Click 'Send a test message'"
echo "3. Type: 'Hola, quiero ir a Barcelona en junio'"
echo "4. Check Railway logs for response"
echo ""
read -p "Did you receive a response? (yes/no): " test_done

if [ "$test_done" != "yes" ]; then
    echo "⚠️  Webhook might not be working."
    echo "   Check Railway logs for errors:"
    echo "   Dashboard → Deployments → Logs"
    exit 1
fi

echo "✅ Webhook working!"
echo ""

# Summary
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║           ✅ LUANNA IS NOW IN PRODUCTION! ✅                  ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Your deployment is complete!"
echo ""
echo "📊 Monitoring:"
echo "   Dashboard: https://smith.langchain.com/"
echo "   Logs: https://railway.app/ → Your Project → Deployments"
echo ""
echo "📱 Send messages to your WhatsApp number!"
echo ""
echo "🚀 Your Luanna URL:"
echo "   $railway_url"
echo ""
echo "📈 Next steps:"
echo "   1. Monitor logs for errors"
echo "   2. Check latency on LangSmith"
echo "   3. Activate token optimization (Headroom + Toonify)"
echo "   4. Plan v2.0 improvements"
echo ""
echo "Questions? See DEPLOY.md"
echo ""
