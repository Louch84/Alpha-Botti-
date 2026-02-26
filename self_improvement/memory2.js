#!/usr/bin/env node

/**
 * Memory 2.0 - Enhanced Memory with Auto-Tagging
 * Features:
 * - Auto-categorize entries
 * - Priority tagging
 * - Cross-reference topics
 * - Learning tracking
 */

const fs = require('fs');
const path = require('path');

const MEMORY_DIR = path.join(__dirname, '../memory');
const INSIGHTS_FILE = path.join(__dirname, 'insights.json');

// Categories for auto-tagging
const CATEGORIES = {
  trading: ['gamma', 'squeeze', 'options', 'stocks', 'gap', 'short', 'bull', 'bear'],
  coding: ['scanner', 'python', 'javascript', 'node', 'api', 'code', 'script'],
  research: ['data', 'source', 'api', 'fetch', 'scrape', 'find'],
  personal: ['louch', 'creator', 'preference', 'note', 'remember'],
  technical: ['server', 'system', 'tool', 'workspace', 'file'],
  finance: ['money', 'make', 'income', 'profit', 'trade']
};

// Priority keywords
const HIGH_PRIORITY = ['important', 'remember', 'critical', 'never forget', 'rule', 'boundaries'];
const LOW_PRIORITY = ['maybe', 'sometime', 'possibly', 'might', 'could'];

class Memory2 {
  constructor() {
    this.insights = this.loadInsights();
  }
  
  loadInsights() {
    try {
      if (fs.existsSync(INSIGHTS_FILE)) {
        return JSON.parse(fs.readFileSync(INSIGHTS_FILE, 'utf8'));
      }
    } catch (e) {}
    return {
      version: "2.0",
      created: new Date().toISOString(),
      entries: [],
      topic_map: {},
      priority_entries: [],
      categories: {}
    };
  }
  
  save() {
    fs.writeFileSync(INSIGHTS_FILE, JSON.stringify(this.insights, null, 2));
  }
  
  // Auto-tag a memory entry
  autoTag(text) {
    const textLower = text.toLowerCase();
    const tags = [];
    
    // Categorize
    for (const [category, keywords] of Object.entries(CATEGORIES)) {
      for (const keyword of keywords) {
        if (textLower.includes(keyword)) {
          tags.push(category);
          break;
        }
      }
    }
    
    // Priority
    let priority = 'normal';
    for (const hp of HIGH_PRIORITY) {
      if (textLower.includes(hp)) {
        priority = 'high';
        break;
      }
    }
    if (priority === 'normal') {
      for (const lp of LOW_PRIORITY) {
        if (textLower.includes(lp)) {
          priority = 'low';
          break;
        }
      }
    }
    
    return { tags: [...new Set(tags)], priority };
  }
  
  // Add new insight
  add(text, source = 'unknown') {
    const { tags, priority } = this.autoTag(text);
    
    const entry = {
      id: Date.now(),
      text,
      tags,
      priority,
      source,
      created: new Date().toISOString(),
      referenced: 0
    };
    
    this.insights.entries.unshift(entry);
    
    // Track topics
    for (const tag of tags) {
      if (!this.insights.topic_map[tag]) {
        this.insights.topic_map[tag] = [];
      }
      this.insights.topic_map[tag].push(entry.id);
    }
    
    // Priority queue
    if (priority === 'high') {
      this.insights.priority_entries.push(entry.id);
    }
    
    // Limit entries
    if (this.insights.entries.length > 1000) {
      this.insights.entries = this.insights.entries.slice(0, 1000);
    }
    
    this.save();
    return entry;
  }
  
  // Search with relevance
  search(query, limit = 10) {
    const queryLower = query.toLowerCase();
    const queryTags = this.autoTag(query).tags;
    
    // Score each entry
    const scored = this.insights.entries.map(entry => {
      let score = 0;
      
      // Direct match
      if (entry.text.toLowerCase().includes(queryLower)) score += 10;
      
      // Tag match
      for (const tag of queryTags) {
        if (entry.tags.includes(tag)) score += 5;
      }
      
      // Priority boost
      if (entry.priority === 'high') score += 3;
      
      // Recency boost
      const hoursAgo = (Date.now() - new Date(entry.created).getTime()) / (1000 * 60 * 60);
      if (hoursAgo < 24) score += 2;
      else if (hoursAgo < 168) score += 1; // 1 week
      
      return { ...entry, score };
    });
    
    return scored
      .filter(e => e.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
  
  // Get related entries
  related(entryId, limit = 5) {
    const entry = this.insights.entries.find(e => e.id === entryId);
    if (!entry) return [];
    
    return this.search(entry.tags.join(' '), limit + 1)
      .filter(e => e.id !== entryId)
      .slice(0, limit);
  }
  
  // Get topic summary
  getTopics() {
    const topics = {};
    for (const [tag, ids] of Object.entries(this.insights.topic_map)) {
      topics[tag] = {
        count: ids.length,
        latest: new Date(ids[0]).toLocaleDateString()
      };
    }
    return topics;
  }
  
  // Get priority items
  getPriority() {
    return this.insights.entries.filter(e => e.priority === 'high');
  }
}

// Export for use
module.exports = { Memory2 };

// CLI
if (require.main === module) {
  const mem = new Memory2();
  
  const args = process.argv.slice(2);
  const cmd = args[0];
  
  if (cmd === 'add' && args[1]) {
    const entry = mem.add(args.slice(1).join(' '), 'cli');
    console.log('Added:', entry.id);
  } else if (cmd === 'search' && args[1]) {
    const results = mem.search(args.slice(1).join(' '));
    results.forEach(r => {
      console.log(`[${r.score}] ${r.text.slice(0, 80)}...`);
    });
  } else if (cmd === 'topics') {
    const topics = mem.getTopics();
    console.log(JSON.stringify(topics, null, 2));
  } else if (cmd === 'priority') {
    const items = mem.getPriority();
    items.forEach(i => console.log(i.text.slice(0, 100)));
  } else {
    console.log('Usage:');
    console.log('  node memory2.js add "your insight here"');
    console.log('  node memory2.js search "query"');
    console.log('  node memory2.js topics');
    console.log('  node memory2.js priority');
  }
}
