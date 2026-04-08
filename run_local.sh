#!/bin/bash
# Run Luanna locally with uvicorn

echo "🚀 Starting Luanna Travel Agent..."
echo "📊 LangGraph: 17 nodes"
echo "🤖 Models: Claude Haiku 4.5 + Sonnet 4.6"
echo "📱 Platform: Meta Cloud API"
echo ""

# Requirements
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "⚠️  ANTHROPIC_API_KEY not set. Add to .env or export it."
    echo "   export ANTHROPIC_API_KEY=sk-ant-..."
    echo ""
fi

if [ -z "$META_ACCESS_TOKEN" ]; then
    echo "⚠️  META_ACCESS_TOKEN not set. Add to .env for WhatsApp webhook."
    echo ""
fi

# Start Redis (optional, for HITL)
echo "💾 Starting Redis (for HITL confirmation state)..."
redis-server --daemonize yes --port 6379 2>/dev/null || echo "   (Redis not available, HITL will fail gracefully)"
echo ""

# Start server
echo "📡 Starting server on http://localhost:8000"
echo "   Webhook: POST http://localhost:8000/webhook"
echo "   Health: GET http://localhost:8000/health"
echo ""
echo "📊 LangSmith monitoring:"
echo "   export LANGCHAIN_TRACING_V2=true"
echo "   export LANGCHAIN_API_KEY=sk-..."
echo ""

/Library/Frameworks/Python.framework/Versions/3.14/bin/python3.14 -m uvicorn agent.main:app --host 0.0.0.0 --port 8000 --reload
