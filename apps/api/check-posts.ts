import 'dotenv/config';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!);

async function check() {
  // Check user_posts
  const userPosts = await sql`SELECT * FROM user_posts ORDER BY created_at DESC LIMIT 5`;
  console.log('User posts in DB:', userPosts.length);
  console.log(userPosts);
  
  // Check users
  const users = await sql`SELECT id, email, name FROM users`;
  console.log('\nUsers:', users);
  
  await sql.end();
}

check();
