import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const publicDir = join(__dirname, 'public');
const envFile = join(__dirname, '.env');

loadLocalEnv(envFile);

const port = Number(process.env.PORT || 4173);
const groqApiKey = process.env.GROQ_API_KEY || process.env.GROK_API_KEY || '';
const groqModel = process.env.GROQ_CHAT_MODEL || process.env.GROK_CHAT_MODEL || 'llama-3.1-8b-instant';
const groqWebSearchModel =
  process.env.GROQ_WEB_SEARCH_MODEL || process.env.GROK_WEB_SEARCH_MODEL || 'groq/compound-mini';
const groqChatCompletionsUrl =
  process.env.GROQ_CHAT_COMPLETIONS_URL ||
  process.env.GROK_CHAT_COMPLETIONS_URL ||
  'https://api.groq.com/openai/v1/chat/completions';
const groqMaxTokens =
  Number.parseInt(process.env.GROQ_MAX_TOKENS || process.env.GROK_MAX_TOKENS || '550', 10) || 550;
const resumeDownloadPath = '/assets/md-faizur-rahman-khan-resume.pdf';
const currentDateLabel = getCurrentDateLabel();
const currentDateIso = getCurrentDateIso();
const groqRetryDelays = [700, 1400, 2600];
const fifaWorldCupScoreboardUrl = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';

/*
 * Legacy OpenAI, DeepSeek, and OpenCode providers are intentionally not used.
 * Dynamic portfolio chat now uses Groq/Grok only.
 *
 * const chatModel = process.env.PORTFOLIO_CHAT_MODEL || 'gpt-4o-mini';
 * const deepseekModel = process.env.DEEPSEEK_CHAT_MODEL || 'deepseek-v4-flash';
 */
const rateLimitByIp = new Map();

const profileContext = `
Name: Md. Faizur Rahman Khan.
Title: Senior Software Engineer.
Location: Dhaka, Bangladesh.
Contact: +8801782782306, khan.nayeem8662@gmail.com.
Portfolio: https://faizurrahman-portfolio.web.app.
LinkedIn: linkedin.com/in/mdfaizurrahmankhan.
GitHub: https://github.com/faizkhan01.
Downloadable resume: ${resumeDownloadPath}.

Professional summary:
Faizur is a dedicated, results-driven software engineer with 6 years of professional engineering experience, focused on scalable and secure backend systems. His core strengths are Node.js, Express.js, NestJS, REST APIs, GraphQL, microservices, MongoDB, PostgreSQL, Redis, Docker, AWS, Kubernetes, and performance optimization. He has shipped maintainable production systems and AI-powered backend workflows.

Skills:
Languages: JavaScript, TypeScript.
Backend: Node.js, Express.js, NestJS.
Frontend and mobile: React.js, Next.js, React Native, Redux, Tailwind CSS, Material UI, Ant Design, Bootstrap.
Authentication and authorization: JWT, OAuth2, Google/Facebook/Apple social login, OTP verification, password reset, token lifecycle management, route-level guards.
Databases and caching: MongoDB, PostgreSQL, Redis, Prisma, TypeORM, Mongoose.
API and architecture: REST, GraphQL, microservices, RabbitMQ, BullMQ, dependency injection, decorator pattern, module pattern, singleton, factory, strategy, chain of responsibility, observer, proxy, facade, adapter.
Cloud and DevOps: Docker, AWS EKS, EC2, VPC, S3, Lambda, RDS, OpenSearch, GuardDuty, CloudFormation, CloudWatch, Kubernetes, Helm, Istio, Cluster Autoscaler, Metrics Server, Cloudflare.
CI/CD and observability: Git, GitHub Actions, GitLab CI/CD, Prometheus, Grafana, Winston, ELK Stack.
Payments: Stripe, SSLCOMMERZ.
Testing and tools: Jest, Supertest, Swagger, Postman, GraphQL Playground, pgAdmin, MongoDB Compass, MongoDB Atlas, Jira, Trello, VS Code, DevTools, NPM, Yarn, Webpack, Figma.
AI-assisted development tools: Claude Code, Cursor, GitHub Copilot, Codex.

Professional experience:
Chromatics AI LLC, Senior Software Engineer, September 2025 to present.
- Architected and scaled a distributed microservice-based backend platform using NestJS, TypeScript, PostgreSQL, Prisma ORM, Redis, and Docker.
- Separated core product APIs from ingestion and scraping worker services to improve scalability, deployment agility, and fault isolation.
- Designed AI-powered backend workflows integrating OpenAI and Claude APIs for contextual conversations, memory/context orchestration, classification, content enrichment, query refinement, and retrieval-driven response systems.
- Built secure production authentication and authorization systems with JWT, OAuth/social login, OTP verification, password reset, token lifecycle management, and access guards.
- Engineered Bull/BullMQ and Redis queue pipelines with retries, exponential backoff, schedulers, worker orchestration, and job observability.
- Built ingestion and normalization pipelines for RSS, WordPress, and external media sources using Cheerio, parsing, API integrations, deduplication, filtering guardrails, and structured persistence.
- Improved DTO/schema validation, exception handling, API contracts, CORS/security hardening, and Swagger documentation.
- Applied automated testing strategies and production-focused backend practices.

The Red IT, Senior Software Engineer, November 2024 to September 2025.
- Led and maintained key features of the Woztell chatbot SaaS/PaaS platform using AWS Lambda, Express.js, and GraphQL.
- Integrated Calendly and Airtable through AWS Lambda serverless functions to enhance WhatsApp flows.
- Planned and implemented a custom SSO system for the inbox module.
- Managed Kubernetes-based single-tenant PaaS deployments for isolated client environments.
- Improved scalability with separate read and write databases.
- Improved inbox performance by 60% through refactoring and legacy module optimization.

Sayburgh Solutions Limited, Senior Back End Developer, February 2022 to October 2024.
- Led and mentored 4 developers building RESTful and GraphQL APIs for a multi-tenant SaaS HR management system, VOD streaming, online education, and ticketing platforms.
- Designed and optimized MongoDB and PostgreSQL schemas with indexes, joins, aggregation pipelines, and rate-limiting strategies.
- Implemented Redis caching, Docker containerization, and CI/CD pipelines.
- Built multitenancy support for HR management.
- Contributed to a VOD mobile app with React Native.
- Contributed to a restaurant management system using microservices, gRPC, and RabbitMQ.
- Facilitated code reviews and maintained clean, testable architecture.

Jirle, Software Developer, September 2022 to December 2023.
- Developed and maintained an e-commerce platform with Next.js frontend and NestJS backend.
- Delivered REST APIs, documented with Swagger, and improved performance, security, and reliability.
- Improved PostgreSQL query efficiency and used Redis caching and Docker.

Brain Station 23 Limited, Associate Software Engineer, January 2021 to September 2021.
- Contributed to client projects for Robi Axiata Limited and two international clients.
- Built responsive frontends with React.js, Angular, Vue.js, and TypeScript.
- Implemented Redux state management for performance and maintainability.

Education:
Daffodil International University, B.Sc. in Computer Science and Engineering, 2015-2020.
Dhaka Megacity College, H.S.C. in Science, 2012-2014.
Safiuddin Sarker Academy & College, S.S.C. in Science, 2010-2012.

Problem solving:
HackerRank and LeetCode are listed in the CV.
`;

