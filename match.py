import sys
import json
import urllib.parse
import re
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

def extract_details(raw_query):
    brands = ['apple', 'samsung', 'vivo', 'oppo', 'oneplus', 'xiaomi', 'redmi', 'realme', 'poco', 'motorola', 'google', 'nothing', 'iqoo', 'asus', 'nokia']
    base_colors = ['black', 'white', 'blue', 'green', 'red', 'grey', 'gray', 'orange', 'silver', 'gold', 'purple', 'yellow', 'pink', 'lavender', 'titanium', 'graphite', 'cream', 'phantom', 'mint', 'cyan', 'magenta', 'violet']
    
    details = {'brand': '', 'model': '', 'ram': '', 'storage': '', 'color': ''}
    
    gb_matches = list(re.finditer(r'\b(\d+)\s*(GB|TB|MB)\b', raw_query, re.IGNORECASE))
    gb_values = []
    
    temp_query = raw_query
    for m in reversed(gb_matches):
        val = int(m.group(1))
        unit = m.group(2).upper()
        sort_val = val * 1024 if unit == 'TB' else (val / 1024 if unit == 'MB' else val)
        gb_values.append({'str': f"{val}{unit}", 'sort_val': sort_val})
        temp_query = temp_query[:m.start()] + " " + temp_query[m.end():]
        
    gb_values.sort(key=lambda x: x['sort_val'])
    
    if len(gb_values) >= 2:
        details['ram'] = gb_values[0]['str']
        details['storage'] = gb_values[-1]['str']
    elif len(gb_values) == 1:
        if 'ram' in raw_query.lower():
            details['ram'] = gb_values[0]['str']
        else:
            details['storage'] = gb_values[0]['str']
            
    temp_query = re.sub(r'\b(RAM|ROM|Storage|Memory)\b', ' ', temp_query, flags=re.IGNORECASE)
    
    words = temp_query.split()
    for word in words:
        clean_word = re.sub(r'[^a-zA-Z0-9]', '', word).lower()
        if clean_word in brands:
            details['brand'] = clean_word.capitalize()
            temp_query = re.sub(r'\b' + re.escape(word) + r'\b', ' ', temp_query, flags=re.IGNORECASE)
            break
            
    if not details['brand'] and words:
        details['brand'] = re.sub(r'[^a-zA-Z0-9]', '', words[0])
        temp_query = temp_query.replace(words[0], ' ', 1)

    paren_match = re.search(r'\((.*?)\)', temp_query)
    found_color = ''
    if paren_match:
        c_text = paren_match.group(1)
        c_text = re.sub(r'[^a-zA-Z0-9\s-]', ' ', c_text)
        found_color = ' '.join(c_text.split())
        temp_query = temp_query[:paren_match.start()] + " " + temp_query[paren_match.end():]
    else:
        parts = [p.strip() for p in temp_query.split(',')]
        if len(parts) > 1:
            for part in parts:
                if any(bc in part.lower() for bc in base_colors):
                    found_color = part
                    temp_query = temp_query.replace(part, ' ')
                    temp_query = temp_query.replace(',', ' ')
                    break
        
        if not found_color:
            words2 = temp_query.split()
            for i, w in enumerate(words2):
                if w.lower() in base_colors:
                    if i > 0 and len(words2[i-1]) > 2:
                        found_color = words2[i-1] + ' ' + w
                    else:
                        found_color = w
                    temp_query = temp_query.replace(found_color, ' ')
                    break
                    
    details['color'] = found_color.strip(' ,')

    temp_query = re.sub(r'[,\(\)]', ' ', temp_query)
    details['model'] = ' '.join(temp_query.split())
    
    return details

def is_strict_match(title_text, details):
    if not title_text: return False
    text = title_text.lower().replace(" ", "")
    
    if details['brand'] and details['brand'].lower().replace(" ", "") not in text:
        return False
        
    if details['model']:
        for word in details['model'].lower().split():
            if word not in text:
                return False
                
    if details['ram'] and details['ram'].lower() not in text:
        return False
        
    if details['storage'] and details['storage'].lower() not in text:
        return False
        
    return True

