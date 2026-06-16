const chatForm = document.querySelector('#chatForm');
const chatInput = document.querySelector('#chatInput');
const chatMessages = document.querySelector('#chatMessages');
const chatStatus = document.querySelector('#chatStatus');
const clearChat = document.querySelector('#clearChat');
const promptButtons = document.querySelectorAll('[data-question]');
const chatPanel = document.querySelector('.chat-panel');
const heroImage = document.querySelector('.hero-image');
const scrollProgress = document.querySelector('#scrollProgress');
const heroTitleText = document.querySelector('#heroTitleText');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const chatRetryDelays = [900, 1800, 3200, 5200];

let history = [];
let ticking = false;

setupScrollReveal();
setupHeroMotion();
setupMetricCountUp();
setupScrollProgress();
setupHeroTitleRotator();

chatForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const question = chatInput.value.trim();
  if (!question) return;

  chatInput.value = '';
  appendMessage('user', question);
  history.push({ role: 'user', content: question });
  setLoading(true);

  let assistantMessage;
  try {
    assistantMessage = appendStreamingAssistantMessage();
    const answer = await streamAssistantAnswer(question, assistantMessage);
    history.push({ role: 'assistant', content: answer });
  } catch (error) {
    if (assistantMessage) {
      updateAssistantMessage(
        assistantMessage,
        error.message || 'The assistant is unavailable. Please try again shortly.',
        true,
      );
    } else {
      appendMessage(
        'assistant',
        error.message || 'The assistant is unavailable. Please try again shortly.',
      );
    }
  } finally {
    setLoading(false);
  }
});

chatInput.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;

  event.preventDefault();
  if (chatInput.disabled || !chatInput.value.trim()) return;
  chatForm.requestSubmit();
});

clearChat.addEventListener('click', () => {
  history = [];
  chatMessages.innerHTML = '';
  appendMessage(
    'assistant',
    "Hi, I can answer your questions about Faizur's experience, skills, AI backend work, cloud background, and contact details. I can also use web search for current-world questions.",
  );
  chatInput.focus();
});

promptButtons.forEach((button) => {
  button.addEventListener('click', () => {
    chatInput.value = button.dataset.question || '';
    chatInput.focus();
  });
});

function appendMessage(role, content) {
  const message = document.createElement('div');
  message.className = `message ${role}`;
  if (role === 'assistant') {
    message.append(renderAssistantMessage(content));
  } else {
    message.textContent = content;
  }
  chatMessages.append(message);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return message;
}

function appendStreamingAssistantMessage() {
  const message = document.createElement('div');
  message.className = 'message assistant is-streaming';
  chatMessages.append(message);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return message;
}

function updateAssistantMessage(message, content, isFinal = false) {
  const cleanedContent = cleanAssistantText(content);
  if (isFinal) {
    message.classList.remove('is-streaming');
    message.replaceChildren(renderAssistantMessage(cleanedContent));
  } else {
    message.textContent = cleanedContent;
  }

  chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function streamAssistantAnswer(question, assistantMessage) {
  let lastError;

  for (let attempt = 0; attempt <= chatRetryDelays.length; attempt += 1) {
    if (attempt > 0) {
      updateAssistantMessage(
        assistantMessage,
        `The AI service is busy. Retrying automatically (${attempt}/${chatRetryDelays.length})...`,
      );
      chatStatus.textContent = 'Retrying...';
      await wait(chatRetryDelays[attempt - 1]);
    }

    try {
      return await streamAssistantAnswerOnce(question, assistantMessage);
    } catch (error) {
      lastError = error;
      if (!isRetryableChatError(error)) break;
    }
  }

  throw lastError || new Error('The assistant could not answer right now.');
}

async function streamAssistantAnswerOnce(question, assistantMessage) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question,
      messages: history.slice(-8),
      stream: true,
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const error = new Error(data.error || 'The assistant could not answer right now.');
    error.status = response.status;
    error.retryable = response.status === 429 || response.status >= 500;
    if (/not configured/i.test(error.message)) error.retryable = false;
    throw error;
  }

  if (!response.body) throw new Error('The assistant could not stream a response.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let answer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const event = parseStreamLine(line);
      if (!event) continue;

      if (event.type === 'chunk') {
        answer += event.delta || '';
        updateAssistantMessage(assistantMessage, answer);
      }

      if (event.type === 'error') {
        const error = new Error(event.error || 'The assistant could not answer right now.');
        error.retryable = true;
        throw error;
      }
    }
  }

  const finalEvent = parseStreamLine(buffer);
  if (finalEvent?.type === 'chunk') {
    answer += finalEvent.delta || '';
  }

  if (!answer.trim()) throw new Error('The assistant did not return an answer.');

  updateAssistantMessage(assistantMessage, answer, true);
  return cleanAssistantText(answer);
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function isRetryableChatError(error) {
  if (error?.retryable === false) return false;
  if (error?.retryable === true) return true;
  const status = Number(error?.status || 0);
  return status === 429 || status >= 500 || /temporarily unavailable|network|failed|timeout/i.test(error?.message || '');
}

function parseStreamLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function cleanAssistantText(content) {
  return String(content || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?[^>]+>/g, '')
    .replace(/[【】]/g, '')
    .replace(/\*\*/g, '')
    .replace(/(^|\n)\*([^*\n]+)\*(?=\n|$)/g, '$1$2')
    .replace(/(^|[^\n])\*([^*\n]+)\*/g, '$1$2')
    .replace(/#{1,6}\s*/g, '')
    .trim();
}

function renderAssistantMessage(content) {
  const fragment = document.createDocumentFragment();
  const blocks = formatAssistantBlocks(content);

  for (const block of blocks) {
    if (block.type === 'heading') {
      const heading = document.createElement('strong');
      heading.className = 'message-heading';
      heading.textContent = block.text;
      fragment.append(heading);
      continue;
    }

    if (block.type === 'list') {
      const list = document.createElement('ul');
      list.className = 'message-list';
      for (const item of block.items) {
        const listItem = document.createElement('li');
        listItem.append(renderInlineContent(item));
        list.append(listItem);
      }
      fragment.append(list);
      continue;
    }

    if (block.type === 'definition-list') {
      const list = document.createElement('dl');
      list.className = 'message-definition-list';
      for (const item of block.items) {
        const term = document.createElement('dt');
        term.textContent = item.term;
        const description = document.createElement('dd');
        description.append(renderInlineContent(item.description));
        list.append(term, description);
      }
      fragment.append(list);
      continue;
    }

    const paragraph = document.createElement('p');
    paragraph.className = 'message-paragraph';
    paragraph.append(renderInlineContent(block.text));
    fragment.append(paragraph);
  }

  return fragment;
}

function renderInlineContent(content) {
  const fragment = document.createDocumentFragment();
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)|(https?:\/\/[^\s]+|\/assets\/[^\s]+)/g;
  let lastIndex = 0;
  let match;

  while ((match = linkPattern.exec(content)) !== null) {
    appendText(fragment, content.slice(lastIndex, match.index));

    const label = match[1] || match[3];
    const href = match[2] || match[3];
    const link = document.createElement('a');
    link.href = href;
    link.textContent = label;
    link.className = 'message-link';

    if (href.endsWith('.pdf')) {
      link.download = '';
    }

    if (/^https?:\/\//.test(href)) {
      link.target = '_blank';
      link.rel = 'noreferrer';
    }

    fragment.append(link);
    lastIndex = linkPattern.lastIndex;
  }

  appendText(fragment, content.slice(lastIndex));
  return fragment;
}