const server = createServer(async (request, response) => {
  try {
    if (request.method === 'POST' && request.url === '/api/chat') {
      await handleChat(request, response);
      return;
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      sendJson(response, 405, { error: 'Method not allowed' });
      return;
    }

    await serveStatic(request, response, request.method === 'HEAD');
  } catch (error) {
    console.error('[server]', error);
    sendJson(response, 500, { error: 'Unexpected server error' });
  }
});

server.listen(port, () => {
  console.log(`Portfolio website running at http://localhost:${port}`);
});

async function handleChat(request, response) {
  const ipAddress = getIpAddress(request);
  if (!allowRequest(ipAddress)) {
    sendJson(response, 429, {
      error: 'Too many chat requests. Please wait a moment and try again.',
    });
    return;
  }

  const body = await readJsonBody(request);
  const question = String(body.question || '').trim();
  const messages = Array.isArray(body.messages) ? body.messages.slice(-8) : [];

  if (question.length < 2 || question.length > 1200) {
    sendJson(response, 400, { error: 'Question must be between 2 and 1200 characters.' });
    return;
  }

  if (isFifaWorldCupUpdateQuestion(question)) {
    const result = await generateFifaWorldCupMatchUpdates();
    if (body.stream === true) {
      sendStreamedStaticAnswer(response, result.answer, result.provider);
      return;
    }

    sendJson(response, 200, result);
    return;
  }

  if (!groqApiKey) {
    sendJson(response, 503, {
      error: 'Portfolio chat is not configured. Set GROK_API_KEY or GROQ_API_KEY on the server.',
    });
    return;
  }

  const groqRequestOptions = getGroqRequestOptions(question);
  const messagesForModel = [
    {
      role: 'system',
      content: buildSystemPrompt(groqRequestOptions),
    },
    ...getContextMessages(messages, groqRequestOptions),
    {
      role: 'user',
      content: buildUserQuestion(question, groqRequestOptions),
    },
  ];

  try {
    if (body.stream === true) {
      await streamDynamicPortfolioAnswer(messagesForModel, response, groqRequestOptions);
      return;
    }

    const result = await generateDynamicPortfolioAnswer(messagesForModel, groqRequestOptions);

    sendJson(response, 200, {
      answer: cleanDynamicAnswer(result.answer),
      provider: result.provider,
    });
  } catch (error) {
    console.error('[portfolio-chat]', error.message);
    sendJson(response, 503, {
      error: 'The portfolio chat is temporarily unavailable. Please try again in a moment.',
    });
  }
}

