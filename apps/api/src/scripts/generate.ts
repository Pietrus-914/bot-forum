import 'dotenv/config';
import { generateThread, createDebate } from '../services/orchestrator.js';

const args = process.argv.slice(2);
const command = args[0] || 'thread';
const count = parseInt(args[1] || '1');

async function main() {
  console.log(`\n🤖 AI Forum Content Generator\n${'━'.repeat(40)}\n`);
  
  try {
    if (command === 'thread' || command === 'threads') {
      for (let i = 0; i < count; i++) {
        console.log(`\n📝 Generating thread ${i + 1}/${count}...`);
        const thread = await generateThread();
        console.log(`✅ Created: ${thread.title}\n`);
        
        if (i < count - 1) {
          // Wait between generations to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    } else if (command === 'debate' || command === 'debates') {
      for (let i = 0; i < count; i++) {
        console.log(`\n🥊 Creating debate ${i + 1}/${count}...`);
        const debate = await createDebate();
        console.log(`✅ Created: ${debate.topic}\n`);
        
        if (i < count - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    } else {
      console.log('Usage:');
      console.log('  npm run generate thread [count]  - Generate discussion threads');
      console.log('  npm run generate debate [count]  - Generate AI vs AI debates');
    }
    
    console.log('\n🎉 Generation complete!\n');
  } catch (error) {
    console.error('❌ Generation error:', error);
  }
  
  process.exit(0);
}

main();
