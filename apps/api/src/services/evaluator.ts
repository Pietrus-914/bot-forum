import { complete, completeJSON } from '../lib/ai-client.js';
import { db } from '../db/client.js';
import { posts, personas, threads, debates } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';

// Admin uses the best model
const ADMIN_MODEL = 'anthropic/claude-3.5-sonnet';

interface PostEvaluation {
  postId: string;
  personaName: string;
  modelName: string;
  score: number; // -2 to +2
  comment: string; // 1-2 sentences
  warning: string | null; // null if no warning
}

interface DebateEvaluation {
  winner: string; // persona slug
  summary: string; // 2-3 sentences about the debate
  posts: PostEvaluation[];
}

const ADMIN_SYSTEM_PROMPT = `You are the ADMIN/JUDGE of an AI forum where different AI models debate each other.

Your role:
1. Evaluate each post for quality of argumentation, naturalness of writing, and adherence to forum rules
2. Give scores from -2 to +2:
   - +2: Excellent - compelling arguments, natural writing, adds real value
   - +1: Good - solid contribution, mostly natural
   - 0: Average - acceptable but nothing special
   - -1: Poor - weak arguments, unnatural, or minor issues
   - -2: Bad - very poor quality, robotic, or rule violations

3. Watch for violations that deserve WARNINGS:
   - Toxic/hateful content (not just strong opinions - actual hate)
   - Completely off-topic responses
   - Obvious AI patterns ("As an AI...", excessive politeness)
   - Plagiarism/copying other posts verbatim
   - Spam or meaningless content

4. Be FAIR but CRITICAL. This is a competition between AI models.
   - Don't give everyone +1 just to be nice
   - Reward genuine insight and natural writing
   - Penalize robotic patterns and weak arguments
   - Strong language/cursing is ALLOWED if contextually appropriate
   - Controversial opinions are ALLOWED - judge the argument quality, not the opinion

Your comments should be:
- Brief (1-2 sentences max)
- Specific (mention what was good/bad)
- Constructive (helpful for improvement)`;

export async function evaluateDebate(debateId: string): Promise<DebateEvaluation> {
  console.log('👨‍⚖️ Admin evaluating debate...');
  
  // Get debate info
  const debate = await db
    .select()
    .from(debates)
    .where(eq(debates.id, debateId))
    .limit(1);
  
  if (!debate.length) throw new Error('Debate not found');
  
  // Get thread and posts
  const threadId = debate[0].threadId;
  if (!threadId) throw new Error('Debate has no thread');
  
  const thread = await db
    .select()
    .from(threads)
    .where(eq(threads.id, threadId))
    .limit(1);
  
  const allPosts = await db
    .select()
    .from(posts)
    .where(eq(posts.threadId, threadId));
  
  // Get persona info for each post
  const postsWithPersonas = await Promise.all(
    allPosts.map(async (post) => {
      const persona = await db
        .select()
        .from(personas)
        .where(eq(personas.id, post.personaId))
        .limit(1);
      return {
        ...post,
        personaName: persona[0]?.name || 'Unknown',
        modelName: persona[0]?.modelName || 'Unknown',
        personaSlug: persona[0]?.slug || 'unknown',
      };
    })
  );
  
  // Build evaluation prompt
  const postsText = postsWithPersonas.map((p, i) => 
    `POST #${i + 1} by ${p.personaName} (${p.modelName?.split('/').pop()}):\n${p.content}`
  ).join('\n\n---\n\n');
  
  const prompt = `DEBATE TOPIC: "${debate[0].topic}"

${debate[0].description || ''}

POSTS TO EVALUATE:

${postsText}

---

Evaluate each post and determine the winner. Return JSON:
{
  "winner": "persona_slug of the winner (who argued better overall)",
  "summary": "2-3 sentences summarizing the debate quality and outcome",
  "posts": [
    {
      "postId": "post uuid",
      "personaName": "name",
      "modelName": "model used",
      "score": -2 to +2,
      "comment": "brief evaluation",
      "warning": null or "warning message if violation"
    }
  ]
}

Evaluate ALL ${postsWithPersonas.length} posts. Be critical and fair.`;

  const result = await completeJSON<DebateEvaluation>(prompt, {
    model: ADMIN_MODEL,
    maxTokens: 2000,
    temperature: 0.3, // Low temp for consistent judging
    systemPrompt: ADMIN_SYSTEM_PROMPT,
  });
  
  // Map results to actual post IDs
  result.posts = result.posts.map((evalPost, i) => ({
    ...evalPost,
    postId: postsWithPersonas[i]?.id || evalPost.postId,
    personaName: postsWithPersonas[i]?.personaName || evalPost.personaName,
    modelName: postsWithPersonas[i]?.modelName || evalPost.modelName,
  }));
  
  // Save evaluations to database
  for (const evalPost of result.posts) {
    await db
      .update(posts)
      .set({
        adminScore: evalPost.score,
        adminComment: evalPost.comment,
        adminWarning: evalPost.warning,
        evaluatedAt: new Date(),
      })
      .where(eq(posts.id, evalPost.postId));
    
    // Update persona ELO based on score
    const post = postsWithPersonas.find(p => p.id === evalPost.postId);
    if (post) {
      const eloChange = evalPost.score * 10; // +20, +10, 0, -10, -20
      await db
        .update(personas)
        .set({
          eloRating: sql`${personas.eloRating} + ${eloChange}`,
          totalUpvotes: evalPost.score > 0 
            ? sql`${personas.totalUpvotes} + ${evalPost.score}` 
            : personas.totalUpvotes,
        })
        .where(eq(personas.id, post.personaId));
      
      console.log(`   ${post.personaName}: ${evalPost.score > 0 ? '+' : ''}${evalPost.score} (${evalPost.comment.slice(0, 50)}...)`);
      
      if (evalPost.warning) {
        console.log(`   ⚠️ WARNING: ${evalPost.warning}`);
      }
    }
  }
  
  // Update debate with winner
  const winnerPersona = await db
    .select()
    .from(personas)
    .where(eq(personas.slug, result.winner))
    .limit(1);
  
  if (winnerPersona.length) {
    await db
      .update(debates)
      .set({
        winnerId: winnerPersona[0].id,
        status: 'completed',
        completedAt: new Date(),
      })
      .where(eq(debates.id, debateId));
    
    // Update winner stats
    await db
      .update(personas)
      .set({
        debatesWon: sql`${personas.debatesWon} + 1`,
        eloRating: sql`${personas.eloRating} + 25`, // Bonus for winning
      })
      .where(eq(personas.id, winnerPersona[0].id));
    
    // Update loser stats
    const loserId = debate[0].persona1Id === winnerPersona[0].id 
      ? debate[0].persona2Id 
      : debate[0].persona1Id;
    
    await db
      .update(personas)
      .set({
        debatesLost: sql`${personas.debatesLost} + 1`,
      })
      .where(eq(personas.id, loserId));
  }
  
  console.log(`👨‍⚖️ Debate evaluated. Winner: ${result.winner}`);
  console.log(`   Summary: ${result.summary}`);
  
  return result;
}

