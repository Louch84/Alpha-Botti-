#!/usr/bin/env node

/**
 * Gamma Squeeze Scanner - V3
 * Uses Twelve Data API for real-time data
 * Process:
 * 1. Get stock universe from Twelve Data
 * 2. Scan for gap down + consolidation
 * 3. Check gamma squeeze variables (hardcoded for now)
 * 4. Find cheap options (estimated)
 * 5. Score & rank
 */

const axios = require('axios');
const fs = require('fs');

const TWELVE_DATA_KEY = 'd3a2f4b6b6674f35adad540f85ae9dca';
const ALPHA_VANTAGE_KEY = 'O28K7EKBWDS9TMJK';

// Stock universe (could expand with Twelve Data stock list later)
const STOCK_UNIVERSE = [
  // Meme / High Short
  'GME', 'AMC', 'BB', 'NOK', 'CLOV', 'MARA', 'RIOT', 'BTBT', 'SOUN', 'UPST',
  'WISH', 'RIVN', 'LCID', 'DKNG', 'SNAP', 'COIN', 'HOOD', 'PATH', 'PLTR',
  'SOFI', 'BABA', 'PDD', 'JD', 'NIO', 'XPEV', 'LI', 'MRNA', 'TXMD', 'LAZR', 'STEM',
  // Tech
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'AMD', 'INTC', 'CSCO', 'ORCL',
  'CRM', 'ADBE', 'NFLX', 'PYPL', 'SQ', 'SHOP', 'UBER', 'LYFT', 'ROKU', 'ZM',
  // Finance
  'JPM', 'BAC', 'WFC', 'GS', 'MS', 'C', 'BLK', 'AXP', 'V', 'MA', 'COF', 'USB',
  // Healthcare
  'UNH', 'JNJ', 'PFE', 'MRK', 'ABBV', 'LLY', 'TMO', 'ABT', 'BMY', 'AMGN', 'GILD',
  // Energy
  'XOM', 'CVX', 'COP', 'EOG', 'MPC', 'VLO', 'PSX', 'OXY', 'HAL', 'SLB', 'DVN',
  // More
  'TSLA', 'RBLX', 'SNOW', 'CRWD', 'NET', 'GLOB', 'MDB', 'U', 'DDOG', 'OKTA'
];

const UNIQUE_STOCKS = [...new Set(STOCK_UNIVERSE)];