async function streamDynamicPortfolioAnswer(messages, response, groqRequestOptions) {
  response.writeHead(200, {
    'Content-Type': 'application/x-ndjson; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  try {
    if (groqRequestOptions.provider === 'groq-web-search') {
      const result = await generateDynamicPortfolioAnswer(messages, groqRequestOptions);
      writeJsonLine(response, {
        type: 'chunk',
        delta: cleanDynamicAnswer(result.answer),
      });
      writeJsonLine(response, {
        type: 'done',
        provider: result.provider,
      });
      return;
    }

    let hasContent = false;
    await retryGroqRequest(
      async () => {
        hasContent = false;
        await streamGroq(messages, groqRequestOptions, (delta) => {
          if (!delta) return;
          hasContent = true;
          writeJsonLine(response, {
            type: 'chunk',
            delta,
          });
        });
      },
      {
        shouldRetry: (error) => !hasContent && isRetryableGroqError(error),
      },
    );

    if (!hasContent) throw new Error('Groq returned an empty stream');

    writeJsonLine(response, {
      type: 'done',
      provider: groqRequestOptions.provider,
    });
  } catch (error) {
    console.error('[portfolio-chat-stream]', error.message);
    writeJsonLine(response, {
      type: 'error',
      error: 'The portfolio chat is temporarily unavailable. Please try again in a moment.',
    });
  } finally {
    response.end();
  }
}

function sendStreamedStaticAnswer(response, answer, provider) {
  response.writeHead(200, {
    'Content-Type': 'application/x-ndjson; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  writeJsonLine(response, {
    type: 'chunk',
    delta: answer,
  });
  writeJsonLine(response, {
    type: 'done',
    provider,
  });
  response.end();
}

async function generateDynamicPortfolioAnswer(messages, groqRequestOptions) {
  const groqResult = await retryGroqRequest(() => callGroq(messages, groqRequestOptions));

  if (groqRequestOptions.provider === 'groq-web-search' && !groqResult.sources.length) {
    return {
      answer: buildUnverifiedCurrentInfoAnswer(groqRequestOptions),
      provider: groqRequestOptions.provider,
    };
  }

  const answer =
    groqRequestOptions.provider === 'groq-web-search'
      ? appendVerifiedWebSources(groqResult.answer, groqResult.sources)
      : groqResult.answer;

  if (answer) {
    return {
      answer,
      provider: groqRequestOptions.provider,
    };
  }

  throw new Error('Groq returned an empty response');
}

async function callGroq(messages, groqRequestOptions) {
  const aiResponse = await fetchWithTimeout(groqChatCompletionsUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${groqApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: groqRequestOptions.model,
      messages,
      temperature: groqRequestOptions.provider === 'groq-web-search' ? 0 : 0.2,
      max_tokens: groqRequestOptions.maxTokens,
      stream: false,
    }),
  }, groqRequestOptions.timeoutMs);

  if (!aiResponse.ok) {
    const errorBody = await aiResponse.text();
    const error = new Error(`HTTP ${aiResponse.status}: ${errorBody.slice(0, 500)}`);
    error.status = aiResponse.status;
    throw error;
  }

  const data = await aiResponse.json();
  return {
    answer: extractChatCompletionText(data),
    sources: extractGroqToolSources(data),
  };
}

async function streamGroq(messages, groqRequestOptions, onDelta) {
  const aiResponse = await fetchWithTimeout(groqChatCompletionsUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${groqApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: groqRequestOptions.model,
      messages,
      temperature: groqRequestOptions.provider === 'groq-web-search' ? 0 : 0.2,
      max_tokens: groqRequestOptions.maxTokens,
      stream: true,
    }),
  }, groqRequestOptions.timeoutMs);

  if (!aiResponse.ok) {
    const errorBody = await aiResponse.text();
    const error = new Error(`HTTP ${aiResponse.status}: ${errorBody.slice(0, 500)}`);
    error.status = aiResponse.status;
    throw error;
  }

  if (!aiResponse.body) throw new Error('Groq did not return a response stream');

  const reader = aiResponse.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split(/\n\n/);
    buffer = events.pop() || '';

    for (const event of events) {
      if (processGroqStreamEvent(event, onDelta)) return;
    }
  }

  if (buffer) processGroqStreamEvent(buffer, onDelta);
}

