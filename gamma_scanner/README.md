# Gamma Squeeze Scanner

Finds gap-down + tight consolidation stocks with gamma squeeze potential.

## Process

1. **Scan** - Broad stock universe (250+ stocks)
2. **Filter** - Gap down (5-20%) + tight consolidation (<12%)
3. **Check** - Short interest (>15%), float, volume, price
4. **Score** - Rank by gamma squeeze potential
5. **Options** - Find penny options ($0.01-$0.10)

## Run

```bash
cd ~/openclaw/workspace/gamma_scanner
node scanner_v2.js
```

## Latest Result

- AMC: 47/100 score
- Gap: -12.8%
- Short: 22.1%
- Penny PUT $1 @ $0.10

## Files

- `scanner_v2.js` - Main scanner
- `gamma_scan_v2_*.json` - Latest results
- `package.json` - Dependencies (axios)
