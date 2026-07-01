# Crawl4AI needs a browser, so base on their image which ships Playwright +
# Chromium preinstalled. Cloud Run runs this container.
FROM unclecode/crawl4ai:0.4.24

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

ENV PORT=8080
EXPOSE 8080
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT}"]
