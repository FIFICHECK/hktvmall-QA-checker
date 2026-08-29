// background.js — Service Worker
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'openDashboard') {
    // Open dashboard tab
    chrome.tabs.create({
      url: 'https://fificheck.github.io/hktvmall-QA-checker/?extension=true'
    });
    sendResponse({ success: true, opened: true });
    return true;
  }

  if (request.action === 'sendToDashboard') {
    // Send extracted product data to the dashboard content script
    chrome.tabs.query({ url: 'https://fificheck.github.io/hktvmall-QA-checker/*' }, function(tabs) {
      if (tabs && tabs.length > 0) {
        // Dashboard already open — send data directly
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'injectProductData',
          data: request.data
        }).catch(function() {
          // Tab might not be ready, fallback to storage
          chrome.storage.local.set({ pendingProductData: request.data });
        });
        sendResponse({ sent: true });
      } else {
        // Dashboard not open — save to storage first, then open
        chrome.storage.local.set({ pendingProductData: request.data }, function() {
          chrome.tabs.create({
            url: 'https://fificheck.github.io/hktvmall-QA-checker/?extension=true'
          });
        });
        sendResponse({ sent: true, openedNewTab: true });
      }
    });
    return true; // Keep channel open for async
  }

  // Dashboard-initiated fetch: find an open HKTVmall product tab and extract that SKU
  if (request.action === 'fetchProduct') {
    var sku = request.sku;
    chrome.tabs.query({ url: 'https://www.hktvmall.com/*' }, function(tabs) {
      // ONLY use a tab whose URL actually contains the requested SKU — otherwise the
      // extracted data would be for the wrong product and we'd return wrong results.
      var target = tabs.find(function(t) { return t.url && t.url.indexOf(sku) >= 0; });
      if (!target) {
        // No matching tab open — tell dashboard to fall back to CORS proxy
        sendResponse({ success: false, error: 'NO_MATCHING_TAB' });
        return;
      }
      chrome.tabs.sendMessage(target.id, { action: 'extractProduct' }, function(response) {
        if (chrome.runtime.lastError || !response || !response.success) {
          sendResponse({ success: false, error: 'EXTRACT_FAILED' });
          return;
        }
        // Make sure the extracted data carries the requested SKU
        response.data.sku = sku;
        sendResponse({ success: true, data: response.data });
      });
    });
    return true; // Keep channel open for async
  }
});
