#!/bin/bash

# Hàm kiểm tra lỗi
check_logs() {
    docker compose logs app | grep -q 'EISDIR' && return 1
    docker compose logs app | grep -q 'DeprecationWarning' && return 2
    return 0
}

# Vòng lặp kiểm tra lỗi và tự động khởi động lại
while true; do
    check_logs
    result=$?
    if [ $result -eq 1 ]; then
        echo "Error detected: EISDIR. Fixing configuration and restarting app..." >&2
        # Sửa đường dẫn nếu cần thiết
        sed -i 's|/root/payment-service/config/config.yml|/root/payment-service/.docker/config/config.yml|' docker-compose.yml
        # Khởi động lại dịch vụ
        docker compose down
        docker compose up -d
    elif [ $result -eq 2 ]; then
        echo "Warning: Deprecation detected. No restart needed." >&2
    fi
    sleep 30  # Kiểm tra lại mỗi 30 giây

done