async function retryGroqRequest(operation, options = {}) {
  const shouldRetry = options.shouldRetry || isRetryableGroqError;
  let lastError;

  for (let attempt = 0; attempt <= groqRetryDelays.length; attempt += 1) {
    try {
      return await operation(attempt + 1);
    } catch (error) {
      lastError = error;
      if (attempt >= groqRetryDelays.length || !shouldRetry(error)) break;

      console.warn(`[groq-retry] attempt ${attempt + 1} failed: ${error.message}`);
      await wait(groqRetryDelays[attempt]);
    }
  }

  throw lastError;
}

function isRetryableGroqError(error) {
  const status = Number(error?.status || 0);
  return (
    error?.name === 'AbortError' ||
    status === 429 ||
    status >= 500 ||
    /\b(ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|fetch failed|timeout)\b/i.test(error?.message || '')
  );
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/*
 * Legacy OpenAI / DeepSeek implementation, commented out by request.
 *
 * async function generatePortfolioAnswer(messages) {
 *   const errors = [];
 *
 *   if (process.env.OPENAI_API_KEY) {
 *     try {
 *       return {
 *         answer: await callOpenAI(messages),
 *         provider: 'openai',
 *       };
 *     } catch (error) {
 *       errors.push(`OpenAI: ${error.message}`);
 *       console.error('[openai]', error.message);
 *     }
 *   }
 *
 *   if (process.env.DEEPSEEK_API_KEY) {
 *     try {
 *       return {
 *         answer: await callDeepSeek(messages),
 *         provider: 'deepseek',
 *       };
 *     } catch (error) {
 *       errors.push(`DeepSeek: ${error.message}`);
 *       console.error('[deepseek]', error.message);
 *     }
 *   }
 *
 *   throw new Error(`All configured AI providers failed. ${errors.join(' | ')}`);
 * }
 *
 * async function callOpenAI(messages) {
 *   const aiResponse = await fetchWithTimeout('https://api.openai.com/v1/responses', {
 *     method: 'POST',
 *     headers: {
 *       Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
 *       'Content-Type': 'application/json',
 *     },
 *     body: JSON.stringify({
 *       model: chatModel,
 *       input: messages,
 *       temperature: 0.25,
 *       max_output_tokens: 650,
 *     }),
 *   });
 *
 *   if (!aiResponse.ok) {
 *     const errorBody = await aiResponse.text();
 *     throw new Error(`HTTP ${aiResponse.status}: ${errorBody.slice(0, 500)}`);
 *   }
 *
 *   const data = await aiResponse.json();
 *   return extractOpenAIOutputText(data);
 * }
 *
 * async function callDeepSeek(messages) {
 *   const aiResponse = await fetchWithTimeout('https://api.deepseek.com/chat/completions', {
 *     method: 'POST',
 *     headers: {
 *       Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
 *       'Content-Type': 'application/json',
 *     },
 *     body: JSON.stringify({
 *       model: deepseekModel,
 *       messages,
 *       temperature: 0.25,
 *       max_tokens: 650,
 *       stream: false,
 *     }),
 *   });
 *
 *   if (!aiResponse.ok) {
 *     const errorBody = await aiResponse.text();
 *     throw new Error(`HTTP ${aiResponse.status}: ${errorBody.slice(0, 500)}`);
 *   }
 *
 *   const data = await aiResponse.json();
 *   return extractDeepSeekOutputText(data);
 * }
 */

async function fetchWithTimeout(url, options, timeoutMs = 45_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function serveStatic(request, response, headOnly = false) {
  const rawPath = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  const requestedPath = rawPath === '/' ? '/index.html' : rawPath;
  const safePath = normalize(requestedPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = join(publicDir, safePath);

  if (!filePath.startsWith(publicDir)) {
    sendJson(response, 403, { error: 'Forbidden' });
    return;
  }

  try {
    const file = await readFile(filePath);
    response.writeHead(200, {
      'Content-Type': contentTypeFor(filePath),
      'Cache-Control': cacheControlFor(filePath),
    });
    response.end(headOnly ? undefined : file);
  } catch {
    const file = await readFile(join(publicDir, 'index.html'));
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(headOnly ? undefined : file);
  }
}

function buildSystemPrompt(groqRequestOptions = { provider: 'groq' }) {
  if (groqRequestOptions.provider === 'groq-web-search') return buildWebSearchSystemPrompt();

  return `
You are the AI portfolio assistant for Md. Faizur Rahman Khan. Recruiters and hiring managers use you to evaluate his fit for senior software engineering roles.

Answer using only the verified profile context below. Be confident, concise, professional, and recruiter-friendly. If a question asks for something not present in the context, say that the CV does not specify it and offer the closest relevant verified detail. Do not invent employment dates, degrees, certifications, salary, notice period, citizenship, references, or private personal details. If asked for contact information, share only the public contact details in the context. If asked to compare him to a role, map his verified experience to the role requirements.

Verified profile context:
${profileContext}

Answer style:
- Give complete answers only. Never end after a heading or an unfinished bullet.
- Prefer plain text with short bullets; do not use markdown bold markers.
- For questions about AI systems, explicitly mention the verified systems: contextual conversation pipelines, memory/context orchestration, classification, content enrichment, query refinement, retrieval-driven responses, and the backend infrastructure around them.
- For questions about AI work, AI projects, OpenAI, Claude, LLMs, or AI integrations, focus the answer on verified AI-related work instead of giving a generic profile summary.
- If asked for a downloadable resume or CV, provide this exact markdown link: [Download Md. Faizur Rahman Khan Resume](${resumeDownloadPath})
- For current events, latest news, weather, prices, sports, recent releases, or any topic that needs up-to-date information, use web search when available and mention that the answer is based on current web results. Do not invent source URLs. Only include source URLs when they are full https URLs from web results.
- If a capability is inferred from the CV but not named directly, say "based on the CV" before explaining it.
`;
}

function buildWebSearchSystemPrompt() {
  return `
You are the web-search assistant inside Md. Faizur Rahman Khan's portfolio chat.

Current date: ${currentDateLabel}.

For current events, latest news, weather, prices, sports, recent releases, wars, conflicts, public officeholders, government leaders, elections, company leadership, or world happenings:
- You must use current web-search results before answering.
- Answer only from current web results, not from model memory.
- Mention the as-of date: ${currentDateLabel}.
- For public officeholders or leaders, verify against recent official pages and/or multiple credible news results when available. Do not rely on old Wikipedia snippets if more recent sources conflict.
- If the search results conflict, say they conflict and identify the most recent credible result instead of guessing.
- If you cannot verify the answer from current search results, say you cannot verify it right now.
- Do not invent source URLs, section URLs, or article URLs.
- Only include source URLs when they are full https URLs from web results.
- Keep the answer concise and useful.

For live sports, fixtures, scores, match updates, or tournaments:
- Prefer official competition pages, official team/league pages, ESPN, BBC Sport, Reuters, AP, The Athletic, Al Jazeera, FIFA, ICC, NBA, NFL, or similarly credible sports sources.
- Do not use markdown tables. Use short bullets only.
- Each bullet must describe one match only. Never combine two matches in one bullet.
- Only state a score, scorer, kickoff time, venue, or result when it is explicitly visible in the current search result.
- If the user asks for match updates and verified results are not available, say that you cannot verify live match results right now and provide verified fixture/status links instead.
- For FIFA World Cup 2026 questions, do not invent fictional group matches, scorers, venues, or results. Use FIFA/ESPN/BBC/Reuters/AP-style result pages only.
`;
}

function extractChatCompletionText(data) {
  return String(data.choices?.[0]?.message?.content || '').trim();
}

function extractGroqToolSources(data) {
  const tools = data.choices?.[0]?.message?.executed_tools;
  if (!Array.isArray(tools)) return [];

  const sources = [];
  const seenUrls = new Set();

  for (const tool of tools) {
    const output = String(tool?.output || '');
    const entries = output.split(/\n(?=Title:\s)/);

    for (const entry of entries) {
      const title = entry.match(/Title:\s*(.+)/)?.[1]?.trim();
      const url = entry.match(/URL:\s*(https?:\/\/[^\s]+)/)?.[1]?.trim();
      if (!title || !url || seenUrls.has(url)) continue;

      seenUrls.add(url);
      sources.push({ title, url });
      if (sources.length >= 5) return sources;
    }
  }

  return sources;
}

function cleanDynamicAnswer(answer) {
  return String(answer || '')
    .replace(/【(https?:\/\/[^】]+)】/g, '$1')
    .replace(/\*\*/g, '')
    .trim();
}

function appendVerifiedWebSources(answer, sources) {
  const cleanedAnswer = removeInlineUrls(removeUnverifiedSourceHints(answer));
  if (!sources.length) return cleanedAnswer;

  const verifiedSources = sources.map((source) => `- [${source.title}](${source.url})`).join('\n');
  return [cleanedAnswer, '', 'Verified sources:', verifiedSources].join('\n');
}

function buildUnverifiedCurrentInfoAnswer(groqRequestOptions = {}) {
  if (groqRequestOptions?.isSportsQuestion) {
    return [
      `I cannot verify the latest live match updates from current sports sources right now as of ${currentDateLabel}.`,
      'Please try again in a moment or ask for a specific team, match, date, or competition round.',
    ].join(' ');
  }

  return [
    `I cannot verify the latest answer from current web results right now as of ${currentDateLabel}.`,
    'Please try again in a moment or ask with a more specific country, role, date, or source requirement.',
  ].join(' ');
}

async function generateFifaWorldCupMatchUpdates() {
  const dates = [addDays(currentDateIso, -1), currentDateIso, addDays(currentDateIso, 1)];
  const eventsById = new Map();

  for (const date of dates) {
    const url = `${fifaWorldCupScoreboardUrl}?dates=${date.replaceAll('-', '')}`;
    const response = await fetchWithTimeout(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'faizur-portfolio/1.0',
      },
    }, 12_000);

    if (!response.ok) continue;

    const data = await response.json();
    for (const event of data.events || []) {
      if (event?.id) eventsById.set(event.id, event);
    }
  }

  const events = [...eventsById.values()]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const completed = events.filter((event) => isCompletedSportEvent(event)).slice(-6);
  const upcoming = events.filter((event) => !isCompletedSportEvent(event)).slice(0, 6);
  const sourceUrl = `${fifaWorldCupScoreboardUrl}?dates=${currentDateIso.replaceAll('-', '')}`;

  if (!completed.length && !upcoming.length) {
    return {
      provider: 'espn-scoreboard',
      answer: [
        `I could not verify FIFA World Cup 2026 match updates from the ESPN scoreboard right now as of ${currentDateLabel}.`,
        '',
        'Verified source:',
        `- [ESPN FIFA World Cup scoreboard](${sourceUrl})`,
      ].join('\n'),
    };
  }

  const sections = [`FIFA World Cup 2026 match updates as of ${currentDateLabel}:`];

  if (completed.length) {
    sections.push('', 'Recent verified results:');
    sections.push(...completed.map(formatCompletedSportEvent));
  }

  if (upcoming.length) {
    sections.push('', 'Upcoming / scheduled fixtures:');
    sections.push(...upcoming.map(formatUpcomingSportEvent));
  }

  sections.push('', 'Verified source:', `- [ESPN FIFA World Cup scoreboard](${sourceUrl})`);

  return {
    provider: 'espn-scoreboard',
    answer: sections.join('\n'),
  };
}

function formatCompletedSportEvent(event) {
  const competitors = getSportEventCompetitors(event);
  const [teamA, teamB] = competitors;
  const scoreText =
    teamA && teamB
      ? `${teamA.name} ${teamA.score}-${teamB.score} ${teamB.name}`
      : event.shortName || event.name || 'Match';
  const status = event.status?.type?.shortDetail || event.status?.type?.description || 'Final';

  return `- ${formatEventDate(event.date)}: ${scoreText} (${status}).`;
}

function formatUpcomingSportEvent(event) {
  const competitors = getSportEventCompetitors(event);
  const [teamA, teamB] = competitors;
  const matchup =
    teamA && teamB
      ? `${teamA.name} vs ${teamB.name}`
      : event.shortName || event.name || 'Match';
  const status = event.status?.type?.shortDetail || event.status?.type?.description || 'Scheduled';

  return `- ${formatEventDate(event.date)}: ${matchup} (${status}).`;
}

function getSportEventCompetitors(event) {
  return (event.competitions?.[0]?.competitors || [])
    .slice()
    .sort((a, b) => {
      if (a.homeAway === b.homeAway) return 0;
      return a.homeAway === 'home' ? -1 : 1;
    })
    .map((competitor) => ({
      name: competitor.team?.displayName || competitor.team?.shortDisplayName || 'Team',
      score: String(competitor.score ?? '0'),
    }));
}

function isCompletedSportEvent(event) {
  return Boolean(event.status?.type?.completed);
}

function formatEventDate(value) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function removeInlineUrls(answer) {
  return String(answer || '')
    .replace(/\s*https?:\/\/[^\s)]+/g, '')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim();
}

