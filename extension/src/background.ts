// Trakie Extension — Service worker
// Will manage Socket.IO connection and Dutchie tab communication in W2

chrome.runtime.onInstalled.addListener(() => {
  console.log('Trakie extension installed');
});
