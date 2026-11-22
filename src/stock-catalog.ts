const groups = {
  Technology: [
    ['AAPL','Apple'],['MSFT','Microsoft'],['NVDA','Nvidia'],['AMD','Advanced Micro Devices'],
    ['AVGO','Broadcom'],['ORCL','Oracle'],['CRM','Salesforce'],['ADBE','Adobe'],
    ['INTC','Intel'],['CSCO','Cisco'],['QCOM','Qualcomm'],['IBM','IBM'],
    ['NOW','ServiceNow'],['INTU','Intuit'],['TXN','Texas Instruments'],['MU','Micron Technology'],
    ['AMAT','Applied Materials'],['PLTR','Palantir'],
  ],
  Communications: [
    ['GOOGL','Alphabet'],['META','Meta Platforms'],['NFLX','Netflix'],['DIS','Walt Disney'],
    ['CMCSA','Comcast'],['T','AT&T'],['VZ','Verizon'],['TMUS','T-Mobile US'],
  ],
  'Consumer discretionary': [
    ['AMZN','Amazon'],['TSLA','Tesla'],['HD','Home Depot'],['LOW','Lowe’s'],
    ['MCD','McDonald’s'],['SBUX','Starbucks'],['NKE','Nike'],['GM','General Motors'],
    ['F','Ford Motor'],['BKNG','Booking Holdings'],['TJX','TJX Companies'],['RCL','Royal Caribbean'],
  ],
  'Consumer staples': [
    ['WMT','Walmart'],['COST','Costco'],['PG','Procter & Gamble'],['KO','Coca-Cola'],
    ['PEP','PepsiCo'],['PM','Philip Morris International'],['MDLZ','Mondelez International'],
    ['CL','Colgate-Palmolive'],['KMB','Kimberly-Clark'],
  ],
  Financials: [
    ['JPM','JPMorgan Chase'],['BAC','Bank of America'],['WFC','Wells Fargo'],['C','Citigroup'],
    ['GS','Goldman Sachs'],['MS','Morgan Stanley'],['V','Visa'],['MA','Mastercard'],
    ['BRK.B','Berkshire Hathaway'],['SCHW','Charles Schwab'],['BLK','BlackRock'],['AXP','American Express'],
  ],
  Healthcare: [
    ['JNJ','Johnson & Johnson'],['UNH','UnitedHealth'],['LLY','Eli Lilly'],['ABBV','AbbVie'],
    ['MRK','Merck'],['PFE','Pfizer'],['AMGN','Amgen'],['TMO','Thermo Fisher Scientific'],
    ['ABT','Abbott Laboratories'],['ISRG','Intuitive Surgical'],['GILD','Gilead Sciences'],['MDT','Medtronic'],
  ],
  Industrials: [
    ['CAT','Caterpillar'],['DE','Deere & Company'],['GE','GE Aerospace'],['RTX','RTX'],
    ['HON','Honeywell'],['UNP','Union Pacific'],['UPS','UPS'],['LMT','Lockheed Martin'],
    ['ETN','Eaton'],['BA','Boeing'],['WM','Waste Management'],
  ],
  Energy: [
    ['XOM','Exxon Mobil'],['CVX','Chevron'],['COP','ConocoPhillips'],['SLB','SLB'],
    ['EOG','EOG Resources'],['OXY','Occidental Petroleum'],['MPC','Marathon Petroleum'],
  ],
  Utilities: [
    ['NEE','NextEra Energy'],['DUK','Duke Energy'],['SO','Southern Company'],
    ['AEP','American Electric Power'],['EXC','Exelon'],
  ],
  Materials: [['LIN','Linde'],['APD','Air Products'],['FCX','Freeport-McMoRan']],
  'Real estate': [['PLD','Prologis'],['AMT','American Tower'],['O','Realty Income']],
} as const

export const SECTORS=Object.keys(groups)
export const STOCKS=Object.entries(groups).flatMap(([sector,stocks])=>stocks.map(([symbol,name])=>({symbol,name,sector})))
export const STOCK_SYMBOLS=new Set<string>(STOCKS.map(stock=>stock.symbol))