function removeUnverifiedSourceHints(answer) {
  const lines = String(answer || '').split('\n');
  const keptLines = [];
  let skippingModelSourceBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const plainTrimmed = trimmed.replace(/\*/g, '');
    const looksLikeSourceHeading = /^sources?:?$/i.test(plainTrimmed);
    const looksLikeSourceListItem =
      /^[-*•]\s+/.test(trimmed) &&
      /\b(pbs|bbc|al\s*jazeera|reuters|the new york times|nyt|cnn|ap news|associated press|wikipedia|news|gov|official)\b/i.test(plainTrimmed);
    const looksLikeSuggestedSection =
      /^\s*-?\s*(bbc|al jazeera|reuters|the new york times|nyt|cnn|ap news|associated press)\b.*\bsection\b/i.test(trimmed);
    const hasBareSourceDomain =
      /\bsource\b/i.test(trimmed) &&
      /\b[a-z0-9.-]+\.(com|org|net|news)\b/i.test(trimmed) &&
      !/https?:\/\//i.test(trimmed);

    if (looksLikeSourceHeading) {
      skippingModelSourceBlock = true;
      continue;
    }

    if (skippingModelSourceBlock) {
      if (!trimmed || /^[-*•]\s+/.test(trimmed) || looksLikeSourceListItem || trimmed.endsWith('–') || trimmed.endsWith('-')) {
        continue;
      }
      skippingModelSourceBlock = false;
    }

    if (looksLikeSuggestedSection || hasBareSourceDomain) continue;
    keptLines.push(line);
  }

  return keptLines.join('\n').trim();
}

