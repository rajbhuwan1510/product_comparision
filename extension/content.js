const STORE_ICONS = {
  amazon: "https://www.amazon.in/favicon.ico",
  flipkart: "https://www.flipkart.com/favicon.ico",
  croma: "https://www.croma.com/favicon.ico",
  reliance_digital: "https://www.reliancedigital.in/favicon.ico"
};

const STORE_NAMES = {
  amazon: "Amazon",
  flipkart: "Flipkart",
  croma: "Croma",
  reliance_digital: "Reliance Digital"
};

function extractTitle() {
  const host = window.location.hostname;
  let query = "";
  
  if (host.includes("amazon.in") || host.includes("amazon.com")) {
    const titleElem = document.getElementById("productTitle");
    let rawTitle = titleElem ? titleElem.innerText.trim() : "";
    
    let queryParts = [];
    
    // 1. Base Model is always before any |, -, (, or 'with'
    let segments = rawTitle.split(/\|| - /);
    let baseModel = segments[0].split(/\(| with | With | WITH /)[0].trim();
    queryParts.push(baseModel);

    // 2. Extract all Memory/Storage from the full title
    let memMatches = rawTitle.match(/\b\d+\s*(?:GB|TB)\b/gi);
    if (memMatches) {
        queryParts.push(memMatches.join(' '));
    }

    // 3. Extract Color
    let colorFound = false;
    const colors = ['black', 'white', 'blue', 'green', 'red', 'grey', 'gray', 'orange', 'silver', 'gold', 'purple', 'yellow', 'pink', 'lavender', 'titanium', 'graphite', 'cream', 'phantom', 'mint', 'cyan', 'magenta', 'violet', 'silk'];
    
    // Check inside parentheses first
    const parenMatch = rawTitle.match(/\(([^)]+)\)/);
    if (parenMatch) {
       const pparts = parenMatch[1].split(',');
       for (const p of pparts) {
          if (!p.toLowerCase().match(/gb|tb|ram|rom/)) {
             queryParts.push(p.replace(/[\(\)]/g, '').trim());
             colorFound = true;
          }
       }
    }
    
    // If no parentheses color, check the pipe/hyphen segments
    if (!colorFound) {
        for (let i = 1; i < segments.length; i++) {
            let seg = segments[i].toLowerCase();
            if (colors.some(c => seg.includes(c))) {
                if (!seg.includes("display") && !seg.includes("camera") && !seg.includes("battery") && !seg.includes("warranty")) {
                    queryParts.push(segments[i].replace(/[\(\)]/g, '').trim());
                }
            }
        }
    }

    query = queryParts.join(' ').replace(/\s+/g, ' ').trim();

  } else if (host.includes("flipkart.com")) {
    const titleElem = document.querySelector("h1") || document.querySelector(".VU-ZEz") || document.querySelector(".B_NuCI");
    if (titleElem) query = titleElem.innerText.trim();
  } else if (host.includes("croma.com")) {
    const titleElem = document.querySelector("h1.pd-title") || document.querySelector("h1");
    if (titleElem) query = titleElem.innerText.trim();
  } else if (host.includes("reliancedigital.in")) {
    const titleElem = document.querySelector("h1.pdp__title") || document.querySelector("h1");
    if (titleElem) query = titleElem.innerText.trim();
  }

  return query;
}

