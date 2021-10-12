function getRandomIntInclusive(min, max) {
  const formattedMin = Math.ceil(min);
  const formattedMax = Math.floor(max);
  return Math.floor(Math.random() * (formattedMax - formattedMin + 1)) + formattedMin;
}

function getDevMode() {
  const isDevMode = !('update_url' in chrome.runtime.getManifest());
  return isDevMode;
}

function log (...args) {
  if (getDevMode)
    console.log(...args);
}

function clickRandomLink(blockStreams) {
  log('clicking random link');
    
  // construct query selector
  var domain = document.location.href.match(/(((https?:\/\/)?([-a-z0-9]+(\.[-a-z0-9]{2,}){1,2}))($|\s|\/.*))/i);
  // [2] is domain with the protocol,
  // [4] is domian without the protocol
  // /go2 = cnn live TV link
  const blockStream_QS = blockStreams ? ':not([href*=\'live\']):not([href*=\'stream\']):not([href*=\'/go2\']):not([href*=\'video\'])' : '';
    
  // don't open new windows, email programs, or javascript links
  const basicQS = ':not([target]):not([href^=\'mailto\']):not([href^=\'javascript\'])';
  // if there's no domain in the list, it's onsite
  const no_domain_QS = `a[href]${basicQS}:not([href^='http'])${blockStream_QS}`;
  // if it points to its own domain with protocol, it's onsite
  const onsite_with_protocol_QS = `a[href^='${domain[2]}']${basicQS}${blockStream_QS}`;
  // if it points to its own domain by domain name only, it's onsite
  const onsite_with_domain_QS = `a[href^='${domain[4]}']${basicQS}${blockStream_QS}`;
  // what about subdomains...?
  // base that on the stored current site
    
  //put it all together
  const full_QS = `${no_domain_QS}, ${onsite_with_protocol_QS}, ${onsite_with_domain_QS}`;
  log('full_QS', full_QS);
    
  var elements = document.querySelectorAll(full_QS);
  log('elements', elements); 
  if (elements.length > 0) {      
    //pick one at random and click it
    var num = getRandomIntInclusive(0, elements.length-1);
    var element = elements[num];
    element.click();
    log('sending response', element.href);
    return element.href;
  }
  return 'linkclick failed';
}
        
// Listen for messages
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  log('listening for messages', msg);
  if (msg.text === 'click link') {
    log('clicking random link');
        
    // pick one at random and click it    
    const result = clickRandomLink(msg.blockStreams);
    sendResponse(result);
  }
});