function getGroqRequestOptions(question) {
  const needsWebSearch = !isPortfolioQuestion(question) && shouldUseWebSearch(question);
  const isSportsQuestion = needsWebSearch && isSportsCurrentQuestion(question);
  return {
    model: needsWebSearch ? groqWebSearchModel : groqModel,
    maxTokens: needsWebSearch ? Math.max(groqMaxTokens, isSportsQuestion ? 700 : 850) : groqMaxTokens,
    provider: needsWebSearch ? 'groq-web-search' : 'groq',
    timeoutMs: needsWebSearch ? 45_000 : 20_000,
    isSportsQuestion,
  };
}

function getContextMessages(messages, groqRequestOptions) {
  return messages
    .filter((message) => message && ['user', 'assistant'].includes(message.role))
    .filter((message) => {
      if (groqRequestOptions.provider === 'groq-web-search') return true;
      return !looksLikeWebSearchAnswer(message.content);
    })
    .map((message) => ({
      role: message.role,
      content: String(message.content || '').slice(0, 1000),
    }));
}

function buildUserQuestion(question, groqRequestOptions) {
  if (groqRequestOptions.provider !== 'groq-web-search') return question;

  const sportsInstruction = isSportsCurrentQuestion(question)
    ? [
        '',
        'This is a live/current sports question.',
        'Search specifically for official or reliable sports result pages. Use bullets, not tables.',
        'Only include match updates with an explicitly verified date and score/status from current search results.',
        'If no verified live scores/results are available, say that clearly and provide verified schedule/result source links instead.',
      ].join('\n')
    : '';

  return [
    `User question: ${question}`,
    '',
    'This is a current-world question. Search the web now and answer only from current, credible web results.',
    `Use ${currentDateLabel} as the as-of date. If current search results are missing, weak, or conflicting, say so instead of relying on memory.`,
    sportsInstruction,
  ].join('\n');
}

