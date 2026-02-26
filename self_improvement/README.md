# Self-Improvement System

Three integrated systems for autonomous self-improvement.

## Components

### 1. Memory 2.0 (`memory2.js`)
- Smart memory with auto-tagging
- Priority entries (high/low)
- Topic tracking
- Relevance-based search

### 2. Performance Tracker (`tracker.js`)
- Track strategy outcomes
- Success/failure recording
- Performance statistics
- Self-critique

### 3. Self Analyzer (`self_analyzer.js`)
- Code review
- Issue detection
- Pattern tracking
- Recommendations

## Usage

```bash
cd self_improvement

# Learn something new
node self_improve.js learn "Always verify API keys work before building"

# Record a strategy outcome
node self_improve.js record "scanner_v4" "success"

# Search memory
node self_improve.js remember "gamma"

# Show topics
node self_improve.js topics

# Show stats
node self_improve.js stats

# Self-critique
node self_improve.js critique

# Analyze code
node self_improve.js analyze

# Full improvement cycle
node self_improve.js improve

# Daily summary
node self_improve.js daily
```

## Files

- `self_improve.js` - Main runner
- `memory2.js` - Memory system
- `tracker.js` - Performance tracker
- `self_analyzer.js` - Code analyzer
- `insights.json` - Memory data
- `performance.json` - Performance data
