# Conversation Mode Implementation Plan

## Goal

Enable multi-turn conversations where the document context is sent once, then users can ask follow-up questions without re-sending the context.

## Current State

- Every query sends ~7 paragraphs + question to LLM (~700 tokens)
- No conversation history maintained
- Each query is independent

## Proposed Architecture

### 1. Conversation State Management

```typescript
interface ConversationState {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  documentContext: string; // Sent only once
  initialized: boolean;
  lastActivity: number;
}

// Store in service worker
let activeConversation: ConversationState | null = null;
```

### 2. First Query Flow

```typescript
// Initialize conversation with document
const messages = [
  {
    role: 'system',
    content:
      'You are answering questions about [page]. Use the document below as reference.',
  },
  {
    role: 'user',
    content: `DOCUMENT:\n${top7Paragraphs}\n\nI will now ask questions about this document.`,
  },
  {
    role: 'assistant',
    content: 'I have read the document. What would you like to know?',
  },
  {
    role: 'user',
    content: 'What is Switzerland known for?', // Actual question
  },
];
```

### 3. Follow-up Query Flow

```typescript
// Add to existing conversation
const messages = [
  ...activeConversation.messages,
  {
    role: 'user',
    content: 'What about its geography?', // No document needed!
  },
];
```

## Token Savings

### Current (Optimized)

- Query 1: 700 tokens (7 paragraphs + question)
- Query 2: 700 tokens (7 paragraphs + question)
- Query 3: 700 tokens (7 paragraphs + question)
- **Total**: 2,100 tokens for 3 queries

### With Conversation Mode

- Query 1: 750 tokens (initialization + 7 paragraphs + question)
- Query 2: 50 tokens (just the question)
- Query 3: 50 tokens (just the question)
- **Total**: 850 tokens for 3 queries

**Savings**: 60% reduction for multi-query sessions!

## Implementation Steps

1. Add conversation state to service worker
2. Modify `runLanguageModel` to check for active conversation
3. Add "New Conversation" button to popup
4. Add timeout to clear old conversations (5 min idle)
5. Visual indicator: "Conversation active" badge

## Trade-offs

**Pros**:

- 60% token reduction for follow-ups
- More natural conversation flow
- Better for complex, multi-step queries

**Cons**:

- Conversation history grows (more context per request)
- Need to manage conversation lifecycle
- Might lose context if conversation grows too long

## When to Use

**Good for**:

- Researching a topic (multiple related questions)
- Clarifying answers ("Can you elaborate?")
- Comparing facts ("How does X compare to Y?")

**Not needed for**:

- Single, isolated questions
- Unrelated queries

## Alternative: Hybrid Mode

Default: Independent queries (current behavior)
Optional: Enable "Conversation Mode" toggle in popup

This gives users control over when they want stateful conversations.
