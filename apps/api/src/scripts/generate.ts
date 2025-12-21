import 'dotenv/config';
import { generateThread, createDebate } from '../services/orchestrator.js';
import { evaluateDebate, evaluateThread } from '../services/evaluator.js';
import { db } from '../db/client.js';
import { debates, threads } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';

const args = process.argv.slice(2);
const command = args[0] || 'thread';
const count = parseInt(args[1] || '1');
const shouldEvaluate = args.includes('--eval') || args.includes('-e');

async function main() {
  console.log(`\n🤖 AI Forum Content Generator\n${'━'.repeat(40)}\n`);
  
  try {
    if (command === 'thread' || command === 'threads') {
      for (let i = 0; i < count; i++) {
        console.log(`\n📝 Generating thread ${i + 1}/${count}...`);
        const thread = await generateThread();
        console.log(`✅ Created: ${thread.title}\n`);
        
        if (shouldEvaluate) {
          console.log(`\n👨‍⚖️ Admin evaluating thread...`);
          await evaluateThread(thread.id);
        }
        
        if (i < count - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    } else if (command === 'debate' || command === 'debates') {
      for (let i = 0; i < count; i++) {
        console.log(`\n🥊 Creating debate ${i + 1}/${count}...`);
        const debate = await createDebate();
        console.log(`✅ Created: ${debate.topic}\n`);
        
        if (shouldEvaluate) {
          console.log(`\n👨‍⚖️ Admin evaluating debate...`);
          await evaluateDebate(debate.id);
        }
        
        if (i < count - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    } else if (command === 'evaluate' || command === 'eval') {
      // Evaluate existing content
      const type = args[1] || 'debate';
      
      if (type === 'debate' || type === 'debates') {
        // Get latest unevaluated debate
        const debate = await db
          .select()
          .from(debates)
          .where(eq(debates.status, 'active'))
          .orderBy(desc(debates.createdAt))
          .limit(1);
        
        if (debate.length) {
          console.log(`\n👨‍⚖️ Admin evaluating debate: ${debate[0].topic}`);
          await evaluateDebate(debate[0].id);
        } else {
          console.log('No active debates to evaluate');
        }
      } else if (type === 'thread' || type === 'threads') {
        // Get latest thread
        const thread = await db
          .select()
          .from(threads)
          .orderBy(desc(threads.createdAt))
          .limit(1);
        
        if (thread.length) {
          console.log(`\n👨‍⚖️ Admin evaluating thread: ${thread[0].title}`);
          await evaluateThread(thread[0].id);
        } else {
          console.log('No threads to evaluate');
        }
      }
    } else {
      console.log('Usage:');
      console.log('  npm run generate thread [count]    - Generate discussion threads');
      console.log('  npm run generate debate [count]    - Generate AI vs AI debates');
      console.log('  npm run generate eval debate       - Evaluate latest debate');
      console.log('  npm run generate eval thread       - Evaluate latest thread');
      console.log('');
      console.log('Options:');
      console.log('  --eval, -e                         - Auto-evaluate after generation');
    }
    
    console.log('\n🎉 Done!\n');
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  process.exit(0);
}

main();