function injectFAB() {
  if (document.getElementById("sp-floating-btn")) return;

  const btn = document.createElement("div");
  btn.id = "sp-floating-btn";
  // SVG Icon
  btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>`;
  document.body.appendChild(btn);

  const widget = document.createElement("div");
  widget.id = "sp-widget-container";
  widget.innerHTML = `
    <div class="sp-header">
      <div class="sp-title">SmartPrice Matcher</div>
      <button class="sp-close" id="sp-close-btn">&times;</button>
    </div>
    <div class="sp-body">
      <div class="sp-detected-title" id="sp-detected-title">Detecting product...</div>
      <button class="sp-action-btn" id="sp-start-scan">Scan Other Stores</button>
      
      <div class="sp-loading" id="sp-loading">
        <div class="sp-spinner"></div>
        <div style="font-size: 12px; color: #a1a1aa;">Searching web...<br>Please wait up to 60 seconds.</div>
      </div>
      
      <div class="sp-error" id="sp-error"></div>
      <div class="sp-results" id="sp-results"></div>
    </div>
  `;
  document.body.appendChild(widget);

  let currentQuery = "";

  btn.addEventListener("click", () => {
    widget.classList.add("sp-open");
    currentQuery = extractTitle();
    document.getElementById("sp-detected-title").innerText = currentQuery || "Could not detect product title.";
    document.getElementById("sp-start-scan").disabled = !currentQuery;
  });

  document.getElementById("sp-close-btn").addEventListener("click", () => {
    widget.classList.remove("sp-open");
  });

  let keepAliveInterval;

  document.getElementById("sp-start-scan").addEventListener("click", () => {
    if (!currentQuery) return;
    
    document.getElementById("sp-start-scan").style.display = "none";
    document.getElementById("sp-loading").style.display = "block";
    document.getElementById("sp-error").style.display = "none";
    document.getElementById("sp-results").style.display = "none";

    // Keep service worker alive during long Selenium searches
    keepAliveInterval = setInterval(() => {
      chrome.runtime.sendMessage({ action: "ping" });
    }, 10000);

    chrome.runtime.sendMessage({ action: "searchProduct", query: currentQuery });
  });

  // Attach interval to window to access it in the message listener
  window.spKeepAliveInterval = () => {
      if (keepAliveInterval) clearInterval(keepAliveInterval);
  };
}

function renderResults(results) {
  const resultsDiv = document.getElementById("sp-results");
  let exactHtml = "";
  let variantHtml = "";

  for (const [storeId, links] of Object.entries(results)) {
    const iconUrl = STORE_ICONS[storeId];
    const storeName = STORE_NAMES[storeId];
    
    if (links.exact) {
      exactHtml += `
        <a href="${links.exact}" target="_blank" class="sp-store-card">
          <div class="sp-store-info">
            <img src="${iconUrl}" class="sp-store-icon">
            <span class="sp-store-name">${storeName}</span>
          </div>
          <span class="sp-view-btn">View Match</span>
        </a>
      `;
    } else if (links.variant) {
      variantHtml += `
        <a href="${links.variant}" target="_blank" class="sp-store-card" style="border-color: #52525b">
          <div class="sp-store-info">
            <img src="${iconUrl}" class="sp-store-icon">
            <span class="sp-store-name">${storeName}</span>
          </div>
          <span class="sp-view-btn" style="background: #52525b;">View Variant</span>
        </a>
      `;
    } else {
      exactHtml += `
        <div class="sp-store-card sp-not-found">
          <div class="sp-store-info">
            <img src="${iconUrl}" class="sp-store-icon">
            <span class="sp-store-name">${storeName}</span>
          </div>
          <span class="sp-view-btn">Unavailable</span>
        </div>
      `;
    }
  }

  let html = `<div style="font-size:12px; font-weight:bold; color:#a1a1aa; margin: 8px 0 4px;">Exact Matches</div>`;
  html += exactHtml;
  
  if (variantHtml) {
      html += `<div style="font-size:12px; font-weight:bold; color:#a1a1aa; margin: 12px 0 4px;">Other Variants (Diff RAM/Storage)</div>`;
      html += variantHtml;
  }

  resultsDiv.innerHTML = html;
  
  document.getElementById("sp-loading").style.display = "none";
  resultsDiv.style.display = "flex";
  
  const startBtn = document.getElementById("sp-start-scan");
  startBtn.style.display = "block";
  startBtn.innerText = "Search Again";
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "searchResults") {
    if (window.spKeepAliveInterval) window.spKeepAliveInterval();
    
    if (message.success) {
      renderResults(message.data.results);
    } else {
      document.getElementById("sp-loading").style.display = "none";
      document.getElementById("sp-start-scan").style.display = "block";
      const err = document.getElementById("sp-error");
      err.innerText = "Error fetching matches. Is local server running?";
      err.style.display = "block";
    }
  }
});

// Inject when page is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", injectFAB);
} else {
  injectFAB();
}
