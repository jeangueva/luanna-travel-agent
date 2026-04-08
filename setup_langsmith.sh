#!/bin/bash
# Setup LangSmith observability for Luanna

echo "🔧 LangSmith Setup for Luanna Travel Agent"
echo "==========================================="
echo ""

# Check if API key is provided
if [ -z "$1" ]; then
    echo "Usage: ./setup_langsmith.sh <your_langsmith_api_key>"
    echo ""
    echo "Steps:"
    echo "  1. Get your LangSmith API key:"
    echo "     https://smith.langchain.com/settings/api_keys"
    echo ""
    echo "  2. Run:"
    echo "     export LANGSMITH_API_KEY=sk-..."
    echo "     ./setup_langsmith.sh sk-..."
    echo ""
    echo "  3. Or set in .env:"
    echo "     LANGCHAIN_API_KEY=sk-..."
    echo "     LANGCHAIN_TRACING_V2=true"
    exit 1
fi

LANGSMITH_API_KEY=$1

echo "✅ Setting up LangSmith..."
echo ""

# Update .env
echo "📝 Updating .env file..."
sed -i.bak "s/LANGCHAIN_TRACING_V2=false/LANGCHAIN_TRACING_V2=true/" .env
sed -i.bak "s|LANGCHAIN_API_KEY=$|LANGCHAIN_API_KEY=$LANGSMITH_API_KEY|" .env

# Export for current session
export LANGCHAIN_TRACING_V2=true
export LANGCHAIN_API_KEY=$LANGSMITH_API_KEY
export LANGCHAIN_PROJECT=luanna

echo "✅ LangSmith configured!"
echo ""
echo "📊 Monitoring dashboard:"
echo "   https://smith.langchain.com/"
echo ""
echo "🚀 Run Luanna with tracing enabled:"
echo "   export LANGCHAIN_TRACING_V2=true"
echo "   export LANGCHAIN_API_KEY=$LANGSMITH_API_KEY"
echo "   uvicorn agent.main:app --reload"
echo ""
echo "📈 You'll see:"
echo "   - All 17 nodes in the graph visualization"
echo "   - Latency per node"
echo "   - Token usage"
echo "   - Error tracking"
echo "   - Cost analysis"
echo ""
