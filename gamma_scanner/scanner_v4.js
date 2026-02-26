#!/usr/bin/env node

/**
 * Gamma Squeeze Scanner - V4 (Gap Fill Focus)
 * 
 * Process:
 * 1. Find gap down stocks (3-10%)
 * 2. Check consolidation (tight, building pressure)
 * 3. Check if approaching fill level (ready to bounce)
 * 4. Check gamma squeeze variables (short interest, float, volume)
 * 5. Find cheap options
 * 6. Score & rank
 */

const axios = require('axios');
const fs = require('fs');

const TWELVE_DATA_KEY = 'd3a2f4b6b6674f35adad540f85ae9dca';
const ALPHA_VANTAGE_KEY = 'O28K7EKBWDS9TMJK';

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

// ============ FILTERS ============

const FILTERS = {
  // Step 1: Gap Down (3-10% - not too big, not too small)
  gapDownMin: -10,   // Max gap down
  gapDownMax: -3,    // Min gap down (3%+)
  
  // Step 2: Consolidation (tight, building pressure)
  consolidationMax: 20,  // Max 5-day range %
  consolidationMin: 3,   // Min consolidation (needs some movement)
  
  // Step 3: Gap Fill Potential (allow partial fill, filter out negative)
  gapFillMin: 0,   // Any positive fill (not still falling)
  gapFillMax: 100,   // Allow up to 100% filled (can still have room)
  
  // Step 4: Trend (CRITICAL - must be uptrending or bottoming)
  trendMin: 25,    // Min trend score (0-100) - lowered to find more
  
  // Step 5: Gamma Squeeze Variables
  shortInterestMin: 5,   // Lowered to find more setups
  floatMax: 1_000_000_000,
  volumeMin: 1_000_000,
  
  // Step 6: Price
  maxPrice: 40,
  
  // Step 7: Options
  optionMinPrice: 0.01,
  optionMaxPrice: 0.10,
  
  // Scoring
  scoreMin: 15,
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ============ DATA FETCHING ============

// Try Twelve Data first, fallback to Alpha Vantage
async function getQuote(symbol) {
  // Try Twelve Data
  try {
    const url = `https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${TWELVE_DATA_KEY}`;
    const { data } = await axios.get(url, { timeout: 10000 });
    
    if (data.code === 400 || data.code === 404) throw new Error('not found');
    if (data.status === 'error') throw new Error('error');
    
    return {
      symbol: data.symbol,
      price: parseFloat(data.close),
      prevClose: parseFloat(data.previous_close),
      open: parseFloat(data.open),
      high: parseFloat(data.high),
      low: parseFloat(data.low),
      volume: parseInt(data.volume),
      avgVolume: parseInt(data.average_volume),
    };
  } catch (e) {
    // Fallback to Alpha Vantage
    try {
      const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`;
      const { data } = await axios.get(url, { timeout: 10000 });
      
      if (data['Global Quote'] && Object.keys(data['Global Quote']).length > 0) {
        const q = data['Global Quote'];
        return {
          symbol: q['01. symbol'],
          price: parseFloat(q['05. price']),
          prevClose: parseFloat(q['08. previous close']),
          open: parseFloat(q['02. open']),
          high: parseFloat(q['03. high']),
          low: parseFloat(q['04. low']),
          volume: parseInt(q['06. volume']),
          avgVolume: parseInt(q['06. volume']),
        };
      }
    } catch (e2) {}
  }
  return null;
}

async function getHistory(symbol) {
  // Try Twelve Data first
  try {
    const url = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=1day&outputsize=60&apikey=${TWELVE_DATA_KEY}`;
    const { data } = await axios.get(url, { timeout: 10000 });
    
    if (!data.values || data.values.length < 5) throw new Error('no data');
    
    // API returns newest first, reverse it
    const values = data.values.reverse().map(v => ({
      close: parseFloat(v.close),
      high: parseFloat(v.high),
      low: parseFloat(v.low),
      volume: parseInt(v.volume),
      datetime: v.datetime
    }));
    
    const current = values[values.length - 1];
    const prevClose = values[values.length - 2]?.close || current.close;
    
    // Find biggest gap down
    let maxGap = 0;
    let gapDay = null;
    
    for (let i = 1; i < values.length; i++) {
      const gap = ((values[i].close - values[i-1].close) / values[i-1].close) * 100;
      if (gap < maxGap) {
        maxGap = gap;
        gapDay = values[i];
      }
    }
    
    if (!gapDay) return null;
    
    const gapSize = Math.abs(maxGap);
    const filled = ((gapDay.close - current.close) / gapDay.close) * 100;
    const gapFillPct = Math.max(0, Math.min(100, filled));
    
    const recent = values.slice(-5);
    const high = Math.max(...recent.map(v => v.high));
    const low = Math.min(...recent.map(v => v.low));
    const consolidation = ((high - low) / low) * 100;
    
    const vol5 = recent.reduce((sum, v) => sum + v.volume, 0) / recent.length;
    const volPrev = values.slice(-10, -5).reduce((sum, v) => sum + v.volume, 0) / 5;
    const volumeTrend = volPrev > 0 ? ((vol5 - volPrev) / volPrev) * 100 : 0;
    
    const gapIndex = values.findIndex(v => v.datetime === gapDay.datetime);
    const daysSinceGap = values.length - 1 - gapIndex;
    
    return {
      gapDown: maxGap,
      gapDay: gapDay.datetime,
      daysSinceGap,
      consolidation,
      gapFillPct,
      volumeTrend,
      currentPrice: current.close,
      gapDayPrice: gapDay.close,
      prevGapDayClose: values[gapIndex - 1]?.close || gapDay.close,
      trendScore: calculateTrendScore(values),
    };
  } catch (e) {
    // Try Alpha Vantage
    try {
      const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=compact&apikey=${ALPHA_VANTAGE_KEY}`;
      const { data } = await axios.get(url, { timeout: 10000 });
      
      if (!data['Time Series (Daily)']) return null;
      
      const ts = data['Time Series (Daily)'];
      const dates = Object.keys(ts).sort();
      
      if (dates.length < 20) return null;
      
      const values = dates.slice(-60).map(date => ({
        close: parseFloat(ts[date]['4. close']),
        high: parseFloat(ts[date]['2. high']),
        low: parseFloat(ts[date]['3. low']),
        volume: parseInt(ts[date]['5. volume']),
        datetime: date
      }));
      
      const current = values[values.length - 1];
      const prevClose = values[values.length - 2].close;
      
      let maxGap = 0;
      let gapDay = null;
      
      for (let i = 1; i < values.length; i++) {
        const gap = ((values[i].close - values[i-1].close) / values[i-1].close) * 100;
        if (gap < maxGap) {
          maxGap = gap;
          gapDay = values[i];
        }
      }
      
      if (!gapDay) return null;
      
      const filled = ((gapDay.close - current.close) / gapDay.close) * 100;
      const gapFillPct = Math.max(0, Math.min(100, filled));
      
      const recent = values.slice(-5);
      const high = Math.max(...recent.map(v => v.high));
      const low = Math.min(...recent.map(v => v.low));
      const consolidation = ((high - low) / low) * 100;
      
      const vol5 = recent.reduce((sum, v) => sum + v.volume, 0) / 5;
      const volPrev = values.slice(-10, -5).reduce((sum, v) => sum + v.volume, 0) / 5;
      const volumeTrend = volPrev > 0 ? ((vol5 - volPrev) / volPrev) * 100 : 0;
      
      const gapIndex = values.findIndex(v => v.datetime === gapDay.datetime);
      const daysSinceGap = values.length - 1 - gapIndex;
      
      return {
        gapDown: maxGap,
        gapDay: gapDay.datetime,
        daysSinceGap,
        consolidation,
        gapFillPct,
        volumeTrend,
        currentPrice: current.close,
        gapDayPrice: gapDay.close,
        prevGapDayClose: values[gapIndex - 1]?.close || gapDay.close,
        trendScore: calculateTrendScore(values),
      };
    } catch (e2) {
      return null;
    }
  }
}

// ============ KNOWN DATA ============

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

// ============ TREND ANALYSIS ============

function calculateTrendScore(values) {
  // Returns 0-100 score (higher = more bullish)
  // Uses: price vs MAs, MA direction, structure
  
  if (!values || values.length < 50) return 50; // Neutral if not enough data
  
  const closes = values.map(v => v.close);
  const current = closes[closes.length - 1];
  
  // Moving averages
  const ma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const ma50 = closes.slice(-50).reduce((a, b) => a + b, 0) / 50;
  const ma10 = closes.slice(-10).reduce((a, b) => a + b, 0) / 10;
  
  let score = 50; // Start neutral
  
  // Price vs 20-day MA (0-20 points)
  if (current > ma20) score += 15;
  else score -= 10;
  
  // Price vs 50-day MA (0-20 points)
  if (current > ma50) score += 15;
  else score -= 10;
  
  // 20 MA vs 50 MA (trend direction) (0-15 points)
  if (ma20 > ma50) {
    score += 15; // Bullish alignment
  } else if (ma20 > ma50 * 0.95) {
    score += 5; // Nearing crossover
  } else {
    score -= 15; // Bearish alignment
  }
  
  // Recent momentum (last 10 days vs 10 days before) (0-15 points)
  const recent10 = closes.slice(-10).reduce((a, b) => a + b, 0) / 10;
  const prev10 = closes.slice(-20, -10).reduce((a, b) => a + b, 0) / 10;
  const momentum = ((recent10 - prev10) / prev10) * 100;
  
  if (momentum > 5) score += 15;
  else if (momentum > 0) score += 10;
  else if (momentum > -5) score += 5;
  else score -= 10;
  
  // Higher highs / Higher lows structure (0-15 points)
  const highs = closes.slice(-20).map((_, i) => closes.slice(-20)[i]);
  const hhCount = highs.filter((h, i) => i > 0 && h > highs[i-1]).length;
  if (hhCount > 12) score += 15;
  else if (hhCount > 8) score += 10;
  else if (hhCount > 5) score += 5;
  else score -= 10;
  
  // Long-term trend (check 200-day equivalent if available)
  if (closes.length >= 200) {
    const ma200 = closes.slice(-200).reduce((a, b) => a + b, 0) / 200;
    if (current > ma200) score += 10;
    else score -= 10;
  }
  
  return Math.max(0, Math.min(100, score));
}

// ============ SCORING ============

function calculateScore(data) {
  let score = 0;
  
  // Gap fill potential (0-25)
  const fill = data.gapFillPct;
  if (fill >= 50 && fill <= 80) score += 25;  // Sweet spot: 50-80% filled
  else if (fill >= 30 && fill <= 90) score += 20;
  else if (fill >= 20 && fill <= 95) score += 15;
  else if (fill >= 10 && fill <= 100) score += 10;
  
  // Days since gap (0-15) - recent gaps are better
  const days = data.daysSinceGap;
  if (days === 1) score += 15;
  else if (days === 2) score += 12;
  else if (days <= 3) score += 10;
  else if (days <= 5) score += 7;
  else if (days <= 7) score += 5;
  
  // Consolidation (0-15) - tight is good
  const cons = data.consolidation;
  if (cons < 5) score += 15;
  else if (cons < 8) score += 12;
  else if (cons < 10) score += 10;
  else if (cons < 15) score += 7;
  
  // Volume trend (0-15) - increasing volume = ready to move
  const vol = data.volumeTrend;
  if (vol > 50) score += 15;
  else if (vol > 20) score += 12;
  else if (vol > 0) score += 8;
  else if (vol > -10) score += 5;
  
  // Short interest (0-15)
  const si = data.shortInterest;
  if (si > 30) score += 15;
  else if (si > 20) score += 12;
  else if (si > 15) score += 10;
  else if (si > 10) score += 7;
  else if (si > 5) score += 5;
  
  // Gap size (0-10)
  const gap = Math.abs(data.gapDown);
  if (gap >= 5 && gap <= 8) score += 10;
  else if (gap >= 4 && gap <= 10) score += 7;
  else if (gap >= 3 && gap <= 12) score += 5;
  
  // Trend (0-15) - higher trend score = better
  const trend = data.trendScore || 50;
  if (trend >= 70) score += 15;
  else if (trend >= 60) score += 12;
  else if (trend >= 50) score += 10;
  else if (trend >= 40) score += 5;
  else if (trend >= 30) score += 0;
  else score -= 15; // Downtrend = bad
  
  return Math.min(score, 100);
}

// ============ OPTIONS ============

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

// ============ MAIN ============

async function main() {
  console.log('\n🎯 GAMMA SQUEEZE SCANNER V4 (Gap Fill Focus)');
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Scanning ${UNIQUE_STOCKS.length} stocks...\n`);
  
  // Step 1: Fetch all data
  console.log('📊 Step 1: Fetching quotes + history...');
  const stockData = [];
  
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
    
    if (history && history.gapDown <= -3 && history.gapDown >= -15) {
      stockData.push({
        symbol,
        price: quote?.price || history.currentPrice,
        volume: quote?.volume || 0,
        avgVolume: quote?.avgVolume || 0,
        ...history,
      });
    }
    
    await delay(200);
  }
  
  console.log(`\n\n✅ Found ${stockData.length} stocks with gap downs`);
  
  // Step 2: Filter gap down + consolidation
  console.log('\n📉 Step 2: Filtering...');
  const filtered = stockData.filter(s => 
    s.gapDown >= FILTERS.gapDownMin &&
    s.gapDown <= FILTERS.gapDownMax &&
    s.consolidation >= FILTERS.consolidationMin &&
    s.consolidation <= FILTERS.consolidationMax
  );
  
  console.log(`   ${filtered.length} with gap down 3-10% + tight consolidation`);
  
  // Step 3: Gap fill potential
  const gapFillReady = filtered.filter(s =>
    s.gapFillPct >= FILTERS.gapFillMin &&
    s.gapFillPct <= FILTERS.gapFillMax
  );
  
  console.log(`   ${gapFillReady.length} in gap fill zone (${FILTERS.gapFillMin}-${FILTERS.gapFillMax}% filled)`);
  
  // Step 4: Trend filter (must be uptrending or bottoming)
  const trendFiltered = gapFillReady.filter(s => s.trendScore >= FILTERS.trendMin);
  console.log(`   ${trendFiltered.length} passing trend filter (score >= ${FILTERS.trendMin})`);
  
  // Step 5: Add gamma variables
  const withGamma = trendFiltered.map(s => ({
    ...s,
    shortInterest: getShortInterest(s.symbol),
    float: getFloat(s.symbol),
  })).filter(s =>
    s.shortInterest >= FILTERS.shortInterestMin &&
    s.float <= FILTERS.floatMax &&
    s.price <= FILTERS.maxPrice &&
    s.volume >= FILTERS.volumeMin
  );
  
  console.log(`   ${withGamma.length} passing all filters`);
  
  // Step 5: Score
  const scored = withGamma.map(s => ({
    ...s,
    score: calculateScore(s),
    cheapOptions: findCheapOptions(s.price)
  })).filter(s => s.score >= FILTERS.scoreMin)
    .sort((a, b) => b.score - a.score);
  
  console.log(`   ${scored.length} with score >= ${FILTERS.scoreMin}`);
  
  // Results
  console.log('\n' + '='.repeat(65));
  console.log('🎯 TOP GAP FILL + GAMMA SQUEEZE CANDIDATES');
  console.log('='.repeat(65));
  
  if (scored.length === 0) {
    console.log('\n❌ No setups found');
  } else {
    scored.forEach((s, i) => {
      console.log(`\n#${i + 1} ${s.symbol} | Score: ${s.score}/100`);
      console.log(`   Price: $${s.price?.toFixed(2)} | Gap: ${s.gapDown?.toFixed(1)}% | Days: ${s.daysSinceGap}`);
      console.log(`   Gap Fill: ${s.gapFillPct?.toFixed(0)}% filled | Consolidation: ${s.consolidation?.toFixed(1)}%`);
      console.log(`   Volume Trend: ${s.volumeTrend?.toFixed(0)}% | Short: ${s.shortInterest}% | Float: ${(s.float/1e6).toFixed(1)}M`);
      
      if (s.cheapOptions?.length > 0) {
        console.log(`   Penny Options ($0.01-$0.10):`);
        s.cheapOptions.forEach(o => {
          console.log(`      ${o.type.toUpperCase()} $${o.strike} @ $${o.price} (${o.otm})`);
        });
      }
    });
  }
  
  console.log('\n' + '='.repeat(65));
  
  const filename = `gamma_scan_v4_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.json`;
  fs.writeFileSync(filename, JSON.stringify(scored, null, 2));
  console.log(`\n💾 Saved: ${filename}\n`);
  
  return scored;
}

main().catch(console.error);
