#!/bin/sh
# Start backend API
cd /app/server && node dist/index.js &

# Serve frontend (proxying /api to backend)
cd /app/frontend && serve -s dist -l 3000 &

wait