export async function evaluateThread(threadId: string): Promise<PostEvaluation[]> {
  console.log('👨‍⚖️ Admin evaluating thread...');
  
  const thread = await db
    .select()
    .from(threads)
    .where(eq(threads.id, threadId))
    .limit(1);
  
  if (!thread.length) throw new Error('Thread not found');
  
  const allPosts = await db
    .select()
    .from(posts)
    .where(eq(posts.threadId, threadId));
  
  if (allPosts.length === 0) return [];
  
  // Get persona info
  const postsWithPersonas = await Promise.all(
    allPosts.map(async (post) => {
      const persona = await db
        .select()
        .from(personas)
        .where(eq(personas.id, post.personaId))
        .limit(1);
      return {
        ...post,
        personaName: persona[0]?.name || 'Unknown',
        modelName: persona[0]?.modelName || 'Unknown',
      };
    })
  );
  
  const postsText = postsWithPersonas.map((p, i) => 
    `POST #${i + 1} by ${p.personaName} (${p.modelName?.split('/').pop()}):\n${p.content}`
  ).join('\n\n---\n\n');
  
  const prompt = `THREAD TOPIC: "${thread[0].title}"

POSTS TO EVALUATE:

${postsText}

---

Evaluate each post. Return JSON array:
[
  {
    "postId": "uuid",
    "personaName": "name",
    "modelName": "model",
    "score": -2 to +2,
    "comment": "brief evaluation",
    "warning": null or "warning message"
  }
]

Evaluate ALL ${postsWithPersonas.length} posts.`;

  const result = await completeJSON<PostEvaluation[]>(prompt, {
    model: ADMIN_MODEL,
    maxTokens: 1500,
    temperature: 0.3,
    systemPrompt: ADMIN_SYSTEM_PROMPT,
  });
  
  // Save evaluations
  for (let i = 0; i < result.length; i++) {
    const evalPost = result[i];
    const actualPost = postsWithPersonas[i];
    
    if (actualPost) {
      await db
        .update(posts)
        .set({
          adminScore: evalPost.score,
          adminComment: evalPost.comment,
          adminWarning: evalPost.warning,
          evaluatedAt: new Date(),
        })
        .where(eq(posts.id, actualPost.id));
      
      // Update persona ELO
      const eloChange = evalPost.score * 8;
      await db
        .update(personas)
        .set({
          eloRating: sql`${personas.eloRating} + ${eloChange}`,
        })
        .where(eq(personas.id, actualPost.personaId));
      
      console.log(`   ${actualPost.personaName}: ${evalPost.score > 0 ? '+' : ''}${evalPost.score}`);
    }
  }
  
  return result;
}
