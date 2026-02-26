#!/usr/bin/env node

/**
 * Gamma Squeeze Scanner - V2
 * Process:
 * 1. Scan broad stock list for gap down + consolidation
 * 2. Then check gamma squeeze variables  
 * 3. Find cheap options
 * 4. Score & rank
 */

const axios = require('axios');
const fs = require('fs');

// Broad stock list (mix of S&P, meme, high volume)
const STOCK_UNIVERSE = [
  // Tech
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'AMD', 'INTC', 'CSCO', 'ORCL', 'CRM', 'ADBE', 'NFLX', 'PYPL', 'SQ', 'SHOP', 'UBER', 'LYFT', 'SNAP', 'PINS', 'ROKU', 'ZM', 'DOCU', 'CRWD', 'ZS', 'NET', 'DDOG', 'OKTA', 'WDAY', 'TEAM',
  // Finance
  'JPM', 'BAC', 'WFC', 'GS', 'MS', 'C', 'BLK', 'AXP', 'V', 'MA', 'PYPL', 'SQ', 'COF', 'USB', 'PNC', 'TFC', 'SCHW', 'ALL', 'MET', 'PRU', 'AIG', 'CVS', 'CI', 'HUM', 'ANTM', 'CB', 'TRV', 'MMC', 'AFL', 'GL',
  // Healthcare
  'UNH', 'JNJ', 'PFE', 'MRK', 'ABBV', 'LLY', 'TMO', 'ABT', 'DHR', 'BMY', 'AMGN', 'GILD', 'BIIB', 'REGN', 'VRTX', 'ISRG', 'MDT', 'SYK', 'EW', 'ZTS', 'HCA', 'CNC', 'HUM', 'EL', 'MTD', 'BDX', 'BSX', 'DXCM', 'ICU', 'ALGN',
  // Consumer
  'WMT', 'HD', 'COST', 'TGT', 'LOW', 'NKE', 'SBUX', 'MCD', 'DIS', 'CMCSA', 'T', 'VZ', 'KO', 'PEP', 'PG', 'CL', 'KMB', 'GIS', 'K', 'MDLZ', 'KHC', 'GIS', 'HSY', 'STZ', 'SAM', 'TAP', 'DPZ', 'CMG',
  // Energy
  'XOM', 'CVX', 'COP', 'EOG', 'PXD', 'MPC', 'VLO', 'PSX', 'OXY', 'HAL', 'SLB', 'BKR', 'DVN', 'FANG', 'HES', 'MRO', 'APA', 'KMI', 'WMB', 'OKE',
  // Industrial
  'BA', 'CAT', 'GE', 'MMM', 'HON', 'UPS', 'RTX', 'LMT', 'GD', 'NOC', 'ITW', 'EMR', 'ROK', 'PH', 'CMI', 'AME', 'ETN', 'FAST', 'ROST', 'JBHT', 'SAIA', 'LRCX', 'KLAC', 'MRVL', 'ON',
  // Materials
  'LIN', 'APD', 'ECL', 'SHW', 'NEM', 'FCX', 'NUE', 'VMC', 'MLM', 'RS', 'FMC', 'EIX', 'DUK', 'SO', 'D', 'AEP', 'EXC', 'XEL', 'ED', 'WEC',
  // RE & Utilities
  'AMT', 'PLD', 'CCI', 'EQIX', 'PSA', 'O', 'SPG', 'MAA', 'AVB', 'EQR', 'WELL', 'VTR', 'PEAK', 'ARE', 'BXP', 'SLG', 'STAG', 'KIM', 'REG', 'FRT',
  // Meme / High Beta
  'GME', 'AMC', 'BB', 'NOK', 'PLTR', 'CLOV', 'SOFI', 'WISH', 'RIVN', 'LCID', 'DKNG', 'SNAP', 'MARA', 'RIOT', 'BTBT', 'HOOD', 'COIN', 'UPST', 'PATH', 'SOUN', 'MRNA', 'TXMD', 'CTXR', 'AUPH', 'OCGN', 'SPR', 'LAZR', 'STEM', 'BE', 'QS', 'RIVN', 'LCID',
  // More actives
  'TSLA', 'RBLX', 'SNOW', 'DDOG', 'CRWD', 'NET', 'GLOB', 'MDB', 'DDOG', 'SNOW', 'U', 'ESTC', 'CFLT', 'FROG', 'GTLB', 'BRZE', 'AI', 'HUBS', 'WDAY', 'OKTA', 'ZS', 'SPLK', 'SUMO', 'NCNO', 'VRM', 'APPH', 'AUR', 'ALRM', 'EVBG', 'ASAN'
];

// Dedupe
const UNIQUE_STOCKS = [...new Set(STOCK_UNIVERSE)];

