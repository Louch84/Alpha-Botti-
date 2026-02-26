#!/usr/bin/env node

/**
 * Performance Tracker
 * Track success/failure of my advice and strategies
 * Learn from what works and what doesn't
 */

const fs = require('fs');
const path = require('path');

const TRACKER_FILE = path.join(__dirname, 'performance.json');

class PerformanceTracker {
  constructor() {
    this.data = this.load();
  }
  
  load() {
    try {
      if (fs.existsSync(TRACKER_FILE)) {
        return JSON.parse(fs.readFileSync(TRACKER_FILE, 'utf8'));
      }
    } catch (e) {}
    return {
      version: "1.0",
      created: new Date().toISOString(),
      sessions: [],
      strategies: {},
      mistakes: [],
      wins: [],
      learnings: []
    };
  }
  
  save() {
    fs.writeFileSync(TRACKER_FILE, JSON.stringify(this.data, null, 2));
  }
  
  // Record an outcome
  record(strategy, outcome, details = {}) {
    const entry = {
      id: Date.now(),
      strategy,
      outcome, // 'success', 'failure', 'partial', 'unknown'
      details,
      timestamp: new Date().toISOString()
    };
    
    this.data.sessions.unshift(entry);
    
    // Track by strategy
    if (!this.data.strategies[strategy]) {
      this.data.strategies[strategy] = { attempts: 0, successes: 0, failures: 0 };
    }
    
    this.data.strategies[strategy].attempts++;
    if (outcome === 'success') {
      this.data.strategies[strategy].successes++;
      this.data.wins.push(entry);
    } else if (outcome === 'failure') {
      this.data.strategies[strategy].failures++;
      this.data.mistakes.push(entry);
    }
    
    // Limit history
    if (this.data.sessions.length > 500) {
      this.data.sessions = this.data.sessions.slice(0, 500);
    }
    
    this.save();
    return entry;
  }
  
  // Record a learning
  learn(lesson, source = 'general') {
    const entry = {
      id: Date.now(),
      lesson,
      source,
      timestamp: new Date().toISOString()
    };
    
    this.data.learnings.unshift(entry);
    
    // Limit
    if (this.data.learnings.length > 200) {
      this.data.learnings = this.data.learnings.slice(0, 200);
    }
    
    this.save();
    return entry;
  }
  
  // Get strategy performance
  getStrategyStats(strategy) {
    const stats = this.data.strategies[strategy];
    if (!stats) return null;
    
    const total = stats.attempts;
    const successRate = total > 0 ? (stats.successes / total * 100).toFixed(1) : 0;
    
    return {
      ...stats,
      successRate: successRate + '%',
      total
    };
  }
  
  // Get top strategies (by success rate, min 3 attempts)
  getTopStrategies(limit = 5) {
    return Object.entries(this.data.strategies)
      .filter(([_, s]) => s.attempts >= 3)
      .map(([name, s]) => ({
        name,
        ...s,
        rate: (s.successes / s.attempts * 100).toFixed(1) + '%'
      }))
      .sort((a, b) => b.successes - a.successes)
      .slice(0, limit);
  }
  
  // Get worst strategies
  getWorstStrategies(limit = 5) {
    return Object.entries(this.data.strategies)
      .filter(([_, s]) => s.attempts >= 2)
      .map(([name, s]) => ({
        name,
        ...s,
        rate: (s.successes / s.attempts * 100).toFixed(1) + '%'
      }))
      .sort((a, b) => a.successes / a.attempts - b.successes / b.attempts)
      .slice(0, limit);
  }
  
  // Recent mistakes to learn from
  getMistakes(limit = 10) {
    return this.data.mistakes.slice(0, limit);
  }
  
  // Overall stats
  getStats() {
    const sessions = this.data?.sessions || [];
    const wins = this.data?.wins || [];
    const mistakes = this.data?.mistakes || [];
    const strategies = this.data?.strategies || {};
    
    const total = sessions.length;
    const successes = wins.length;
    const failures = mistakes.length;
    
    return {
      totalAttempts: total,
      successes,
      failures,
      unknown: total - successes - failures,
      successRate: total > 0 ? (successes / total * 100).toFixed(1) + '%' : 'N/A',
      strategiesTracked: Object.keys(strategies).length,
      lessonsLearned: this.data?.learnings?.length || 0
    };
  }
  
  // Self-critique: what should I improve?
  selfCritique() {
    const worst = this.getWorstStrategies(3);
    const stats = this.getStats();
    
    const critiques = [];
    
    if (stats.successRate < 50) {
      critiques.push("Success rate is below 50% - need to be more careful with advice");
    }
    
    for (const w of worst) {
      if (parseFloat(w.rate) < 30) {
        critiques.push(`Strategy "${w.name}" failing ${w.failures}/${w.attempts} - should avoid or fix`);
      }
    }
    
    return {
      stats,
      worstStrategies: worst,
      critiques
    };
  }
}

// Export
module.exports = { PerformanceTracker };

// CLI
if (require.main === module) {
  const tracker = new PerformanceTracker();
  
  const args = process.argv.slice(2);
  const cmd = args[0];
  
  if (cmd === 'record' && args[1] && args[2]) {
    tracker.record(args[1], args[2]);
    console.log('Recorded:', args[1], '=', args[2]);
  } else if (cmd === 'learn' && args[1]) {
    tracker.learn(args.slice(1).join(' '));
    console.log('Learning recorded');
  } else if (cmd === 'stats') {
    console.log(JSON.stringify(tracker.getStats(), null, 2));
  } else if (cmd === 'top') {
    console.log('Top Strategies:', JSON.stringify(tracker.getTopStrategies(), null, 2));
  } else if (cmd === 'worst') {
    console.log('Worst Strategies:', JSON.stringify(tracker.getWorstStrategies(), null, 2));
  } else if (cmd === 'critique') {
    console.log(JSON.stringify(tracker.selfCritique(), null, 2));
  } else {
    console.log('Usage:');
    console.log('  node tracker.js record "strategy_name" "success|failure|partial"');
    console.log('  node tracker.js learn "lesson learned"');
    console.log('  node tracker.js stats');
    console.log('  node tracker.js top');
    console.log('  node tracker.js worst');
    console.log('  node tracker.js critique');
  }
}
