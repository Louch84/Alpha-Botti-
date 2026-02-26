# Data Sources Research

## Short Interest Data

| Source | Type | Cost | Status |
|--------|------|------|--------|
| FINVIZ | Screener/API | Free (limited) | ✅ Works (scraping blocked) |
| Yahoo Finance | API | Free | ✅ Chart works, quote blocked |
| NASDAQ | Website | Free | ⚠️ Blocked |
| Ortex | API | Paid | ❌ Login required |
| ShortSqueeze.com | Website | Free | ⚠️ Blocked |
| StockAnalysis.com | Website | Free | ⚠️ Blocked |
| Alpha Vantage | API | Free tier | Requires API key |
| Polygon.io | API | Free tier | Requires API key |

### Recommendation
- **FINVIZ** is best bet - can scrape their screener
- **Hardcoded list** works for now - update periodically
- **API key** needed for real-time (Alpha Vantage, Polygon)

---

## Options Data

| Source | Type | Cost | Status |
|--------|------|------|--------|
| Yahoo Finance | API | Free | ✅ Chart works, options blocked |
| CBOE | Website | Free | ⚠️ JS-rendered, hard to scrape |
| Barchart | Website | Free | ⚠️ JS-rendered |
| Barchart API | API | Paid | Requires key |
| CBOE API | API | Paid | Requires key |
| Twelve Data | API | Free tier | Requires API key |

### Recommendation
- **Yahoo chart** gives some data but not options chains
- **Puppeteer** could render JS pages but heavy
- **API key** needed for clean options data

---

## Action Items

### Option 1: Keep Hardcoded (Current)
- Update KNOWN_DATA periodically
- Works but needs manual updates

### Option 2: Get Free API Key
- **Alpha Vantage**: Free 25 requests/day
- **Polygon.io**: Free 5 calls/minute
- **Twelve Data**: Free 800 calls/day
- Would need to register at their website

### Option 3: Build Scraper
- Use Puppeteer to render JS pages
- Parse CBOE/Barchart dynamically
- More complex but free

---

## Current Status
- Price data: ✅ Yahoo Finance (chart endpoint)
- Short interest: ⚠️ Hardcoded only
- Options data: ⚠️ Estimated only

---

## Next Steps
1. User could get free API key (Alpha Vantage recommended)
2. Or we build periodic manual update process
3. Or we invest in better scraping infrastructure
