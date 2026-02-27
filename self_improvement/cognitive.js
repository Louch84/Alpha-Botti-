#!/usr/bin/env node

/**
 * COGNITIVE ARCHITECTURE v1
 * Based on CORE (Comprehension, Orchestration, Reasoning, Evaluation)
 * + Psychology + Self-Improvement
 * 
 * Four Pillars:
 * 1. Comprehension - Understanding input/context
 * 2. Orchestration - Planning and coordinating tasks
 * 3. Reasoning - Logic, patterns, deduction
 * 4. Evaluation - Self-critique, learning, improvement
 */

const fs = require('fs');
const path = require('path');

const MEMORY_FILE = path.join(__dirname, '../memory/MEMORY.md');
const DAILY_FILE = path.join(__dirname, '../memory/2026-02-25.md');

class CognitiveArchitecture {
  constructor() {
    this.context = {};
    this.taskQueue = [];
    this.reasoningChain = [];
    this.evaluationHistory = [];
    this.perspectives = []; // Council of Perspectives
  }
  
  // ==================== COMPREHENSION ====================
  // Interprets user inputs and transforms them into structured tasks
  
  comprehend(input, context = {}) {
    const analysis = {
      input,
      context,
      intent: this.detectIntent(input),
      emotionalTone: this.detectEmotionalTone(input),
      keyEntities: this.extractEntities(input),
      complexity: this.assessComplexity(input),
      urgency: this.detectUrgency(input),
      timestamp: new Date().toISOString()
    };
    
    this.context = { ...this.context, ...analysis };
    return analysis;
  }
  
  detectIntent(input) {
    const inputLower = input.toLowerCase();
    
    const intents = {
      question: ['what', 'how', 'why', 'when', 'where', 'who', '?'],
      command: ['do', 'make', 'build', 'create', 'run', 'get', 'find', 'go', 'start'],
      request: ['can you', 'could you', 'please', 'would you', 'help me'],
      statement: ['the', 'this is', 'i am', 'i was', 'check'],
      reflection: ['think', 'analyze', 'consider', 'review', 'evaluate']
    };
    
    for (const [intent, keywords] of Object.entries(intents)) {
      if (keywords.some(k => inputLower.includes(k))) {
        return intent;
      }
    }
    return 'unknown';
  }
  
  detectEmotionalTone(input) {
    const inputLower = input.toLowerCase();
    
    const tones = {
      urgent: ['now', 'quick', 'asap', 'immediately', 'fast', 'hurry'],
      frustrated: ['ugh', 'damn', 'seriously', 'this is annoying', 'why is', 'waste'],
      excited: ['awesome', 'cool', 'amazing', 'love', 'great', 'bet', 'lets go'],
      concerned: ['worried', 'nervous', 'hope', 'should i', 'what if'],
      neutral: [],
      analytical: ['analyze', 'research', 'check', 'verify', 'confirm']
    };
    
    for (const [tone, keywords] of Object.entries(tones)) {
      if (keywords.some(k => inputLower.includes(k))) {
        return tone;
      }
    }
    return 'neutral';
  }
  
  extractEntities(input) {
    const entities = {
      people: [],
      dates: [],
      numbers: [],
      urls: [],
      code: [],
      commands: []
    };
    
    // Extract URLs
    const urlRegex = /https?:\/\/[^\s]+/g;
    entities.urls = input.match(urlRegex) || [];
    
    // Extract numbers (potential prices, quantities)
    const numRegex = /\$?\d+(\.\d{2})?/g;
    const numbers = input.match(numRegex);
    if (numbers) {
      entities.numbers = numbers.map(n => parseFloat(n.replace('$', '')));
    }
    
    // Extract potential commands
    const cmdWords = ['run', 'build', 'create', 'make', 'get', 'find', 'check', 'scan'];
    entities.commands = cmdWords.filter(c => input.toLowerCase().includes(c));
    
    return entities;
  }
  
  assessComplexity(input) {
    const words = input.split(/\s+/).length;
    const sentences = input.split(/[.!?]+/).length;
    const hasConditionals = /\b(if|then|else|when|unless)\b/i.test(input);
    const hasComparisons = /\b(better|worse|more|less|than|compared)\b/i.test(input);
    
    let score = 0;
    if (words > 50) score += 2;
    if (sentences > 3) score += 1;
    if (hasConditionals) score += 2;
    if (hasComparisons) score += 1;
    
    if (score >= 4) return 'complex';
    if (score >= 2) return 'moderate';
    return 'simple';
  }
  
  detectUrgency(input) {
    const inputLower = input.toLowerCase();
    const urgent = ['asap', 'immediately', 'right now', 'urgent', 'emergency', 'now'];
    const soon = ['soon', 'later today', 'today', 'this morning'];
    
    if (urgent.some(w => inputLower.includes(w))) return 'high';
    if (soon.some(w => inputLower.includes(w))) return 'medium';
    return 'low';
  }
  
  // ==================== ORCHESTRATION ====================
  // Coordinates task flows between components
  
