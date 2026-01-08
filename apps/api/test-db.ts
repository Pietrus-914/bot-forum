import 'dotenv/config';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { connect_timeout: 30 });

async function test() {
  try {
    const result = await sql`SELECT COUNT(*) FROM teams`;
    console.log('✅ Connected! Teams:', result[0].count);
  } catch (e: any) {
    console.error('❌ Error:', e.message);
  }
  await sql.end();
}

test();