function formatAssistantBlocks(content) {
  const normalized = cleanAssistantText(content)
    .replace(/\r/g, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/^[\s|:-]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n');
  const rawBlocks = normalized.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  const blocks = [];

  for (const rawBlock of rawBlocks) {
    const tableRows = parsePipeRows(rawBlock);
    if (tableRows.length >= 2) {
      const [header, ...rows] = tableRows;
      blocks.push({
        type: 'definition-list',
        items: rows.map((row) => ({
          term: row[0] || header[0] || 'Item',
          description: row
            .slice(1)
            .map((cell, index) => `${header[index + 1] || `Detail ${index + 1}`}: ${cell}`)
            .join(' | '),
        })),
      });
      continue;
    }

    const lines = rawBlock.split('\n').map((line) => line.trim()).filter(Boolean);
    const bulletItems = lines
      .map((line) => line.match(/^[-*•]\s+(.+)/)?.[1]?.trim())
      .filter(Boolean);

    if (bulletItems.length === lines.length && bulletItems.length > 0) {
      blocks.push({ type: 'list', items: bulletItems });
      continue;
    }

    const numberedItems = lines
      .map((line) => line.match(/^\d+[.)]\s+(.+)/)?.[1]?.trim())
      .filter(Boolean);

    if (numberedItems.length === lines.length && numberedItems.length > 0) {
      blocks.push({ type: 'list', items: numberedItems });
      continue;
    }

    if (lines.length === 1 && isHeadingLine(lines[0])) {
      blocks.push({ type: 'heading', text: stripHeadingMarkers(lines[0]) });
      continue;
    }

    blocks.push({ type: 'paragraph', text: lines.join('\n') });
  }

  return blocks.length ? blocks : [{ type: 'paragraph', text: normalized }];
}

function parsePipeRows(block) {
  const rows = block
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|') && line.endsWith('|') && !/^\|[\s:-]+\|?$/.test(line))
    .map((line) =>
      line
        .slice(1, -1)
        .split('|')
        .map((cell) => cell.trim())
        .filter(Boolean),
    )
    .filter((row) => row.length >= 2);

  return rows.filter((row) => !row.every((cell) => /^:?-{2,}:?$/.test(cell)));
}

function isHeadingLine(line) {
  const cleaned = stripHeadingMarkers(line);
  return (
    /^#{1,6}\s/.test(line) ||
    /^[A-Z][A-Za-z0-9 &/,-]{2,45}:?$/.test(cleaned)
  );
}

function stripHeadingMarkers(line) {
  return line.replace(/^#{1,6}\s*/, '').replace(/:$/, '').trim();
}

function appendText(fragment, value) {
  if (value) fragment.append(document.createTextNode(value));
}

function setLoading(isLoading) {
  chatForm.querySelector('button[type="submit"]').disabled = isLoading;
  chatInput.disabled = isLoading;
  chatStatus.textContent = isLoading ? 'Thinking...' : '';
  chatPanel.classList.toggle('is-thinking', isLoading);
}

function setupScrollReveal() {
  const targets = [
    ...document.querySelectorAll(
      '.section, .section-heading, .section-grid, .chat-copy, .chat-panel, .timeline, .timeline-item, .impact-grid article, .tech-logo-card, .contact-section > *',
    ),
  ];

  targets.forEach((target, index) => {
    target.classList.add('reveal-target');
    target.style.setProperty('--reveal-delay', `${Math.min(index % 6, 5) * 70}ms`);
  });

  if (reducedMotion || !('IntersectionObserver' in window)) {
    targets.forEach((target) => target.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    },
    {
      rootMargin: '0px 0px -12% 0px',
      threshold: 0.16,
    },
  );

  targets.forEach((target) => observer.observe(target));
}

function setupHeroMotion() {
  if (reducedMotion) return;

  window.addEventListener('mousemove', (event) => {
    document.body.style.setProperty('--cursor-x', `${event.clientX}px`);
    document.body.style.setProperty('--cursor-y', `${event.clientY}px`);
  });

  window.addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = Math.min(window.scrollY, 760);
        heroImage.style.transform = `translateY(${y * 0.08}px) scale(1.04)`;
        updateScrollProgress();
        ticking = false;
      });
    },
    { passive: true },
  );
}

