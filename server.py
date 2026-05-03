from flask import Flask, request, jsonify
from flask_cors import CORS
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
import match  # Import our existing matching logic

app = Flask(__name__)
CORS(app)  # Allow Chrome Extension to hit this API

@app.route('/search', methods=['POST'])
def search():
    data = request.json
    if not data or 'query' not in data:
        return jsonify({"error": "Missing 'query' in request body"}), 400
        
    raw_query = data['query']
    print(f"\n[SERVER] Received query from extension: {raw_query}")
    
    # 1. Use the NLP extractor from match.py
    details = match.extract_details(raw_query)
    
    print(f"[SERVER] Searching for: {raw_query}")

    # 3. Spin up stealth Selenium
    options = Options()
    options.add_argument("--window-size=1280,800")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option('useAutomationExtension', False)
    
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    driver.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument', {
        'source': 'Object.defineProperty(navigator, "webdriver", {get: () => undefined})'
    })

    # 4. Search across platforms
    results = {
        "amazon": match.search_amazon(driver, raw_query, details),
        "flipkart": match.search_flipkart(driver, raw_query, details),
        "croma": match.search_croma(driver, raw_query, details),
        "reliance_digital": match.search_reliance(driver, raw_query, details)
    }

    driver.quit()

    output = {
        "input_product": details,
        "results": results
    }
    
    print("[SERVER] Finished searching! Sending results to extension.")
    return jsonify(output)

if __name__ == '__main__':
    print("Starting Product Matching Server on http://localhost:5000...")
    app.run(port=5000, debug=True)