function isSportsCurrentQuestion(question) {
  const normalizedQuestion = normalizeQuestion(question);
  const sportsTerms =
    /\b(world cup|fifa|football|soccer|match|matches|fixture|fixtures|score|scores|result|results|standings|group stage|knockout|tournament|nba|nfl|mlb|nhl|cricket|icc|ipl|uefa|premier league|la liga|champions league)\b/;
  const currentTerms =
    /\b(current|currently|latest|today|right now|recent|updates?|live|202[6-9]|now)\b/;

  return sportsTerms.test(normalizedQuestion) && currentTerms.test(normalizedQuestion);
}

function isFifaWorldCupUpdateQuestion(question) {
  const normalizedQuestion = normalizeQuestion(question);
  const hasWorldCup = /\b(fifa\s*)?world cup\b/.test(normalizedQuestion);
  const hasMatchIntent =
    /\b(match|matches|fixture|fixtures|score|scores|result|results|update|updates|today|live|group stage|standings)\b/.test(
      normalizedQuestion,
    );
  const hasYear = /\b2026\b/.test(normalizedQuestion);

  return hasWorldCup && hasMatchIntent && hasYear;
}

function getCurrentDateLabel() {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date());
}

function getCurrentDateIso() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(isoDate, offset) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function isPortfolioQuestion(question) {
  const normalizedQuestion = normalizeQuestion(question);
  const portfolioPatterns = [
    /\bfaiz\b/,
    /\bfaizur\b/,
    /\bmd faizur\b/,
    /\brahman khan\b/,
    /\bhis\b.*\b(role|fit|experience|skill|work|resume|cv|contact|education|project|portfolio)\b/,
    /\bresume\b/,
    /\bcv\b/,
    /\bportfolio\b/,
    /\brole fit\b/,
    /\bgood fit\b/,
    /\bsenior software engineer role\b/,
    /\bsenior backend\b/,
    /\bnestjs\b/,
    /\bnode\.?js\b/,
    /\bbackend\b/,
    /\bchromatics ai\b/,
  ];

  return portfolioPatterns.some((pattern) => pattern.test(normalizedQuestion));
}

