## Inspiration

The overwhelming spread of misinformation online threatens how we make decisions and understand the world. We wanted to create a tool that helps users critically evaluate online content by providing instant fact-checking and contextual answers with verifiable sources.

## What it does

Verisum is a Chrome extension that combines AI-powered Q&A with automated fact-checking to help users navigate web content more safely:

- **Instant Q&A**: Ask questions about any webpage and get concise answers with cited sources using vector search and LLMs
- **Smart Spotlight**: Alt+Space opens a quick overlay for rapid queries without leaving the page
- **Fact-Check Scanning**: Automatically identifies false, misleading, or unverified claims on any webpage
- **Multi-Source Verification**: Verifies claims against Google Fact Check API, Wikipedia, and domain reputation databases
- **Visual Indicators**: Flags suspicious content with colored highlights (red for false, yellow for misleading)
- **Manual Flagging**: Select any text and flag it for verification with custom reasons

## How I built it

**Architecture:**

- **Frontend**: Preact for lightweight UI components, CSS Modules for styling
- **Backend**: Chrome extension with service worker architecture
- **ML Pipeline**:
  - Transformers.js (Xenova) runs MiniLM-L6-v2 in-browser for embeddings
  - Vector database with cosine similarity search finds relevant content
  - OpenAI-compatible LLM API generates answers with citations
- **Fact-Checking Pipeline**:
  - LLM scans page content for suspicious claims
  - Verifies against Google Fact Check API
  - Cross-references with Wikipedia
  - Checks domain reputation databases
  - Calculates confidence scores from multiple sources

**Key Technical Features:**

- WASM acceleration for fast embeddings
- Smart caching (1hr for embeddings, 30min for queries)
- Streaming responses for better UX
- Rate limiting to prevent API abuse
- Citation extraction using regex parsing

## Challenges I ran into

1. **Vector Search Performance**: Initially sent entire page content to LLM (~10k tokens). Solution: Implemented vector search to send only top 7 relevant paragraphs (~350 tokens)

2. **Citation Accuracy**: LLM would generate sources that didn't exist. Solution: Built citation extraction system that only shows sources actually referenced with [1], [2] notation

3. **Fact-Check Reliability**: Single verification sources were unreliable. Solution: Implemented multi-source verification with weighted confidence scoring

4. **Content Persistence**: Flags disappeared on page refresh. Solution: Added storage layer and automatic restoration of highlights on page load

5. **Dynamic Content**: SPAs wouldn't trigger re-scanning. Solution: Intercepted history.pushState/replaceState and monitored URL changes

## Accomplishments that I'm proud of

- Built a complete fact-checking pipeline that combines LLMs with established verification APIs
- Achieved 95%+ confidence scoring on verifiable false claims through multi-source verification
- Reduced LLM token usage by 96% (10k → 350 tokens) while maintaining answer quality
- Created a seamless UX with keyboard shortcuts, streaming responses, and persistent state
- Implemented intelligent caching that balances performance with freshness
- Designed a highlight system that survives page navigation on SPAs

## What I learned

- Browser-based ML models (WASM + Transformers.js) are production-ready for embeddings
- Combining multiple verification sources significantly improves fact-checking accuracy
- Vector search is essential for context-relevant AI responses
- Chrome extension architecture requires careful state management across content scripts, service workers, and popups
- Rate limiting and caching are critical for AI-powered extensions
- Citation extraction is harder than it seems - LLMs need strict prompting

## What's next for Verisum

**Near-term:**

- Multi-turn conversations with context memory
- Support for more fact-checking APIs (Snopes, PolitiFact)
- Browser history analysis to detect patterns of misinformation
- Dark mode and customizable themes
- Export fact-check reports as PDF/CSV

**Long-term:**

- Real-time misinformation alerts during browsing
- Community-driven verification system
- Integration with academic databases for research verification
- Browser extension for Firefox and Safari
- Mobile app for fact-checking social media
- API for third-party integrations