function setupScrollProgress() {
  updateScrollProgress();
  window.addEventListener('scroll', updateScrollProgress, { passive: true });
  window.addEventListener('resize', updateScrollProgress);
}

function updateScrollProgress() {
  if (!scrollProgress) return;
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  const progress = maxScroll > 0 ? window.scrollY / maxScroll : 0;
  scrollProgress.style.transform = `scaleX(${Math.min(Math.max(progress, 0), 1)})`;
}

function setupMetricCountUp() {
  const metrics = [...document.querySelectorAll('.hero-metrics dt')];
  if (reducedMotion) return;

  const numericMetrics = metrics
    .map((node) => {
      const match = node.textContent.trim().match(/^(\d+)(.*)$/);
      if (!match) return null;
      return {
        node,
        target: Number(match[1]),
        suffix: match[2],
      };
    })
    .filter(Boolean);

  const run = () => {
    const startedAt = performance.now();
    const duration = 920;

    const frame = (now) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      numericMetrics.forEach(({ node, target, suffix }) => {
        node.textContent = `${Math.round(target * eased)}${suffix}`;
      });

      if (progress < 1) requestAnimationFrame(frame);
    };

    requestAnimationFrame(frame);
  };

  if (!('IntersectionObserver' in window)) {
    run();
    return;
  }

  const observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return;
      run();
      observer.disconnect();
    },
    { threshold: 0.5 },
  );

  const metricGroup = document.querySelector('.hero-metrics');
  if (metricGroup) observer.observe(metricGroup);
}

function setupHeroTitleRotator() {
  if (!heroTitleText) return;

  const phrases = [
    'Md. Faizur Rahman Khan',
    'AI-Native Senior Software Engineer',
  ];

  if (reducedMotion) {
    heroTitleText.textContent = phrases[0];
    return;
  }

  let phraseIndex = 0;
  let characterIndex = 0;
  let isDeleting = false;
  const typeDelay = 58;
  const deleteDelay = 42;
  const firstHoldDelay = 1350;
  const secondHoldDelay = 1650;

  const tick = () => {
    const phrase = phrases[phraseIndex];
    const typedText = phrase.slice(0, characterIndex);

    heroTitleText.setAttribute('aria-label', phrase);
    heroTitleText.innerHTML = `${buildTypedTitleHtml(typedText)}<span class="title-cursor" aria-hidden="true"></span>`;

    if (!isDeleting && characterIndex < phrase.length) {
      characterIndex += 1;
      window.setTimeout(tick, typeDelay);
      return;
    }

    if (!isDeleting && characterIndex === phrase.length) {
      isDeleting = true;
      const holdDelay = phraseIndex === 0 ? firstHoldDelay : secondHoldDelay;
      window.setTimeout(tick, holdDelay);
      return;
    }

    if (isDeleting && characterIndex > 0) {
      characterIndex -= 1;
      window.setTimeout(tick, deleteDelay);
      return;
    }

    isDeleting = false;
    phraseIndex = (phraseIndex + 1) % phrases.length;
    window.setTimeout(tick, 260);
  };

  tick();
}

function buildTypedTitleHtml(typedText) {
  if (!typedText) return '';

  const hasTrailingSpace = /\s$/.test(typedText);
  const words = typedText.trimEnd().split(/\s+/).filter(Boolean);
  const renderedWords = words
    .map((word) => {
      const letters = [...word]
        .map((character) => `<span class="title-letter">${escapeHtml(character)}</span>`)
        .join('');

      return `<span class="title-word">${letters}</span>`;
    })
    .join(' ');

  return `${renderedWords}${hasTrailingSpace && renderedWords ? ' ' : ''}`;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return entities[char];
  });
}