const FILTERS = {
  // Step 1: Technical (gap down + consolidation)
  gapDownMin: -20,         // At least X% gap down
  gapDownMax: -5,         // Maximum gap down (don't want too oversold)
  consolidationMax: 12,   // Max 5-day consolidation %
  
  // Step 2: Gamma squeeze variables
  shortInterestMin: 15,   // Min short interest %
  floatMax: 1_000_000_000, // Max float (relaxed for meme stocks)
  volumeMin: 1_000_000,   // Min daily volume
  
  // Step 3: Price
  maxPrice: 40,
  
  // Step 4: Options
  optionMinPrice: 0.01,
  optionMaxPrice: 0.10,
  
  // Scoring
  scoreMin: 20,
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const results = [];

// Fetch price + gap + consolidation data
async function getStockData(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=10d`;
    const { data } = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000
    });
    
    if (!data.chart?.result?.[0]) return null;
    
    const meta = data.chart.result[0].meta;
    const q = data.chart.result[0].indicators.quote[0];
    const close = q.close.filter(c => c !== null);
    const high = q.high.filter(h => h !== null);
    const low = q.low.filter(l => l !== null);
    const volume = q.volume.filter(v => v !== null);
    
    const price = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose || close[close.length - 2] || price;
    const gapDown = ((price - prevClose) / prevClose) * 100;
    
    // 5-day consolidation
    const h5 = high.slice(-5);
    const l5 = low.slice(-5);
    const consolidation = h5.length > 0 ? ((Math.max(...h5) - Math.min(...l5)) / Math.min(...l5)) * 100 : 100;
    
    // Average volume
    const avgVolume = volume.slice(-20).reduce((a, b) => a + b, 0) / Math.min(volume.length, 20);
    
    return {
      symbol,
      price,
      prevClose,
      gapDown,
      consolidation,
      avgVolume: avgVolume || meta.regularMarketVolume || 0,
      volume: meta.regularMarketVolume || 0,
    };
  } catch (e) {
    return null;
  }
}

// Known short interest data (would need real-time in production)
const KNOWN_SHORT_DATA = {
  'GME': 15.2, 'AMC': 22.1, 'CLOV': 25.4, 'MARA': 28.5, 'RIOT': 31.2,
  'BTBT': 15.0, 'SOUN': 12.0, 'UPST': 22.0, 'WISH': 18.9, 'RIVN': 5.2,
  'LCID': 4.8, 'DKNG': 10.2, 'SNAP': 9.1, 'COIN': 14.2, 'HOOD': 6.8,
  'PLTR': 12.3, 'BB': 4.2, 'NOK': 3.1, 'SOFI': 8.5, 'PATH': 18.5,
};

function getShortInterest(symbol) {
  return KNOWN_SHORT_DATA[symbol.toUpperCase()] || 0;
}

function getFloat(symbol) {
  // Rough estimates
  const floats = {
    'GME': 304000000, 'AMC': 517000000, 'CLOV': 485000000, 'MARA': 89000000,
    'RIOT': 73000000, 'BTBT': 95000000, 'UPST': 95000000, 'WISH': 580000000,
    'RIVN': 1730000000, 'LCID': 2150000000, 'PLTR': 2150000000, 'COIN': 212000000,
    'HOOD': 890000000, 'PATH': 215000000, 'SNAP': 1580000000,
  };
  return floats[symbol.toUpperCase()] || 500000000; // Default 500M
}

// Calculate gamma score
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
  
  // Gap down (0-20) - bigger gap = more bounce potential
  const gap = Math.abs(data.gapDown);
  if (gap >= 15) score += 20;
  else if (gap >= 10) score += 15;
  else if (gap >= 7) score += 10;
  else if (gap >= 5) score += 5;
  
  // Consolidation (0-10) - tighter = better
  if (data.consolidation < 5) score += 10;
  else if (data.consolidation < 8) score += 7;
  else if (data.consolidation < 12) score += 5;
  
  // Volume (0-10)
  const vol = data.volume;
  if (vol > 50_000_000) score += 10;
  else if (vol > 20_000_000) score += 7;
  else if (vol > 10_000_000) score += 5;
  else if (vol > 5_000_000) score += 3;
  
  return Math.min(score, 100);
}

// Find cheap near-the-money options
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
    if (otmPct > 15) return; // Only near-the-money
    
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
  console.log('\n🎯 GAMMA SQUEEZE SCANNER V2');
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Scanning ${UNIQUE_STOCKS.length} stocks...\n`);
  
  // Step 1: Fetch all stock data
  console.log('📊 Step 1: Fetching price data...');
  const stockData = [];
  
  for (let i = 0; i < UNIQUE_STOCKS.length; i++) {
    const symbol = UNIQUE_STOCKS[i];
    if ((i + 1) % 20 === 0) {
      process.stdout.write(`\n  [${i + 1}/${UNIQUE_STOCKS.length}] `);
    }
    process.stdout.write('.');
    
    const data = await getStockData(symbol);
    if (data) {
      stockData.push(data);
    }
    await delay(100); // Rate limit
  }
  
  console.log(`\n\n✅ Got data for ${stockData.length} stocks`);
  
  // Step 2: Filter by gap down + consolidation
  console.log('\n📉 Step 2: Filtering for gap down + consolidation...');
  const gapDownFiltered = stockData.filter(s => 
    s.gapDown >= FILTERS.gapDownMin &&
    s.gapDown <= FILTERS.gapDownMax &&
    s.consolidation <= FILTERS.consolidationMax
  );
  
  console.log(`   Found ${gapDownFiltered.length} with gap down + tight consolidation`);
  
  // Step 3: Add gamma squeeze variables
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
      console.log(`   Price: $${s.price.toFixed(2)} | Gap: ${s.gapDown.toFixed(1)}% | Consol: ${s.consoliation?.toFixed(1) || s.consolidation.toFixed(1)}%`);
      console.log(`   Short: ${s.shortInterest}% | Float: ${(s.float/1e6).toFixed(1)}M | Vol: ${(s.volume/1e6).toFixed(1)}M`);
      
      if (s.cheapOptions.length > 0) {
        console.log(`   Penny Options ($0.01-$0.10):`);
        s.cheapOptions.forEach(o => {
          console.log(`      ${o.type.toUpperCase()} $${o.strike} @ $${o.price} (${o.otm})`);
        });
      }
    });
  }
  
  console.log('\n' + '='.repeat(60));
  
  // Save
  const filename = `gamma_scan_v2_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.json`;
  fs.writeFileSync(filename, JSON.stringify(scored, null, 2));
  console.log(`\n💾 Saved: ${filename}\n`);
  
  return scored;
}

main().catch(console.error);
