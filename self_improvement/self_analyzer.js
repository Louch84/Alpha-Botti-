#!/usr/bin/env node

/**
 * Self-Analyzer
 * Reviews my code and suggests improvements
 * Identifies patterns, bugs, and optimization opportunities
 */

const fs = require('fs');
const path = require('path');

const WORKSPACE = path.join(__dirname, '..');
const SCANNER_DIR = path.join(WORKSPACE, 'gamma_scanner');

class SelfAnalyzer {
  constructor() {
    this.issues = [];
    this.patterns = {};
  }
  
  // Analyze a file or directory
  analyze(target) {
    this.issues = [];
    this.patterns = {};
    
    if (fs.statSync(target).isDirectory()) {
      this.analyzeDir(target);
    } else {
      this.analyzeFile(target);
    }
    
    return this.getReport();
  }
  
  analyzeDir(dir) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Skip node_modules, etc
        if (!['node_modules', '.git', 'memory'].includes(file)) {
          this.analyzeDir(fullPath);
        }
      } else if (file.endsWith('.js')) {
        this.analyzeFile(fullPath);
      }
    }
  }
  
  analyzeFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const relativePath = path.relative(WORKSPACE, filePath);
      
      // Check for common issues
      this.checkErrorHandling(content, relativePath);
      this.checkHardcoded(content, relativePath);
      this.checkAsyncIssues(content, relativePath);
      this.checkSecurity(content, relativePath);
      this.checkPerformance(content, relativePath);
      this.checkCodeSmell(content, relativePath);
      this.trackPatterns(content, relativePath);
      
    } catch (e) {
      this.issues.push({
        type: 'error',
        file: filePath,
        message: 'Could not analyze: ' + e.message
      });
    }
  }
  
  checkErrorHandling(content, file) {
    // Missing try-catch
    const asyncFunctions = content.match(/async\s+function/g);
    const tryCatch = content.match(/try\s*{/g);
    
    if (asyncFunctions && tryCatch && asyncFunctions.length > tryCatch.length * 1.5) {
      this.issues.push({
        type: 'error_handling',
        severity: 'medium',
        file,
        message: 'Many async functions but limited try-catch blocks'
      });
    }
    
    // Console.log in production code
    if (content.includes('console.log') && file.includes('scanner')) {
      this.issues.push({
        type: 'code_quality',
        severity: 'low',
        file,
        message: 'Consider removing console.log or using proper logger'
      });
    }
  }
  
  checkHardcoded(content, file) {
    // Hardcoded API keys
    if (content.match(/api[_-]?key\s*=\s*['"][a-zA-Z0-9]{20,}['"]/)) {
      this.issues.push({
        type: 'security',
        severity: 'high',
        file,
        message: 'Hardcoded API key found - should use environment variables'
      });
    }
    
    // Hardcoded values that should be config
    if (content.match(/const\s+\w+\s*=\s*\d+/) && !content.includes('FILTERS')) {
      const magicNumbers = content.match(/\d{2,}/g);
      if (magicNumbers && magicNumbers.length > 3) {
        this.issues.push({
          type: 'maintainability',
          severity: 'low',
          file,
          message: 'Multiple magic numbers - consider extracting to constants'
        });
      }
    }
  }
  
  checkAsyncIssues(content, file) {
    // Missing await
    if (content.includes('.then(') && !content.includes('await')) {
      this.issues.push({
        type: 'async',
        severity: 'medium',
        file,
        message: 'Using .then() without await - could use async/await for readability'
      });
    }
    
    // Unhandled promise
    if (content.match(/axios\.\w+\(/) && !content.includes('await') && !content.includes('.then')) {
      this.issues.push({
        type: 'async',
        severity: 'medium',
        file,
        message: 'Async call without await or .then() - may cause unhandled rejection'
      });
    }
  }
  
  checkSecurity(content, file) {
    // Command injection
    if (content.includes('exec(') || content.includes('shell')) {
      if (!content.includes('sanitize') && !content.includes('escape')) {
        this.issues.push({
          type: 'security',
          severity: 'high',
          file,
          message: 'Shell execution without sanitization - potential injection risk'
        });
      }
    }
  }
  
  checkPerformance(content, file) {
    // Nested loops
    const nestedLoops = content.match(/(for|while).*\{[^}]*(for|while)/g);
    if (nestedLoops && nestedLoops.length > 2) {
      this.issues.push({
        type: 'performance',
        severity: 'medium',
        file,
        message: 'Multiple nested loops - could be O(n²) or worse'
      });
    }
    
    // Synchronous file operations in loop
    if (content.includes('for (') && content.includes('fs.writeFileSync')) {
      this.issues.push({
        type: 'performance',
        severity: 'medium',
        file,
        message: 'Writing files in loop - consider batching or async'
      });
    }
  }
  
  checkCodeSmell(content, file) {
    // Too long function
    const functions = content.match(/function\s+\w+[^}]*{/g);
    if (functions && functions.length > 5) {
      // Rough check for long functions
      const lines = content.split('\n').length;
      if (lines > 300) {
        this.issues.push({
          type: 'code_smell',
          severity: 'low',
          file,
          message: `File has ${lines} lines - consider splitting into modules`
        });
      }
    }
    
    // Duplicate code (simple check)
    const lines = content.split('\n').filter(l => l.trim().length > 20);
    const duplicates = lines.filter((l, i) => lines.lastIndexOf(l) !== i);
    if (duplicates.length > 5) {
      this.issues.push({
        type: 'code_smell',
        severity: 'low',
        file,
        message: 'Possible duplicate code blocks - consider refactoring'
      });
    }
  }
  
  trackPatterns(content, file) {
    // Track patterns for learning
    const patterns = [
      { name: 'api_calls', regex: /axios\.\w+\(/ },
      { name: 'file_ops', regex: /fs\.\w+/ },
      { name: 'async', regex: /async|await|Promise/ },
      { name: 'error_handling', regex: /try|catch|throw/ },
      { name: 'json', regex: /JSON\./ },
    ];
    
    for (const p of patterns) {
      if (p.regex.test(content)) {
        this.patterns[p.name] = (this.patterns[p.name] || 0) + 1;
      }
    }
  }
  
  getReport() {
    const bySeverity = { high: [], medium: [], low: [] };
    const byType = {};
    
    for (const issue of this.issues) {
      bySeverity[issue.severity].push(issue);
      byType[issue.type] = (byType[issue.type] || 0) + 1;
    }
    
    return {
      summary: {
        totalIssues: this.issues.length,
        high: bySeverity.high.length,
        medium: bySeverity.medium.length,
        low: bySeverity.low.length,
        patterns: this.patterns
      },
      bySeverity,
      byType,
      recommendations: this.getRecommendations()
    };
  }
  
  getRecommendations() {
    const recs = [];
    
    // Based on patterns
    if (!this.patterns.error_handling || this.patterns.error_handling < this.patterns.async) {
      recs.push({
        priority: 'high',
        recommendation: 'Add more error handling to async operations'
      });
    }
    
    if (this.patterns.api_calls && !this.patterns.api_calls % 5) {
      recs.push({
        priority: 'medium',
        recommendation: 'Consider adding rate limiting for API calls'
      });
    }
    
    // Based on issues
    const highSev = this.issues.filter(i => i.severity === 'high');
    if (highSev.length > 0) {
      recs.push({
        priority: 'critical',
        recommendation: `Fix ${highSev.length} high severity issues first`
      });
    }
    
    return recs;
  }
}

// Main
if (require.main === module) {
  const analyzer = new SelfAnalyzer();
  
  const target = process.argv[2] || SCANNER_DIR;
  
  console.log('Analyzing:', target);
  console.log('');
  
  const report = analyzer.analyze(target);
  
  console.log('=== SELF ANALYSIS REPORT ===\n');
  console.log('Summary:');
  console.log(`  Total Issues: ${report.summary.totalIssues}`);
  console.log(`  High: ${report.summary.high} | Medium: ${report.summary.medium} | Low: ${report.summary.low}`);
  console.log('');
  
  console.log('Patterns Found:', report.summary.patterns);
  console.log('');
  
  if (report.bySeverity.high.length > 0) {
    console.log('HIGH PRIORITY:');
    report.bySeverity.high.forEach(i => {
      console.log(`  [${i.file}] ${i.message}`);
    });
    console.log('');
  }
  
  if (report.recommendations.length > 0) {
    console.log('RECOMMENDATIONS:');
    report.recommendations.forEach(r => {
      console.log(`  [${r.priority}] ${r.recommendation}`);
    });
  }
}

module.exports = { SelfAnalyzer };