function shouldUseWebSearch(question) {
  const normalizedQuestion = normalizeQuestion(question);
  const searchPatterns = [
    /\bpresent\b/,
    /\bcurrent\b/,
    /\bcurrently\b/,
    /\bnow\b/,
    /\blatest\b/,
    /\blast update\b/,
    /\bupdates?\b/,
    /\btoday\b/,
    /\bright now\b/,
    /\brecent\b/,
    /\bnews\b/,
    /\bhappenings?\b/,
    /\bworld\b/,
    /\bwar\b/,
    /\bconflict\b/,
    /\bweb search\b/,
    /\bsearch (the )?web\b/,
    /\binternet\b/,
    /\bonline\b/,
    /\bweather\b/,
    /\bstock\b/,
    /\bprices?\b/,
    /\bexchange rate\b/,
    /\bscores?\b/,
    /\bsports\b/,
    /\breleases?\b/,
    /\breleased\b/,
    /\b202[6-9]\b/,
    /\bwho is\b.*\b(pm|prime minister|president|minister|mayor|governor|ceo|cto|cfo|chairman|leader|head of|incumbent)\b/,
    /\b(pm|prime minister|president|minister|mayor|governor|ceo|cto|cfo|chairman|leader|head of|incumbent)\b.*\b(of|in|for)\b/,
    /\bgovernment\b/,
    /\belection\b/,
    /\bsworn\b/,
  ];

  return searchPatterns.some((pattern) => pattern.test(normalizedQuestion));
}

function normalizeQuestion(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikeWebSearchAnswer(content) {
  const normalizedContent = normalizeQuestion(content);
  return (
    normalizedContent.includes('based on current web results') ||
    normalizedContent.includes('verified sources:') ||
    normalizedContent.includes('provider: groq-web-search')
  );
}

function processGroqStreamEvent(event, onDelta) {
  const dataLines = event
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim());

  for (const dataLine of dataLines) {
    if (!dataLine) continue;
    if (dataLine === '[DONE]') return true;

    const payload = JSON.parse(dataLine);
    const delta = payload.choices?.[0]?.delta?.content || '';
    if (delta) onDelta(delta);
  }

  return false;
}

function writeJsonLine(response, payload) {
  response.write(`${JSON.stringify(payload)}\n`);
}

/*
 * Legacy parsers, commented out by request.
 *
 * function extractOpenAIOutputText(data) {
 *   if (typeof data.output_text === 'string') return data.output_text.trim();
 *
 *   return (data.output || [])
 *     .flatMap((item) => (Array.isArray(item.content) ? item.content : []))
 *     .map((content) => content.text || '')
 *     .filter(Boolean)
 *     .join('\n')
 *     .trim();
 * }
 *
 * function extractDeepSeekOutputText(data) {
 *   return String(data.choices?.[0]?.message?.content || '').trim();
 * }
 */

async function readJsonBody(request) {
  let raw = '';
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 20_000) {
      throw new Error('Request body too large');
    }
  }
  return raw ? JSON.parse(raw) : {};
}

function allowRequest(ipAddress) {
  const now = Date.now();
  const recent = (rateLimitByIp.get(ipAddress) || []).filter(
    (timestamp) => timestamp > now - 60_000,
  );

  if (recent.length >= 12) return false;

  recent.push(now);
  rateLimitByIp.set(ipAddress, recent);
  return true;
}

function getIpAddress(request) {
  const forwardedFor = request.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  return request.socket.remoteAddress || 'unknown';
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

function contentTypeFor(filePath) {
  const extension = extname(filePath).toLowerCase();
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
  };
  return types[extension] || 'application/octet-stream';
}

function cacheControlFor(filePath) {
  const extension = extname(filePath).toLowerCase();
  if (['.html', '.css', '.js'].includes(extension)) {
    return 'no-store, no-cache, must-revalidate, max-age=0';
  }
  return 'public, max-age=604800';
}

function loadLocalEnv(filePath) {
  if (!existsSync(filePath)) return;

  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}
