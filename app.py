from flask import Flask, render_template, request, jsonify, send_from_directory
import yfinance as yf
import pandas as pd
import os
from datetime import datetime

app = Flask(__name__, static_folder='static', template_folder='static')

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/api/calculate', methods=['POST'])
def calculate():
    try:
        data = request.get_json()
        ticker = data.get('ticker').upper()
        amount = float(data.get('amount'))
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        market = data.get('market', 'tw')  # Default to 'tw'

        if not ticker or not amount or not start_date or not end_date:
            return jsonify({'error': 'Missing required fields'}), 400

        # Handle Ticker Suffix based on Market
        if market == 'tw':
             if not ticker.endswith('.TW') and not ticker.endswith('.TWO'):
                 ticker = f"{ticker}.TW"
        elif market == 'crypto':
            if not ticker.endswith('-USD'):
                ticker = f"{ticker}-USD"
        # For US market, use ticker as is

        # Fetch data with dividends
        stock = yf.Ticker(ticker)
        hist = stock.history(start=start_date, end=end_date, interval="1mo", actions=True)

        if hist.empty:
            return jsonify({'error': 'No data found for this ticker and date range'}), 404

        # DCA Calculation
        portfolio = []
        total_invested = 0
        
        # Two portfolios: Price Return (No Div) and Total Return (With Div)
        total_shares_price = 0
        total_shares_drip = 0
        
        # Lump Sum Calculation (Total Return with Div Reinvestment)
        # We assume the total capital is available at the start.
        # Total Capital = Monthly Amount * Number of Periods
        total_periods = len(hist)
        lump_sum_capital = amount * total_periods
        
        # Buy all at start (using first row price)
        first_price = hist.iloc[0]['Close']
        lump_sum_shares = lump_sum_capital / first_price
        
        for date, row in hist.iterrows():
            price = row['Close']
            dividend = row.get('Dividends', 0)
            
            # Monthly Investment (DCA)
            shares_bought = amount / price
            total_invested += amount
            
            # 1. DCA Price Return (No Reinvestment)
            total_shares_price += shares_bought
            current_value_price = total_shares_price * price
            
            # 2. DCA Total Return (Dividend Reinvestment)
            if dividend > 0:
                # Reinvest for DCA
                payout_drip = total_shares_drip * dividend
                shares_from_div_drip = payout_drip / price
                total_shares_drip += shares_from_div_drip
                
                # Reinvest for Lump Sum
                payout_lump = lump_sum_shares * dividend
                shares_from_div_lump = payout_lump / price
                lump_sum_shares += shares_from_div_lump
            
            total_shares_drip += shares_bought
            current_value_drip = total_shares_drip * price
            
            # Lump Sum Value Update
            current_value_lump = lump_sum_shares * price
            
            average_cost = total_invested / total_shares_price if total_shares_price > 0 else 0
            
            portfolio.append({
                'date': date.strftime('%Y-%m-%d'),
                'price': round(price, 2),
                'total_invested': round(total_invested, 2),
                'portfolio_value': round(current_value_price, 2),
                'portfolio_value_drip': round(current_value_drip, 2),
                'lump_sum_value': round(current_value_lump, 2),
                'average_cost': round(average_cost, 2),
                'total_shares': round(total_shares_price, 2),
                'roi': round(((current_value_price - total_invested) / total_invested) * 100, 2) if total_invested > 0 else 0,
                'roi_drip': round(((current_value_drip - total_invested) / total_invested) * 100, 2) if total_invested > 0 else 0,
                'roi_lump': round(((current_value_lump - lump_sum_capital) / lump_sum_capital) * 100, 2)
            })

        summary = {
            'total_invested': round(total_invested, 2),
            'final_value_price': round(portfolio[-1]['portfolio_value'], 2) if portfolio else 0,
            'final_value_drip': round(portfolio[-1]['portfolio_value_drip'], 2) if portfolio else 0,
            'final_value_lump': round(portfolio[-1]['lump_sum_value'], 2) if portfolio else 0,
            'total_roi_price': round(portfolio[-1]['roi'], 2) if portfolio else 0,
            'total_roi_drip': round(portfolio[-1]['roi_drip'], 2) if portfolio else 0,
            'total_roi_lump': round(portfolio[-1]['roi_lump'], 2) if portfolio else 0,
            'currency': stock.info.get('currency', 'TWD')
        }

        return jsonify({
            'portfolio': portfolio,
            'summary': summary,
            'ticker': ticker
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/compare_trends', methods=['POST'])
def compare_trends():
    try:
        data = request.get_json()
        ticker1 = data.get('ticker1').upper()
        market1 = data.get('market1', 'tw')
        ticker2 = data.get('ticker2').upper()
        market2 = data.get('market2', 'tw')
        start_date = data.get('start_date')
        end_date = data.get('end_date')

        print(f"DEBUG: Received data: {data}")
        print(f"DEBUG: Ticker1: {ticker1}, Market1: {market1}")
        print(f"DEBUG: Ticker2: {ticker2}, Market2: {market2}")

        if not all([ticker1, ticker2, start_date, end_date]):
            return jsonify({'error': 'Missing required fields'}), 400

        def format_ticker(ticker, market):
            if market == 'tw':
                if not ticker.endswith('.TW') and not ticker.endswith('.TWO'):
                    return f"{ticker}.TW"
            elif market == 'crypto':
                if not ticker.endswith('-USD'):
                    return f"{ticker}-USD"
            return ticker

        t1 = format_ticker(ticker1, market1)
        t2 = format_ticker(ticker2, market2)

        # Fetch data
        stock1 = yf.Ticker(t1)
        hist1 = stock1.history(start=start_date, end=end_date, interval="1d") # Use daily for better correlation
        
        stock2 = yf.Ticker(t2)
        hist2 = stock2.history(start=start_date, end=end_date, interval="1d")

        if hist1.empty or hist2.empty:
            return jsonify({'error': 'No data found for one or both tickers'}), 404

        # Align data by date (inner join to compare same days)
        df1 = hist1[['Close']].rename(columns={'Close': 'Close1'})
        df2 = hist2[['Close']].rename(columns={'Close': 'Close2'})
        
        # Remove timezone info to ensure compatibility if mixed markets
        df1.index = df1.index.tz_localize(None)
        df2.index = df2.index.tz_localize(None)

        merged = pd.merge(df1, df2, left_index=True, right_index=True, how='inner')

        if merged.empty:
             return jsonify({'error': 'No overlapping dates found'}), 404

        # Calculate Correlation
        correlation = merged['Close1'].corr(merged['Close2'])

        # Calculate Normalized Performance (Percentage Change from Day 1)
        base_price1 = merged.iloc[0]['Close1']
        base_price2 = merged.iloc[0]['Close2']

        merged['PctChange1'] = ((merged['Close1'] - base_price1) / base_price1) * 100
        merged['PctChange2'] = ((merged['Close2'] - base_price2) / base_price2) * 100

        result_data = []
        for date, row in merged.iterrows():
            result_data.append({
                'date': date.strftime('%Y-%m-%d'),
                'price1': round(row['Close1'], 2),
                'price2': round(row['Close2'], 2),
                'pct1': round(row['PctChange1'], 2),
                'pct2': round(row['PctChange2'], 2)
            })

        return jsonify({
            'data': result_data,
            'correlation': round(correlation, 4),
            'ticker1': ticker1,
            'ticker2': ticker2
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500



if __name__ == '__main__':
    app.run(debug=True, port=5000)
