chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "ping") {
    sendResponse({ status: "alive" });
    return;
  }
  
  if (request.action === "searchProduct") {
    // We do NOT use sendResponse because it times out after 5 minutes
    fetch("http://127.0.0.1:5000/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: request.query })
    })
    .then(response => response.json())
    .then(data => {
      // Send message back to the tab
      chrome.tabs.sendMessage(sender.tab.id, { action: "searchResults", success: true, data: data });
    })
    .catch(error => {
      console.error("Backend Error:", error);
      chrome.tabs.sendMessage(sender.tab.id, { action: "searchResults", success: false, error: error.toString() });
    });
  }
});