  orchestrate(analysis) {
    const tasks = [];
    
    // Determine required components based on intent
    switch (analysis.intent) {
      case 'question':
        tasks.push({ type: 'research', priority: 1 });
        tasks.push({ type: 'reasoning', priority: 2 });
        tasks.push({ type: 'response', priority: 3 });
        break;
      case 'command':
        tasks.push({ type: 'execute', priority: 1 });
        tasks.push({ type: 'verify', priority: 2 });
        tasks.push({ type: 'respond', priority: 3 });
        break;
      case 'request':
        tasks.push({ type: 'plan', priority: 1 });
        tasks.push({ type: 'execute', priority: 2 });
        tasks.push({ type: 'respond', priority: 3 });
        break;
      case 'reflection':
        tasks.push({ type: 'evaluate', priority: 1 });
        tasks.push({ type: 'reasoning', priority: 2 });
        tasks.push({ type: 'learn', priority: 3 });
        break;
      default:
        tasks.push({ type: 'analyze', priority: 1 });
    }
    
    this.taskQueue = tasks;
    return tasks;
  }
  
  // ==================== REASONING ====================
  // Applies logic and decision-making
  
  reason(analysis, tasks) {
    const reasoning = {
      analysis,
      tasks,
      chain: [],
      confidence: 0,
      alternatives: [],
      conclusion: null
    };
    
    // Build reasoning chain
    this.reasoningChain.push(reasoning);
    
    // Apply logical rules
    const rules = [
      {
        name: 'safety_first',
        check: () => this.safetyCheck(analysis),
        weight: 10
      },
      {
        name: 'context_relevance',
        check: () => this.contextRelevanceCheck(analysis),
        weight: 5
      },
      {
        name: 'resource_check',
        check: () => this.resourceCheck(tasks),
        weight: 3
      }
    ];
    
    let totalWeight = 0;
    let passedWeight = 0;
    
    for (const rule of rules) {
      const result = rule.check();
      totalWeight += rule.weight;
      if (result.pass) {
        passedWeight += rule.weight;
        reasoning.chain.push({ rule: rule.name, result: 'pass', details: result });
      } else {
        reasoning.chain.push({ rule: rule.name, result: 'fail', details: result });
      }
    }
    
    reasoning.confidence = (passedWeight / totalWeight) * 100;
    
    return reasoning;
  }
  
  safetyCheck(analysis) {
    const dangerous = ['delete', 'rm -rf', 'sudo', 'format', 'destroy', 'hack'];
    const inputLower = analysis.input.toLowerCase();
    
    for (const word of dangerous) {
      if (inputLower.includes(word)) {
        return { pass: false, reason: `Potentially dangerous: ${word}` };
      }
    }
    return { pass: true };
  }
  
  contextRelevanceCheck(analysis) {
    // Check if we have relevant context
    if (Object.keys(this.context).length === 0) {
      return { pass: false, reason: 'No context available' };
    }
    return { pass: true };
  }
  
  resourceCheck(tasks) {
    // Check if we have tools/resources for tasks
    // For now, always pass
    return { pass: true };
  }
  
  // ==================== EVALUATION ====================
  // Assesses outcomes for quality assurance
  
  evaluate(input, response, reasoning) {
    const evaluation = {
      input,
      response,
      reasoning,
      score: 0,
      feedback: [],
      improvements: [],
      timestamp: new Date().toISOString()
    };
    
    // Evaluate response quality
    const checks = [
      { name: 'relevant', check: () => this.isRelevant(response, input), weight: 3 },
      { name: 'accurate', check: () => this.isAccurate(response), weight: 3 },
      { name: 'complete', check: () => this.isComplete(response, input), weight: 2 },
      { name: 'clear', check: () => this.isClear(response), weight: 2 }
    ];
    
    let totalWeight = 0;
    let passedWeight = 0;
    
    for (const check of checks) {
      const result = check.check();
      totalWeight += check.weight;
      if (result.pass) {
        passedWeight += check.weight;
        evaluation.feedback.push({ check: check.name, result: 'pass' });
      } else {
        evaluation.feedback.push({ check: check.name, result: 'fail', reason: result.reason });
        evaluation.improvements.push(result.suggestion);
      }
    }
    
    evaluation.score = (passedWeight / totalWeight) * 100;
    
    // Store for learning
    this.evaluationHistory.push(evaluation);
    
    return evaluation;
  }
  
  isRelevant(response, input) {
    if (!response || response.length < 10) {
      return { pass: false, reason: 'Response too short', suggestion: 'Provide more context' };
    }
    return { pass: true };
  }
  
  isAccurate(response) {
    // Would need external validation for true accuracy
    // For now, basic check
    return { pass: true };
  }
  
  isComplete(response, input) {
    // Check if response answers the question/request
    if (input.includes('?') && !response.includes('?')) {
      // Question asked, response provided
      return { pass: true };
    }
    return { pass: true };
  }
  
