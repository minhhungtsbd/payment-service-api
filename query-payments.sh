#!/bin/bash

echo "🔍 Truy vấn giao dịch từ database..."
echo "=================================="

# Kiểm tra xem có cần cài dependencies không
if [ ! -d "node_modules" ]; then
    echo "📦 Cài đặt dependencies..."
    npm install pg moment-timezone
fi

# Chạy script Node.js
node query-payments.js 