def search_amazon(driver, query, details):
    try:
        url = f"https://www.amazon.in/s?k={urllib.parse.quote(query)}"
        driver.get(url)
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, 'div[data-component-type="s-search-result"]'))
        )
        for result in driver.find_elements(By.CSS_SELECTOR, 'div[data-component-type="s-search-result"]')[:5]:
            try:
                # The result.text contains the brand (which Amazon often puts in a separate h2) and the full title
                if is_strict_match(result.text, details):
                    # Once we verify it's a strict match, find the actual product link within this result container
                    elem = result.find_element(By.CSS_SELECTOR, 'a.a-link-normal[href*="/dp/"]')
                    return elem.get_attribute('href').split('?')[0]
            except: continue
    except: pass
    return "Not Found"

def search_flipkart(driver, query, details):
    try:
        url = f"https://www.flipkart.com/search?q={urllib.parse.quote(query)}"
        driver.get(url)
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, 'a[target="_blank"]'))
        )
        for result in driver.find_elements(By.CSS_SELECTOR, 'a[target="_blank"]')[:10]:
            try:
                if is_strict_match(result.text, details):
                    return result.get_attribute('href').split('?')[0]
            except: continue
    except: pass
    return "Not Found"

def search_croma(driver, query, details):
    try:
        url = f"https://www.croma.com/searchB?q={urllib.parse.quote(query)}%3Arelevance"
        driver.get(url)
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, '.product-title a, h3.product-title a'))
        )
        for result in driver.find_elements(By.CSS_SELECTOR, '.product-title a, h3.product-title a')[:5]:
            try:
                if is_strict_match(result.text, details):
                    return result.get_attribute('href').split('?')[0]
            except: continue
    except: pass
    return "Not Found"

def search_reliance(driver, query, details):
    try:
        # Build strict query for Reliance Digital since it ignores broad queries easily
        rd_query = f"{details['brand']} {details['model']} {details['storage']}"
        url = f"https://www.reliancedigital.in/products?q={urllib.parse.quote(rd_query)}"
        driver.get(url)
        WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, 'a[href*="/product/"]'))
        )
        for result in driver.find_elements(By.CSS_SELECTOR, 'a[href*="/product/"]')[:5]:
            try:
                if is_strict_match(result.text, details):
                    return result.get_attribute('href').split('?')[0]
            except: continue
    except: pass
    return "Not Found"

def main():
    if len(sys.argv) < 2:
        print("Please provide a product query.")
        print("Example: python match.py \"vivo T5X 5G (Cyber Green, 8GB RAM, 128GB Storage)\"")
        sys.exit(1)
        
    raw_query = " ".join(sys.argv[1:])
    details = extract_details(raw_query)
    
    print(f"\n[1] Extracting Details from query: '{raw_query}'")
    print(f"    => Brand:   {details['brand'] or 'N/A'}")
    print(f"    => Model:   {details['model'] or 'N/A'}")
    print(f"    => RAM:     {details['ram'] or 'N/A'}")
    print(f"    => Storage: {details['storage'] or 'N/A'}")
    print(f"    => Color:   {details['color'] or 'N/A'}")
    
    query = f"{details['brand']} {details['model']} {details['ram']} {details['storage']} {details['color']}".strip()
    print(f"\n[2] Launching stealth browser to search for matches...")
    
    options = Options()
    options.add_argument("--window-size=1280,800")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option('useAutomationExtension', False)
    
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")

    results = {
        "amazon": search_amazon(driver, query, details),
        "flipkart": search_flipkart(driver, query, details),
        "croma": search_croma(driver, query, details),
        "reliance_digital": search_reliance(driver, query, details)
    }

    driver.quit()

    output = {
        "input_product": details,
        "results": results
    }

    print("\n--- SCRAPING COMPLETE ---\n")
    print(json.dumps(output, indent=2))

if __name__ == "__main__":
    main()