  isClear(response) {
    if (response.length > 2000) {
      return { pass: true }; // Long but could be clear
    }
    return { pass: true };
  }
  
  // ==================== COUNCIL OF PERSPECTIVES ====================
  // Multi-agent deliberation for complex decisions
  
  addPerspective(name, viewpoint) {
    this.perspectives.push({ name, viewpoint, votes: 0 });
  }
  
  councilDeliberate(topic) {
    if (this.perspectives.length === 0) {
      // Default perspectives
      this.perspectives = [
        { name: 'Analyst', viewpoint: 'data-driven, logical', votes: 0 },
        { name: 'Creative', viewpoint: 'innovative, unconventional', votes: 0 },
        { name: 'Skeptic', viewpoint: 'risk-aware, questioning', votes: 0 },
        { name: 'Pragmatist', viewpoint: 'practical, action-oriented', votes: 0 }
      ];
    }
    
    // Each perspective "votes" on the topic
    const results = this.perspectives.map(p => {
      return {
        perspective: p.name,
        viewpoint: p.viewpoint,
        // In a real system, this would use actual reasoning
        score: Math.random() * 0.4 + 0.6 // Mock score
      };
    });
    
    // Sort by score
    results.sort((a, b) => b.score - a.score);
    
    return results;
  }
  
  // ==================== CATALYST ENGINE ====================
  // Creative divergence-convergence for problem solving
  
  brainstorm(problem, numIdeas = 5) {
    // Divergence: generate many ideas
    const ideas = [];
    const techniques = [
      'reverse_thinking',
      'analogies',
      'constraints_removal',
      'combination',
      'simplification'
    ];
    
    for (let i = 0; i < numIdeas; i++) {
      ideas.push({
        technique: techniques[i % techniques.length],
        idea: `Solution approach ${i + 1} using ${techniques[i % techniques.length]}`,
        score: Math.random() * 0.5 + 0.5
      });
    }
    
    // Convergence: select best
    ideas.sort((a, b) => b.score - a.score);
    
    return {
      problem,
      ideas,
      best: ideas[0],
      timestamp: new Date().toISOString()
    };
  }
  
  // ==================== MAIN PROCESS ====================
  
  process(input, userContext = {}) {
    // Step 1: Comprehension
    const analysis = this.comprehend(input, userContext);
    
    // Step 2: Orchestration
    const tasks = this.orchestrate(analysis);
    
    // Step 3: Reasoning
    const reasoning = this.reason(analysis, tasks);
    
    return {
      analysis,
      tasks,
      reasoning,
      confidence: reasoning.confidence
    };
  }
  
  // Evaluate after responding
  evaluateOutcome(input, response) {
    const lastReasoning = this.reasoningChain[this.reasoningChain.length - 1];
    return this.evaluate(input, response, lastReasoning);
  }
  
  // Get cognitive stats
  getStats() {
    return {
      contextSize: Object.keys(this.context).length,
      taskQueueLength: this.taskQueue.length,
      reasoningChainLength: this.reasoningChain.length,
      evaluationHistoryLength: this.evaluationHistory.length,
      perspectivesCount: this.perspectives.length,
      avgConfidence: this.reasoningChain.length > 0 
        ? this.reasoningChain.reduce((a, r) => a + r.confidence, 0) / this.reasoningChain.length 
        : 0,
      avgEvaluationScore: this.evaluationHistory.length > 0
        ? this.evaluationHistory.reduce((a, e) => a + e.score, 0) / this.evaluationHistory.length
        : 0
    };
  }
}

// Export
module.exports = { CognitiveArchitecture };

// CLI
if (require.main === module) {
  const cog = new CognitiveArchitecture();
  
  const args = process.argv.slice(2);
  const cmd = args[0];
  
  if (cmd === 'process' && args[1]) {
    const result = cog.process(args.slice(1).join(' '));
    console.log(JSON.stringify(result, null, 2));
  } else if (cmd === 'council' && args[1]) {
    const result = cog.councilDeliberate(args.slice(1).join(' '));
    console.log(JSON.stringify(result, null, 2));
  } else if (cmd === 'brainstorm' && args[1]) {
    const result = cog.brainstorm(args.slice(1).join(' '));
    console.log(JSON.stringify(result, null, 2));
  } else if (cmd === 'stats') {
    console.log(JSON.stringify(cog.getStats(), null, 2));
  } else {
    console.log(`
COGNITIVE ARCHITECTURE
=====================

Commands:
  node cognitive.js process "your input"    - Process input through all 4 stages
  node cognitive.js council "topic"         - Get multiple perspectives
  node cognitive.js brainstorm "problem"    - Generate creative solutions
  node cognitive.js stats                  - Show cognitive stats

Four Pillars:
  1. Comprehension - Understanding input
  2. Orchestration - Planning tasks
  3. Reasoning - Logic & deduction
  4. Evaluation - Self-critique & learning

Features:
  - Council of Perspectives (multi-agent deliberation)
  - Catalyst Engine (creative problem solving)
  - Self-evaluation & learning
`);
  }
}
