#!/usr/bin/env node

/**
 * Self-Improvement System - Main Runner
 * Integrates:
 * - Memory 2.0 (smart memory with auto-tagging)
 * - Performance Tracker (track success/failure)
 * - Self Analyzer (review code for issues)
 * 
 * Usage: node self_improve.js [command]
 */

const fs = require('fs');
const path = require('path');

const SELF_IMP_DIR = path.join(__dirname);

// Import modules
const { Memory2 } = require('./memory2.js');
const { PerformanceTracker } = require('./tracker.js');
const { SelfAnalyzer } = require('./self_analyzer.js');

// Initialize
const memory = new Memory2();
const tracker = new PerformanceTracker();
const analyzer = new SelfAnalyzer();

// Commands
const commands = {
  // Add insight to memory
  'learn': (args) => {
    const text = args.join(' ');
    const entry = memory.add(text, 'self_improvement');
    console.log('✓ Learned:', text.slice(0, 50));
    return entry;
  },
  
  // Search memory
  'remember': (args) => {
    const query = args.join(' ');
    const results = memory.search(query);
    console.log(`Found ${results.length} results for "${query}":\n`);
    results.forEach(r => {
      console.log(`[${r.score}] ${r.tags.join(', ')}`);
      console.log(`  ${r.text.slice(0, 100)}...\n`);
    });
  },
  
  // Show topics
  'topics': () => {
    const topics = memory.getTopics();
    console.log('Topics tracked:');
    for (const [topic, data] of Object.entries(topics).sort((a,b) => b[1].count - a[1].count)) {
      console.log(`  ${topic}: ${data.count} entries`);
    }
  },
  
  // Record outcome
  'record': (args) => {
    // Format: node self_improve.js record "strategy" "success|failure"
    const strategy = args[0];
    const outcome = args[1];
    const details = args.slice(2).join(' ');
    tracker.record(strategy, outcome, { details });
    console.log(`✓ Recorded: ${strategy} = ${outcome}`);
  },
  
  // Show stats
  'stats': () => {
    const stats = tracker.getStats();
    console.log('Performance Stats:');
    console.log(JSON.stringify(stats, null, 2));
  },
  
  // Show critique
  'critique': () => {
    const critique = tracker.selfCritique();
    console.log('Self Critique:');
    console.log(JSON.stringify(critique, null, 2));
  },
  
  // Analyze my code
  'analyze': (args) => {
    const target = args[0] || path.join(__dirname, '../gamma_scanner');
    console.log('Analyzing:', target, '\n');
    const report = analyzer.analyze(target);
    
    console.log('=== ANALYSIS ===');
    console.log(`Issues: ${report.summary.totalIssues}`);
    console.log(`High: ${report.summary.high} | Med: ${report.summary.medium} | Low: ${report.summary.low}`);
    console.log(`Patterns: ${JSON.stringify(report.summary.patterns)}\n`);
    
    if (report.bySeverity.high.length) {
      console.log('HIGH PRIORITY:');
      report.bySeverity.high.forEach(i => console.log(`  - ${i.message}`));
    }
    
    if (report.recommendations.length) {
      console.log('\nRECOMMENDATIONS:');
      report.recommendations.forEach(r => console.log(`  [${r.priority}] ${r.recommendation}`));
    }
  },
  
  // Full self-improvement cycle
  'improve': () => {
    console.log('=== SELF-IMPROVEMENT CYCLE ===\n');
    
    // 1. Analyze code
    console.log('1. Analyzing code...');
    const target = path.join(__dirname, '../gamma_scanner');
    const report = analyzer.analyze(target);
    console.log(`   Found ${report.summary.totalIssues} issues\n`);
    
    // 2. Check performance
    console.log('2. Checking performance...');
    const stats = tracker.getStats();
    console.log(`   Success rate: ${stats.successRate}\n`);
    
    // 3. Recent learnings
    console.log('3. Recent mistakes to learn from:');
    const mistakes = tracker.getMistakes(3);
    mistakes.forEach(m => console.log(`   - ${m.strategy}: ${m.outcome}`));
    console.log('');
    
    // 4. Recommendations
    console.log('4. Recommendations:');
    const critique = tracker.selfCritique();
    critique.critiques.forEach(c => console.log(`   - ${c}`));
    
    console.log('\n✓ Self-improvement cycle complete');
  },
  
  // Interactive learning session
  'daily': () => {
    console.log('=== DAILY SELF-IMPROVEMENT ===\n');
    
    // Quick stats
    const stats = tracker.getStats();
    console.log(`Today: ${stats.totalAttempts} strategies tested`);
    console.log(`Success rate: ${stats.successRate}\n`);
    
    // Top strategies
    const top = tracker.getTopStrategies(3);
    if (top.length > 0) {
      console.log('Top strategies:');
      top.forEach(t => console.log(`  - ${t.name}: ${t.rate}`));
      console.log('');
    }
    
    // Worst strategies
    const worst = tracker.getWorstStrategies(3);
    if (worst.length > 0) {
      console.log('Struggling with:');
      worst.forEach(w => console.log(`  - ${w.name}: ${w.rate}`));
      console.log('');
    }
    
    // Topics
    const topics = memory.getTopics();
    console.log('Knowledge areas:', Object.keys(topics).join(', '));
  },
  
  // Help
  'help': () => {
    console.log(`
SELF-IMPROVEMENT SYSTEM
======================

Commands:
  learn <text>         - Add insight to memory
  remember <query>    - Search memory
  topics              - Show tracked topics
  
  record <strat> <outcome> - Record strategy outcome
  stats               - Show performance stats
  critique            - Self-critique and recommendations
  
  analyze [path]      - Analyze my code
  improve             - Full improvement cycle
  daily               - Daily summary
  
  help                - Show this help

Examples:
  node self_improve.js learn "Always check API rate limits"
  node self_improve.js record "gamma_scanner" "success"
  node self_improve.js improve
`);
  }
};

// Main
const args = process.argv.slice(2);
const cmd = args[0] || 'help';

if (commands[cmd]) {
  commands[cmd](args.slice(1));
} else {
  console.log('Unknown command:', cmd);
  console.log('Run: node self_improve.js help');
}