const FILTERS = {
  // Step 1: Technical
  gapDownMin: -25,
  gapDownMax: -5,
  consolidationMax: 15,
  
  // Step 2: Gamma squeeze
  shortInterestMin: 15,
  floatMax: 1_000_000_000,
  volumeMin: 1_000_000,
  
  // Step 3: Price
  maxPrice: 40,
  
  // Step 4: Options
  optionMinPrice: 0.01,
  optionMaxPrice: 0.10,
  
  // Scoring
  scoreMin: 20,
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Fetch quote from Twelve Data
async function getQuote(symbol) {
  try {
    const url = `https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${TWELVE_DATA_KEY}`;
    const { data } = await axios.get(url, { timeout: 10000 });
    
    if (data.code === 400 || data.code === 404) return null;
    if (data.status === 'error') return null;
    
    return {
      symbol: data.symbol,
      price: parseFloat(data.close),
      prevClose: parseFloat(data.previous_close),
      open: parseFloat(data.open),
      high: parseFloat(data.high),
      low: parseFloat(data.low),
      volume: parseInt(data.volume),
      avgVolume: parseInt(data.average_volume),
      change: parseFloat(data.change),
      percentChange: parseFloat(data.percent_change),
    };
  } catch (e) {
    return null;
  }
}

// Get historical data for consolidation
async function getHistory(symbol) {
  try {
    // Use Twelve Data for time series
    const url = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=1day&outputsize=10&apikey=${TWELVE_DATA_KEY}`;
    const { data } = await axios.get(url, { timeout: 10000 });
    
    if (!data.values || data.values.length < 5) return null;
    
    const closes = data.values.map(v => parseFloat(v.close));
    const highs = data.values.map(v => parseFloat(v.high));
    const lows = data.values.map(v => parseFloat(v.low));
    
    // 5-day consolidation
    const h5 = highs.slice(-5);
    const l5 = lows.slice(-5);
    const consolidation = h5.length > 0 ? ((Math.max(...h5) - Math.min(...l5)) / Math.min(...l5)) * 100 : 100;
    
    // Gap down from 5 days ago
    const fiveDaysAgo = closes[closes.length - 5] || closes[0];
    const current = closes[0];
    const gapDown = ((current - fiveDaysAgo) / fiveDaysAgo) * 100;
    
    return { gapDown, consolidation, history: data.values };
  } catch (e) {
    return null;
  }
}

// Known short interest (would need real source for live data)
const KNOWN_SHORT = {
  'GME': 15.2, 'AMC': 22.1, 'CLOV': 25.4, 'MARA': 28.5, 'RIOT': 31.2,
  'BTBT': 15.0, 'SOUN': 12.0, 'UPST': 22.0, 'WISH': 18.9, 'RIVN': 5.2,
  'LCID': 4.8, 'DKNG': 10.2, 'SNAP': 9.1, 'COIN': 14.2, 'HOOD': 6.8,
  'PLTR': 12.3, 'BB': 4.2, 'NOK': 3.1, 'SOFI': 8.5, 'PATH': 18.5,
  'LAZR': 8.5, 'STEM': 12.0, 'TXMD': 25.0, 'MRNA': 8.5,
};

const KNOWN_FLOAT = {
  'GME': 304000000, 'AMC': 517000000, 'CLOV': 485000000, 'MARA': 89000000,
  'RIOT': 73000000, 'BTBT': 95000000, 'UPST': 95000000, 'WISH': 580000000,
  'RIVN': 1730000000, 'LCID': 2150000000, 'PLTR': 2150000000, 'COIN': 212000000,
  'HOOD': 890000000, 'PATH': 215000000, 'SNAP': 1580000000,
  'LAZR': 120000000, 'STEM': 145000000, 'TXMD': 85000000,
};

function getShortInterest(symbol) {
  return KNOWN_SHORT[symbol.toUpperCase()] || 0;
}

function getFloat(symbol) {
  return KNOWN_FLOAT[symbol.toUpperCase()] || 500000000;
}

// Score calculation
function calculateScore(data) {
  let score = 0;
  
  // Short interest (0-35)
  const si = data.shortInterest;
  if (si > 40) score += 35;
  else if (si > 30) score += 30;
  else if (si > 25) score += 25;
  else if (si > 20) score += 20;
  else if (si > 15) score += 15;
  else if (si > 10) score += 10;
  
  // Float (0-25)
  const float = data.float;
  if (float < 10_000_000) score += 25;
  else if (float < 25_000_000) score += 20;
  else if (float < 50_000_000) score += 15;
  else if (float < 100_000_000) score += 10;
  else if (float < 200_000_000) score += 5;
  
  // Gap down (0-20)
  const gap = Math.abs(data.gapDown);
  if (gap >= 15) score += 20;
  else if (gap >= 10) score += 15;
  else if (gap >= 7) score += 10;
  else if (gap >= 5) score += 5;
  
  // Consolidation (0-10)
  if (data.consolidation < 5) score += 10;
  else if (data.consolidation < 8) score += 7;
  else if (data.consolidation < 12) score += 5;
  
  // Volume (0-10)
  if (data.volume > 50_000_000) score += 10;
  else if (data.volume > 20_000_000) score += 7;
  else if (data.volume > 10_000_000) score += 5;
  else if (data.volume > 5_000_000) score += 3;
  
  return Math.min(score, 100);
}

// Find cheap options
function findCheapOptions(price) {
  if (!price || price > 40 || price < 1) return [];
  
  const plays = [];
  const strikes = [
    Math.round(price),
    Math.round(price * 0.95),
    Math.round(price * 1.05),
    Math.round(price * 0.90),
    Math.round(price * 1.10),
  ];
  
  const unique = [...new Set(strikes)].filter(s => s > 0 && s < 100);
  
  unique.forEach(strike => {
    const otmPct = Math.abs(strike - price) / price * 100;
    if (otmPct > 15) return;
    
    const isCall = strike >= price;
    const intrinsic = Math.abs(price - strike);
    const timeValue = 0.03 + (otmPct / 100) * 0.05;
    const optPrice = Math.min(FILTERS.optionMaxPrice, Math.max(FILTERS.optionMinPrice, intrinsic + timeValue));
    
    if (optPrice >= FILTERS.optionMinPrice && optPrice <= FILTERS.optionMaxPrice) {
      plays.push({
        type: isCall ? 'call' : 'put',
        strike,
        price: optPrice.toFixed(2),
        otm: otmPct.toFixed(0) + '%'
      });
    }
  });
  
  return plays.slice(0, 3);
}

// Main scan
async function main() {
  console.log('\n🎯 GAMMA SQUEEZE SCANNER V3');
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Scanning ${UNIQUE_STOCKS.length} stocks with Twelve Data...\n`);
  
  // Step 1: Fetch all quotes
  console.log('📊 Step 1: Fetching quotes...');
  const quotes = [];
  
  for (let i = 0; i < UNIQUE_STOCKS.length; i++) {
    const symbol = UNIQUE_STOCKS[i];
    if ((i + 1) % 20 === 0) {
      process.stdout.write(`\n  [${i + 1}/${UNIQUE_STOCKS.length}] `);
    }
    process.stdout.write('.');
    
    const [quote, history] = await Promise.all([
      getQuote(symbol),
      getHistory(symbol)
    ]);
    
    if (quote && history) {
      quotes.push({
        symbol,
        ...quote,
        gapDown: history.gapDown,
        consolidation: history.consolidation,
      });
    }
    
    await delay(200); // Rate limit for free API
  }
  
  console.log(`\n\n✅ Got data for ${quotes.length} stocks`);
  
  // Step 2: Filter gap down + consolidation
  console.log('\n📉 Step 2: Filtering for gap down + consolidation...');
  const gapDownFiltered = quotes.filter(s => 
    s.gapDown >= FILTERS.gapDownMin &&
    s.gapDown <= FILTERS.gapDownMax &&
    s.consolidation <= FILTERS.consolidationMax
  );
  
  console.log(`   Found ${gapDownFiltered.length} with gap down + tight consolidation`);
  
  // Step 3: Add gamma variables
  console.log('\n🎯 Step 3: Checking gamma squeeze variables...');
  const gammaCandidates = gapDownFiltered.map(s => {
    const shortInterest = getShortInterest(s.symbol);
    const float = getFloat(s.symbol);
    
    return {
      ...s,
      shortInterest,
      float,
    };
  }).filter(s => 
    s.shortInterest >= FILTERS.shortInterestMin &&
    s.float <= FILTERS.floatMax &&
    s.price <= FILTERS.maxPrice &&
    s.volume >= FILTERS.volumeMin
  );
  
  console.log(`   Found ${gammaCandidates.length} passing gamma squeeze criteria`);
  
  // Step 4: Score
  console.log('\n🏆 Step 4: Scoring...');
  const scored = gammaCandidates.map(s => ({
    ...s,
    score: calculateScore(s),
    cheapOptions: findCheapOptions(s.price)
  })).filter(s => s.score >= FILTERS.scoreMin)
    .sort((a, b) => b.score - a.score);
  
  console.log(`   ${scored.length} with score >= ${FILTERS.scoreMin}`);
  
  // Results
  console.log('\n' + '='.repeat(60));
  console.log('🎯 TOP GAMMA SQUEEZE CANDIDATES');
  console.log('='.repeat(60));
  
  if (scored.length === 0) {
    console.log('\n❌ No setups found today');
  } else {
    scored.forEach((s, i) => {
      console.log(`\n#${i + 1} ${s.symbol} | Score: ${s.score}/100`);
      console.log(`   Price: $${s.price?.toFixed(2)} | Gap: ${s.gapDown?.toFixed(1)}% | Consol: ${s.consolidation?.toFixed(1)}%`);
      console.log(`   Short: ${s.shortInterest}% | Float: ${(s.float/1e6).toFixed(1)}M | Vol: ${(s.volume/1e6).toFixed(1)}M`);
      
      if (s.cheapOptions?.length > 0) {
        console.log(`   Penny Options ($0.01-$0.10):`);
        s.cheapOptions.forEach(o => {
          console.log(`      ${o.type.toUpperCase()} $${o.strike} @ $${o.price} (${o.otm})`);
        });
      }
    });
  }
  
  console.log('\n' + '='.repeat(60));
  
  // Save
  const filename = `gamma_scan_v3_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.json`;
  fs.writeFileSync(filename, JSON.stringify(scored, null, 2));
  console.log(`\n💾 Saved: ${filename}\n`);
  
  return scored;
}

main().catch(console.error);
