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
        data = request.json
        ticker = data.get('ticker')
        amount = float(data.get('amount'))
        start_date = data.get('start_date')
        end_date = data.get('end_date')

        if not ticker or not amount or not start_date or not end_date:
            return jsonify({'error': 'Missing required fields'}), 400

        # Add .TW suffix if not present (simple heuristic for TW stocks)
        if not ticker.endswith('.TW') and not ticker.endswith('.TWO'):
             # Try .TW first, user can specify suffix if needed
             ticker = f"{ticker}.TW"

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
        
        for date, row in hist.iterrows():
            price = row['Close']
            dividend = row.get('Dividends', 0)
            
            # Monthly Investment
            shares_bought = amount / price
            total_invested += amount
            
            # 1. Price Return (No Reinvestment)
            total_shares_price += shares_bought
            current_value_price = total_shares_price * price
            
            # 2. Total Return (Dividend Reinvestment)
            # Reinvest dividends if any
            if dividend > 0:
                payout = total_shares_drip * dividend
                shares_from_div = payout / price
                total_shares_drip += shares_from_div
            
            total_shares_drip += shares_bought
            current_value_drip = total_shares_drip * price
            
            average_cost = total_invested / total_shares_price if total_shares_price > 0 else 0
            
            portfolio.append({
                'date': date.strftime('%Y-%m-%d'),
                'price': round(price, 2),
                'total_invested': round(total_invested, 2),
                'portfolio_value': round(current_value_price, 2),
                'portfolio_value_drip': round(current_value_drip, 2),
                'average_cost': round(average_cost, 2),
                'total_shares': round(total_shares_price, 2),
                'roi': round(((current_value_price - total_invested) / total_invested) * 100, 2) if total_invested > 0 else 0,
                'roi_drip': round(((current_value_drip - total_invested) / total_invested) * 100, 2) if total_invested > 0 else 0
            })

        summary = {
            'total_invested': round(total_invested, 2),
            'final_value_price': round(portfolio[-1]['portfolio_value'], 2) if portfolio else 0,
            'final_value_drip': round(portfolio[-1]['portfolio_value_drip'], 2) if portfolio else 0,
            'total_roi_price': round(portfolio[-1]['roi'], 2) if portfolio else 0,
            'total_roi_drip': round(portfolio[-1]['roi_drip'], 2) if portfolio else 0,
            'currency': stock.info.get('currency', 'TWD')
        }

        return jsonify({
            'portfolio': portfolio,
            'summary': summary,
            'ticker': ticker
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=8080)
