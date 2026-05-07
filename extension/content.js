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

// --- ATTRIBUTE EXTRACTION LOGIC ---
function extractAttributes(title) {
  const brands = ['apple', 'samsung', 'vivo', 'oppo', 'oneplus', 'xiaomi', 'redmi', 'realme', 'poco', 'motorola', 'google', 'nothing', 'iqoo', 'asus', 'nokia'];
  const baseColors = ['black', 'white', 'blue', 'green', 'red', 'grey', 'gray', 'orange', 'silver', 'gold', 'purple', 'yellow', 'pink', 'lavender', 'titanium', 'graphite', 'cream', 'phantom', 'mint', 'cyan', 'magenta', 'violet'];
  
  const details = { brand: '', model: '', ram: '', storage: '', color: '' };
  const rawQuery = title.toLowerCase();
  
  // 1. Extract RAM and Storage
  const gbMatches = [...rawQuery.matchAll(/\b(\d+)\s*(GB|TB|MB)\b/gi)];
  const gbValues = gbMatches.map(m => {
    const val = parseInt(m[1]);
    const unit = m[2].toUpperCase();
    let sortVal = val;
    if (unit === 'TB') sortVal = val * 1024;
    if (unit === 'MB') sortVal = val / 1024;
    return { str: `${val}${unit}`, sortVal };
  }).sort((a, b) => a.sortVal - b.sortVal);

  if (gbValues.length >= 2) {
    details.ram = gbValues[0].str;
    details.storage = gbValues[gbValues.length - 1].str;
  } else if (gbValues.length === 1) {
    if (rawQuery.includes('ram')) details.ram = gbValues[0].str;
    else details.storage = gbValues[0].str;
  }

  // 2. Extract Brand
  for (const b of brands) {
    if (rawQuery.includes(b)) {
      details.brand = b.charAt(0).toUpperCase() + b.slice(1);
      break;
    }
  }

  // 3. Extract Color
  const colorSegments = [];
  
  // A. Check inside parentheses first
  const parenMatch = title.match(/\((.*?)\)/);
  if (parenMatch) colorSegments.push(...parenMatch[1].split(','));
  
  // B. Check comma-separated chunks of the whole title
  colorSegments.push(...title.split(','));

  const extendedColors = [...baseColors, 'navy', 'carbon', 'starlight', 'midnight', 'copper', 'olive', 'sapphire', 'teal', 'indigo', 'burgundy', 'bronze', 'peach', 'sand', 'slate', 'aqua', 'pearl', 'maroon', 'ivory', 'rose', 'lilac', 'cobalt', 'violet', 'voilet', 'lavender', 'titanium', 'graphite', 'phantom', 'cream', 'mint', 'emerald', 'obsidian', 'porcelain', 'hazel', 'bay', 'coral', 'sea', 'charcoal', 'limestone', 'winter', 'mist', 'frost', 'berry'];

  for (const part of colorSegments) {
    const p = part.trim();
    // A color segment usually has no numbers, is longer than 2 chars, and isn't a generic word
    if (!/\d+/.test(p) && p.length > 2) {
       const pLower = p.toLowerCase();
       if (pLower === 'mobile phone' || pLower === 'smartphone' || pLower === 'dual sim') continue;
       
       // If this segment contains any known color word, assume the WHOLE segment is the color name!
       if (extendedColors.some(c => pLower.includes(c))) {
           details.color = p;
           break;
       }
    }
  }

  // C. Fallback to scanning individual words
  if (!details.color) {
    const words = title.split(/\s+/);
    for (let i = 0; i < words.length; i++) {
        const w = words[i].toLowerCase().replace(/[^a-z]/g, '');
        if (extendedColors.includes(w)) {
            if (i > 0) {
               const prev = words[i-1].toLowerCase().replace(/[^a-z]/g, '');
               const ignorePrev = ['gb', 'tb', 'mb', 'ram', 'rom', 'storage', 'smartphone', 'mobile', 'phone', '5g', '4g', 'with', 'and'];
               // If the previous word isn't a spec/fluff, it's likely a color modifier (e.g. "Awesome Iceblue")
               if (!ignorePrev.includes(prev) && !/\d+/.test(words[i-1])) {
                  details.color = words[i-1] + ' ' + words[i];
                  break;
               }
            }
            details.color = words[i];
            break;
        }
    }
  }

  // 4. Extract Model (The "Clean Sweep")
  let modelPart = title;
  
  // IMMEDIATELY discard all promotional text after pipes, hyphens, parentheses, or keywords 'with'/'by'
  // Example: "Galaxy S25 5G with Galaxy AI" -> "Galaxy S25 5G"
  modelPart = modelPart.split(/\|| - | \(|\bwith\b|\bby\b/i)[0].trim();
  
  // A. Remove Brand
  if (details.brand) modelPart = modelPart.replace(new RegExp('\\b' + details.brand + '\\b', 'gi'), '');
  
  // B. Remove anything inside remaining parentheses (just in case)
  modelPart = modelPart.replace(/\(.*?\)/g, ' ');

  // C. Remove ALL specs
  modelPart = modelPart.replace(/\b\d+\s*(?:GB|TB|MB|RAM|ROM)\b/gi, '');
  
  // Extra strict clean for spec words left behind
  modelPart = modelPart.replace(/\b(?:ram|rom|storage|memory)\b/gi, '');
  
  // D. Remove the specific Extracted Color string
  if (details.color) {
     const safeColor = details.color.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
     modelPart = modelPart.replace(new RegExp(safeColor, 'gi'), '');
  }

  // E. Remove ALL raw color words (Fallback)
  extendedColors.forEach(c => {
    modelPart = modelPart.replace(new RegExp('\\b' + c + '\\b', 'gi'), '');
  });

  // E. Remove common fluff words and store names
  const fluff = [
    'amazon.in', 'amazon', 'flipkart', 'croma', 'reliance', 'digital', 'buy', 'online', 'price', 'india', 'at', 'best', 'in',
    'smartphone', 'mobile', 'phone', '5g', '4g', 'unlocked', 'dual sim', 'display', 'promotion', 'front', 'back', 'camera', 'ai', 'with', 'built-in', 'privacy'
  ];
  fluff.forEach(word => {
    modelPart = modelPart.replace(new RegExp('\\b' + word.replace('.', '\\.') + '\\b', 'gi'), '');
  });

  // Clean punctuation and trim
  details.model = modelPart.replace(/[,\(\)\|:;\-]/g, ' ').replace(/\s+/g, ' ').trim();
  
  return details;
}

function isModelMatch(candidateTitle, target) {
  const title = candidateTitle.toLowerCase();
  
  // Clean target model from common fluff
  const targetModel = target.model.toLowerCase().replace(/5g|4g|smartphone|mobile|phone/g, '').trim();
  const modelWords = targetModel.split(/\s+/).filter(w => w.length > 1);
  
  // Typo-tolerant matching: Require 75% of model words to match
  let matchCount = 0;
  for (const word of modelWords) {
    if (title.includes(word)) matchCount++;
  }
  
  if (modelWords.length > 2) {
    if ((matchCount / modelWords.length) < 0.70) return false;
  } else {
    if (matchCount !== modelWords.length) return false;
  }

  // Strict modifier check (e.g., if we want Pro, don't match Pro Max)
  const modifiers = ['pro', 'plus', 'max', 'ultra', 'lite', 'fe', 'se', 'fold', 'flip', 'edge', 'neo', 'mini'];
  for (const mod of modifiers) {
    const targetHasMod = new RegExp('\\b' + mod + '\\b', 'i').test(targetModel);
    const candidateHasMod = new RegExp('\\b' + mod + '\\b', 'i').test(title);
    if (targetHasMod !== candidateHasMod) return false;
  }

  return true;
}

function isStrictMatch(candidateTitle, target) {
  if (!isModelMatch(candidateTitle, target)) return false;
  
  // Normalize both by removing ALL spaces and punctuation for spec matching
  const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const titleNorm = normalize(candidateTitle);
  
  if (target.ram && !titleNorm.includes(normalize(target.ram))) return false;
  if (target.storage && !titleNorm.includes(normalize(target.storage))) return false;
  
  // PHASE 3: Strict Color Matching
  if (target.color) {
    const colorWords = target.color.toLowerCase().split(/\s+/);
    const candidateLower = candidateTitle.toLowerCase();
    for (const cw of colorWords) {
      if (!candidateLower.includes(cw)) return false;
    }
  }
  
  return true;
}

// --- GLOBAL STATE ---
let globalTargetDetails = null;
let globalCurrentResults = null;

function extractPidFromUrl(urlStr, sid) {
   try {
     const u = new URL(urlStr);
     if (sid === 1) return u.searchParams.get("pid");
     if (sid === 2) { const m = u.pathname.match(/\/dp\/([A-Z0-9]+)/); return m ? m[1] : null; }
     if (sid === 13) { const m = u.pathname.match(/\/p\/([a-zA-Z0-9]+)/); return m ? m[1] : null; }
     if (sid === 14) { const p = u.pathname.split('/'); return p[p.length - 1]; }
   } catch(e) {}
   return null;
}

// --- UI AND INJECTION LOGIC ---
function injectFAB() {
  if (document.getElementById("sp-floating-btn")) return;

  const btn = document.createElement("div");
  btn.id = "sp-floating-btn";
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
      <div class="sp-detected-title" id="sp-detected-title" style="margin-bottom: 12px; line-height: 1.5;">
        <div style="font-size: 12px; color: #a1a1aa;">Brand: <span id="sp-ui-brand" style="color: white; font-weight: bold;">Detecting...</span></div>
        <div style="font-size: 12px; color: #a1a1aa;">Model: <span id="sp-ui-model" style="color: white; font-weight: bold;">Detecting...</span></div>
        <div style="font-size: 12px; color: #a1a1aa;">Specs: <span id="sp-ui-specs" style="color: white; font-weight: bold;">Detecting...</span></div>
      </div>
      <div style="display: flex; gap: 8px;">
        <button class="sp-action-btn" id="sp-start-scan" style="flex: 1;">Scan Other Stores</button>
        <button class="sp-action-btn" id="sp-push-db" style="flex: 1; display: none; background: #10b981;">Push to DB</button>
      </div>
      
      <div class="sp-loading" id="sp-loading">
        <div class="sp-spinner"></div>
        <div style="font-size: 12px; color: #a1a1aa;">Comparing specifications...<br>Scanning tabs in background.</div>
      </div>
      
      <div class="sp-error" id="sp-error"></div>
      <div class="sp-results" id="sp-results"></div>
    </div>
  `;
  document.body.appendChild(widget);

  document.body.appendChild(widget);

  btn.addEventListener("click", () => {
    widget.classList.add("sp-open");
    // Prioritize specific store title elements to avoid grabbing promotional h1 tags
    const specificElem = document.getElementById("productTitle") || // Amazon
                         document.querySelector(".B_NuCI, .VU-ZEz") || // Flipkart
                         document.querySelector(".pd-title, .pdp__title"); // Croma & Reliance
                         
    let rawTitle = "";
    if (specificElem) {
      rawTitle = specificElem.innerText;
    } else {
      const h1 = document.querySelector("h1");
      rawTitle = h1 ? h1.innerText : document.title;
    }
    
    globalTargetDetails = extractAttributes(rawTitle);
    
    console.log("[SmartPrice] Detected Target:", globalTargetDetails);
    
    document.getElementById("sp-ui-brand").innerText = globalTargetDetails.brand || 'N/A';
    document.getElementById("sp-ui-model").innerText = globalTargetDetails.model || 'Unknown';
    document.getElementById("sp-ui-specs").innerText = `${globalTargetDetails.ram ? globalTargetDetails.ram + ' RAM | ' : ''}${globalTargetDetails.storage || ''} ${globalTargetDetails.color ? '| ' + globalTargetDetails.color : ''}`;
    
    document.getElementById("sp-start-scan").disabled = !globalTargetDetails.brand && !globalTargetDetails.model;
  });

  document.getElementById("sp-push-db").addEventListener("click", async () => {
    if (!globalTargetDetails || !globalCurrentResults) return;
    
    const btnDb = document.getElementById("sp-push-db");
    btnDb.innerText = "Pushing...";
    btnDb.disabled = true;

    const data = [];
    
    const host = window.location.hostname;
    let currentSid = 0;
    if (host.includes("flipkart.com")) currentSid = 1;
    else if (host.includes("amazon.in")) currentSid = 2;
    else if (host.includes("croma.com")) currentSid = 13;
    else if (host.includes("reliancedigital.in")) currentSid = 14;
    
    if (currentSid > 0) {
        const pid = extractPidFromUrl(window.location.href, currentSid);
        if (pid) data.push({ pid, sid: currentSid });
    }

    for (const [storeId, links] of Object.entries(globalCurrentResults)) {
        let sid = 0;
        if (storeId === 'flipkart') sid = 1;
        else if (storeId === 'amazon') sid = 2;
        else if (storeId === 'croma') sid = 13;
        else if (storeId === 'reliance_digital') sid = 14;
        
        let pid = null;
        if (links.exact) pid = extractPidFromUrl(links.exact, sid);
        else if (links.variant) pid = extractPidFromUrl(links.variant, sid);
        
        if (pid && !data.find(x => x.pid === pid)) data.push({ pid, sid });
    }

    const payload = {
        model: globalTargetDetails.model,
        brand: globalTargetDetails.brand,
        priceComparisonData: data
    };

    console.log("[SmartPrice] Pushing to DB:", payload);

    try {
        chrome.runtime.sendMessage({ action: "pushToDB", payload: payload }, (response) => {
            if (response && response.success) {
                btnDb.innerText = "Pushed to DB!";
                btnDb.style.background = "#059669";
            } else {
                btnDb.innerText = "API Error";
                btnDb.style.background = "#ef4444";
                console.error("[SmartPrice] API Error:", response?.error);
            }
        });
    } catch (e) {
        btnDb.innerText = "Network Error";
        btnDb.style.background = "#ef4444";
    }
  });

  document.getElementById("sp-close-btn").addEventListener("click", () => {
    widget.classList.remove("sp-open");
  });

  document.getElementById("sp-start-scan").addEventListener("click", () => {
    if (!globalTargetDetails) return;
    
    document.getElementById("sp-start-scan").style.display = "none";
    document.getElementById("sp-push-db").style.display = "none";
    document.getElementById("sp-loading").style.display = "block";
    document.getElementById("sp-error").style.display = "none";
    document.getElementById("sp-results").style.display = "none";

    const query = `${globalTargetDetails.brand} ${globalTargetDetails.model} ${globalTargetDetails.storage} ${globalTargetDetails.color || ''}`.replace(/\s+/g, ' ').trim();
    chrome.runtime.sendMessage({ action: "searchProduct", query: query, target: globalTargetDetails });
  });
}

function renderResults(results) {
  const resultsDiv = document.getElementById("sp-results");
  let exactHtml = "";
  let variantHtml = "";

  const storeIdToSid = { 'flipkart': 1, 'amazon': 2, 'croma': 13, 'reliance_digital': 14 };

  for (const [storeId, links] of Object.entries(results)) {
    const iconUrl = STORE_ICONS[storeId];
    const storeName = STORE_NAMES[storeId];
    const sid = storeIdToSid[storeId] || 0;
    
    if (links.exact) {
      const pid = extractPidFromUrl(links.exact, sid);
      const pidHtml = pid ? `<span style="font-size: 9px; color: #10b981; display: block; margin-top: 2px;">SID: ${sid} | PID: ${pid}</span>` : '';
      exactHtml += `
        <div style="position: relative; display: flex; align-items: center;" class="sp-store-card-wrapper">
          <a href="${links.exact}" target="_blank" class="sp-store-card" style="flex: 1; padding-right: 32px;">
            <div class="sp-store-info" style="display:flex; align-items:center;">
              <img src="${iconUrl}" class="sp-store-icon" style="margin-right:8px;">
              <div class="sp-store-details" style="display:flex; flex-direction:column; justify-content:center;">
                <span class="sp-store-name" style="font-weight:bold;">${storeName}</span>
                <span class="sp-store-title" style="font-size: 10px; color: #a1a1aa; display: block; margin-top: 2px; line-height: 1.2; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${links.exactTitle}">${links.exactTitle}</span>
                ${pidHtml}
              </div>
            </div>
            <span class="sp-view-btn">View Match</span>
          </a>
          <button title="Remove wrong match" onmouseover="this.style.color='#ef4444';" onmouseout="this.style.color='#a1a1aa';" onclick="this.closest('.sp-store-card-wrapper').outerHTML = \`<div class='sp-store-card sp-not-found'><div class='sp-store-info' style='display:flex; align-items:center;'><img src='${iconUrl}' class='sp-store-icon' style='margin-right:8px;'><span class='sp-store-name' style='font-weight:bold;'>${storeName}</span></div><span class='sp-view-btn'>Removed</span></div>\`;" style="position: absolute; right: 8px; background:none; border:none; color:#a1a1aa; cursor:pointer; font-size:18px; line-height:1; padding:4px; display:flex; align-items:center; z-index: 10;">&times;</button>
        </div>
      `;
    } else if (links.variant) {
      const pid = extractPidFromUrl(links.variant, sid);
      const pidHtml = pid ? `<span style="font-size: 9px; color: #a1a1aa; display: block; margin-top: 2px;">SID: ${sid} | PID: ${pid}</span>` : '';
      variantHtml += `
        <div style="position: relative; display: flex; align-items: center;" class="sp-store-card-wrapper">
          <a href="${links.variant}" target="_blank" class="sp-store-card sp-variant" style="flex: 1; padding-right: 32px;">
            <div class="sp-store-info" style="display:flex; align-items:center;">
              <img src="${iconUrl}" class="sp-store-icon" style="margin-right:8px;">
              <div class="sp-store-details" style="display:flex; flex-direction:column; justify-content:center;">
                <span class="sp-store-name" style="font-weight:bold;">${storeName}</span>
                <span class="sp-store-title" style="font-size: 10px; color: #a1a1aa; display: block; margin-top: 2px; line-height: 1.2; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${links.variantTitle}">${links.variantTitle}</span>
                ${pidHtml}
              </div>
            </div>
            <span class="sp-view-btn">View Variant</span>
          </a>
          <button title="Remove wrong match" onmouseover="this.style.color='#ef4444';" onmouseout="this.style.color='#a1a1aa';" onclick="this.closest('.sp-store-card-wrapper').outerHTML = \`<div class='sp-store-card sp-not-found'><div class='sp-store-info' style='display:flex; align-items:center;'><img src='${iconUrl}' class='sp-store-icon' style='margin-right:8px;'><span class='sp-store-name' style='font-weight:bold;'>${storeName}</span></div><span class='sp-view-btn'>Removed</span></div>\`;" style="position: absolute; right: 8px; background:none; border:none; color:#a1a1aa; cursor:pointer; font-size:18px; line-height:1; padding:4px; display:flex; align-items:center; z-index: 10;">&times;</button>
        </div>
      `;
    } else {
      exactHtml += `
        <div class="sp-store-card sp-not-found">
          <div class="sp-store-info" style="display:flex; align-items:center;">
            <img src="${iconUrl}" class="sp-store-icon" style="margin-right:8px;">
            <span class="sp-store-name" style="font-weight:bold;">${storeName}</span>
          </div>
          <span class="sp-view-btn">Unavailable</span>
        </div>
      `;
    }
  }

  let html = `<div class="sp-section-label">Exact Matches</div>` + exactHtml;
  if (variantHtml) html += `<div class="sp-section-label">Other Variants</div>` + variantHtml;

  resultsDiv.innerHTML = html;
  document.getElementById("sp-loading").style.display = "none";
  resultsDiv.style.display = "flex";
  
  globalCurrentResults = results;
  
  const startBtn = document.getElementById("sp-start-scan");
  startBtn.style.display = "block";
  startBtn.innerText = "Search Again";
  
  const pushBtn = document.getElementById("sp-push-db");
  pushBtn.style.display = "block";
  pushBtn.innerText = "Push to DB";
  pushBtn.disabled = false;
  pushBtn.style.background = "#10b981";
}

// --- AUTOMATED SCRAPER LOGIC ---
async function runAutoScraper() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("sp_matcher")) return;

  const host = window.location.hostname;

  // Visual Debug Banner
  const banner = document.createElement("div");
  banner.style = "position:fixed;top:0;left:0;width:100%;background:yellow;color:black;z-index:999999;padding:10px;text-align:center;font-weight:bold;font-family:sans-serif;";
  banner.innerText = "SmartPrice is scanning this page...";
  document.body.appendChild(banner);

  const targetStr = url.searchParams.get("sp_target");
  if (!targetStr) return;
  const target = JSON.parse(decodeURIComponent(targetStr));

  let result = { exact: null, exactTitle: null, variant: null, variantTitle: null };

  // Wait and scroll to trigger dynamic content and lazy-loaded images/links
  for (let i = 0; i < 8; i++) {
    window.scrollTo(0, 500 + (i * 300));
    await new Promise(r => setTimeout(r, 1000));
  }

  try {
    const allLinks = Array.from(document.links);
    const candidates = [];
    
    // Universal routing path checks (Impossible to break via CSS changes)
    allLinks.forEach(link => {
       const href = link.href;
       if (!href) return;
       
       let isValidProductLink = false;
       if (host.includes("amazon.in") && href.includes("/dp/") && !href.includes("slredirect")) isValidProductLink = true;
       if (host.includes("flipkart.com") && href.includes("/p/")) isValidProductLink = true;
       if (host.includes("croma.com") && href.includes("/p/")) isValidProductLink = true;
       if (host.includes("reliancedigital.in") && (href.includes("/product/") || href.includes("/p/") || href.includes("/buy/"))) isValidProductLink = true;

       if (isValidProductLink) {
          let rawText = link.innerText.trim();
          
          if (rawText.length < 15) {
             rawText = link.getAttribute('title') || link.getAttribute('aria-label') || link.parentElement.innerText.trim();
          }
          
          if (rawText && rawText.length >= 15) {
             let finalTitle = rawText;
             // If this is a complex grid card with multiple lines (like Flipkart), isolate the actual title!
             if (rawText.includes('\n')) {
                 const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 3);
                 let titleIdx = lines.findIndex(l => target.brand && l.toLowerCase().includes(target.brand.toLowerCase()));
                 if (titleIdx === -1) titleIdx = lines.indexOf(lines.reduce((a, b) => a.length > b.length ? a : b, ""));
                 
                 let reconstructed = lines[titleIdx] || "";
                 // Append any other lines that contain RAM/Storage specs so they aren't lost to the strict matcher!
                 for (let i = 0; i < lines.length; i++) {
                     if (i !== titleIdx && /(?:GB|TB|MB|RAM|ROM)/i.test(lines[i])) {
                         reconstructed += " " + lines[i];
                     }
                 }
                 finalTitle = reconstructed;
             }
             let finalLink = href.split('?')[0];
             if (host.includes("flipkart.com")) {
                 try {
                     const u = new URL(href);
                     const pid = u.searchParams.get("pid");
                     if (pid) finalLink += `?pid=${pid}`;
                 } catch(e) {}
             }
             candidates.push({ title: finalTitle.replace(/\s+/g, ' ').trim(), link: finalLink });
          }
       }
    });

    console.log(`[SmartPrice] Found ${candidates.length} potential product links on ${host}`);

    const seenUrls = new Set();
    for (const item of candidates) {
      if (seenUrls.has(item.link)) continue;
      seenUrls.add(item.link);
      
      const title = item.title.trim();
      if (isStrictMatch(title, target)) {
        console.log("[SmartPrice] Exact Match Found:", title);
        result.exact = item.link;
        result.exactTitle = title;
        break; 
      } else if (isModelMatch(title, target) && !result.variant) {
        console.log("[SmartPrice] Variant Match Found:", title);
        result.variant = item.link;
        result.variantTitle = title;
      }
    }
  } catch (err) {
    console.error("[SmartPrice] Scraping error:", err);
  }

  banner.innerText = result.exact ? "Match Found! Closing..." : "Finished Scan. Closing...";
  chrome.runtime.sendMessage({ action: "submitScrapedData", data: result });
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "searchResults") {
    if (message.success) renderResults(message.data.results);
  }
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    injectFAB();
    runAutoScraper();
  });
} else {
  injectFAB();
  runAutoScraper();
}
