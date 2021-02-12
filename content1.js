var script = document.createElement('script'); 
script.src = chrome.extension.getURL('content.js');
(document.head||document.documentElement).appendChild(script);