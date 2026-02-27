# Self-Improvement System

Three integrated systems for autonomous self-improvement.

## Components

### 1. Memory 2.0 (`memory2.js`)
- Smart memory with auto-tagging
- Priority entries (high/low)
- Cross-reference topics
- Learning tracking

### 2. Performance Tracker (`tracker.js`)
- Track strategy outcomes
- Success/failure recording
- Performance statistics
- Self-critique

### 3. Self Analyzer (`self_an Code review
-alyzer.js`)
- Issue detection
- Pattern tracking
- Recommendations

### 4. Cognitive Architecture (`cognitive.js`) - NEW
Based on CORE (Ian-Tharp) cognitive framework:
- **Comprehension** - Understanding input, intent detection, emotional tone
- **Orchestration** - Planning and coordinating tasks
- **Reasoning** - Logic, patterns, deduction
- **Evaluation** - Self-critique, learning
- **Council of Perspectives** - Multi-agent deliberation
- **Catalyst Engine** - Creative problem solving

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

# Cognitive Architecture
node cognitive.js process "your input"    - Process through 4 pillars
node cognitive.js council "topic"         - Get multiple perspectives
node cognitive.js brainstorm "problem"   - Generate creative solutions
node cognitive.js stats                  - Show cognitive stats
```

## Files

- `self_improve.js` - Main runner
- `memory2.js` - Memory system
- `tracker.js` - Performance tracker
- `self_analyzer.js` - Code analyzer
- `cognitive.js` - Cognitive architecture (NEW)
- `insights.json` - Memory data
- `performance.json` - Performance data
