# E-Commerce Product Matching Agent

A Python-based standalone CLI tool that takes a product query (e.g., a smartphone model with specs) and automatically finds the exact product links across four major e-commerce platforms: **Amazon India, Flipkart, Croma, and Reliance Digital**.

## 🚀 How It Works

E-commerce websites like Amazon and Reliance Digital employ aggressive bot-protection systems that block standard HTTP requests (like `axios`, `fetch`, or `requests`) by serving CAPTCHAs or "Not Found" pages.

To bypass these protections and accurately extract the first valid product link, this script uses **Selenium WebDriver**. 
1. **Stealth Browser**: It automatically spins up a real Google Chrome instance configured with stealth parameters (e.g., `--disable-blink-features=AutomationControlled`) to evade basic bot detection.
2. **Parallel Searching**: It takes your natural language query, formats it into platform-specific URLs (e.g., Reliance Digital uses `/products?q=`), and navigates to them.
3. **Smart Extraction**: It waits up to 15 seconds for the actual product DOM elements to render and uses highly specific CSS selectors (e.g., Amazon's `a.a-link-normal[href*="/dp/"]`) to grab the exact product URL.
4. **Structured Output**: It compiles all found links and outputs them in a clean JSON format. If a link isn't found or times out, it gracefully falls back to `"Not Found"`.

## 📋 Prerequisites

- **Python 3.x**
- **Google Chrome Browser** installed on your system.

## 🛠️ Installation

1. Navigate to the project directory.
2. Install the required Python dependencies:

```bash
pip install selenium webdriver-manager
```

## 💻 Usage

Run the script from your terminal by simply passing the raw product title. The script uses an internal NLP-like regex engine to automatically extract the `brand`, `model`, `ram`, `storage`, and `color`. 

It will strictly match the **Brand, Model, RAM, and Storage** on the search pages. Color is included in the search query to prefer the correct variant but is ignored during strict validation (so it will still return a match if only a different color is available).

```bash
python match.py "vivo T5X 5G (Cyber Green, 8GB RAM, 128GB Storage)"
```

### Example Output

```json
{
  "input_product": {
    "brand": "vivo",
    "model": "T5X 5G",
    "ram": "8GB",
    "storage": "128GB",
    "color": "Cyber Green"
  },
  "results": {
    "amazon": "https://www.amazon.in/iPhone-Pro-256-Promotion-Breakthrough/dp/B0FQG1LPVF/ref=sr_1_3",
    "flipkart": "https://www.flipkart.com/apple-iphone-17-pro-cosmic-orange-256-gb/p/itm76fe37ca9ea8c",
    "croma": "https://www.croma.com/apple-iphone-17-pro-max-256gb-cosmic-orange-/p/317434",
    "reliance_digital": "https://www.reliancedigital.in/product/apple-iphone-17-pro-256-gb-cosmic-orange-mff5yc-9388032"
  }
}
```

## 🔍 Supported Platforms & Selectors
- **Amazon India**: Uses `a.a-link-normal[href*="/dp/"]` to bypass various Amazon UI containers and find the exact product.
- **Flipkart**: Targets `a[target="_blank"]`.
- **Croma**: Targets `.product-title a` and `h3.product-title a`.
- **Reliance Digital**: Uses `/products?q=` routing and targets `a[href*="/product/"]`.

*Note: E-commerce platforms frequently update their layouts and DOM structures. If a platform starts returning "Not Found", the CSS selector in `match.py` for that specific platform may need to be updated.*
