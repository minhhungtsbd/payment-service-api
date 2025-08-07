const { Client } = require('pg');
const moment = require('moment-timezone');

// Cấu hình kết nối database
const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'password',
  database: 'payment_service'
});

async function queryPayments() {
  try {
    await client.connect();
    console.log('✅ Đã kết nối thành công đến PostgreSQL\n');

    // Truy vấn tổng số giao dịch
    const countResult = await client.query('SELECT COUNT(*) as total FROM payments');
    const totalPayments = countResult.rows[0].total;
    console.log(`📊 Tổng số giao dịch: ${totalPayments}\n`);

    // Truy vấn giao dịch mới nhất
    const result = await client.query(`
      SELECT 
        transaction_id,
        content,
        amount,
        date,
        gate,
        account_receiver,
        created_at
      FROM payments 
      ORDER BY date DESC 
      LIMIT 20
    `);

    if (result.rows.length === 0) {
      console.log('❌ Không có giao dịch nào trong database');
      return;
    }

    console.log('🔄 Giao dịch mới nhất (20 giao dịch gần đây):\n');
    console.log('='.repeat(120));

    result.rows.forEach((row, index) => {
      const date = moment(row.date).tz('Asia/Ho_Chi_Minh').format('DD/MM/YYYY HH:mm:ss');
      const amount = new Intl.NumberFormat('vi-VN').format(row.amount);
      
      console.log(`\n${index + 1}. ${row.transaction_id}`);
      console.log(`   💰 Số tiền: ${amount} VND`);
      console.log(`   🏦 Ngân hàng: ${row.gate}`);
      console.log(`   📅 Thời gian: ${date}`);
      console.log(`   📝 Nội dung: ${row.content.substring(0, 80)}${row.content.length > 80 ? '...' : ''}`);
      console.log(`   👤 Tài khoản: ${row.account_receiver}`);
      console.log('-'.repeat(80));
    });

    // Thống kê theo ngân hàng
    const bankStats = await client.query(`
      SELECT 
        gate,
        COUNT(*) as count,
        SUM(amount) as total_amount
      FROM payments 
      GROUP BY gate 
      ORDER BY count DESC
    `);

    console.log('\n📈 Thống kê theo ngân hàng:');
    console.log('='.repeat(50));
    bankStats.rows.forEach(row => {
      const totalAmount = new Intl.NumberFormat('vi-VN').format(row.total_amount);
      console.log(`${row.gate}: ${row.count} giao dịch - ${totalAmount} VND`);
    });

    // Thống kê theo ngày
    const dailyStats = await client.query(`
      SELECT 
        DATE(date) as day,
        COUNT(*) as count,
        SUM(amount) as total_amount
      FROM payments 
      WHERE date >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(date) 
      ORDER BY day DESC
    `);

    console.log('\n📅 Thống kê 7 ngày gần đây:');
    console.log('='.repeat(50));
    dailyStats.rows.forEach(row => {
      const day = moment(row.day).format('DD/MM/YYYY');
      const totalAmount = new Intl.NumberFormat('vi-VN').format(row.total_amount);
      console.log(`${day}: ${row.count} giao dịch - ${totalAmount} VND`);
    });

  } catch (error) {
    console.error('❌ Lỗi:', error.message);
  } finally {
    await client.end();
    console.log('\n✅ Đã đóng kết nối database');
  }
}

// Chạy script
queryPayments(); 