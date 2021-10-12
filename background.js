/**
 * A number, or a string containing a number.
 * @typedef {{url: string;checked: string;}} SiteEntry
 */

/**
 * Sites!
 * @typedef {{user: SiteEntry[];default: SiteEntry[];}} Sites
 */

/* eslint-disable no-undef */
/* eslint-disable no-self-assign */
presets = presets;
/* eslint-enable no-self-assign */
/* eslint-enable no-undef */

function getDevMode() {
  const isDevMode = !('update_url' in chrome.runtime.getManifest());
  return isDevMode;
}

/**
 * 
 * @param {number} min 
 * @param {number} max 
 * @returns 
 */
function getRandomIntInclusive(min, max) {
  const formattedMin = Math.ceil(min);
  const formattedMax = Math.floor(max);
  return Math.floor(Math.random() * (formattedMax - formattedMin + 1)) + formattedMin;
}

/**
 * 
 * @param {string} url 
 * @returns {string}
 */
function formatUrl(url) {
  if (!url)
    return '';
  if (url.startsWith('http://'))
    return url.replace('http://', 'https://');
  else if (!url.startsWith('https://'))
    return `https://${url}`;
  return url;
}

/**
 * 
 * @returns {Promise<string[]>} 
 */
function get_enabled_sites() {
  return new Promise((resolve) => {
  /**
   * 
   * @param {{sites: Sites}} sites 
   */
    const handleGetSites = (results) => {
    // build array of sites
    /** @type {string[]} */
      const loadedSites = [];
      const {sites} = results;

      for (const site of sites.default) {
        if (!site.checked) {
          continue;
        }
        const formattedUrl = formatUrl(site.url);
        if (formattedUrl)
          loadedSites.push(site.url);
      }

      for (const site of sites.user) {
        if (!site.checked) {
          continue;
        }
        const formattedUrl = formatUrl(site.url);
        if (formattedUrl)
          loadedSites.push(site.url);
      }

      resolve(loadedSites);
    };
    chrome.storage.local.get({
      sites: [],
    }, (result) => handleGetSites(result));
  });
}

function log (...args) {
  if (getDevMode())
    console.log(...args);
}

/**
 * 
 * @returns {Promise<void>}
 */
async function open_new_site() {
  const sites = await get_enabled_sites();
        
  log('in open_new_site - sites', sites);
        
  const num = getRandomIntInclusive(0, sites.length - 1);
  log(num);
        
  //prepend http if it doesn't already exist
  const new_url = formatUrl(sites[num]);
  log('using url', new_url);
  return new Promise((resolve) => {
    chrome.storage.local.get('tabId', async (resultTabId) => {
      const updatePromise = new Promise((innerResolve) => {
        chrome.tabs.update(resultTabId.tabId, { url: new_url }, () => {
          // in case we want to put anything here...
          innerResolve();
        });
      });
      const setPromise = new Promise((innerResolve) => {
        chrome.storage.local.set({ activeSite: new_url }, () => {
        // in case we want to put anything here...
          innerResolve();
        });
      });
      await updatePromise;
      await setPromise;
      resolve();
    });
  });
}


chrome.alarms.onAlarm.addListener((alarm) => {
    
  log('alarm', alarm);

  return new Promise((resolve2) => {
    chrome.storage.local.get('enabled', async ({ enabled }) => {

      log('enabled', enabled);

      if (enabled == 'Enabled' || enabled == 'Running') {
        await new Promise((resolve) => {
          chrome.storage.local.get({
            'tabId': [],
            'blockStreams': []
          }, (result) => {

            log(result.tabId);

            //get the tab, to be sure it exists
            chrome.tabs.get(result.tabId, async (tab) => {
              log('tab', tab);

              if (chrome.runtime.lastError) {
                log(chrome.runtime.lastError.message);
              } else {
                if (alarm.name == 'newSite') {
                  //open a new site;
                  await open_new_site();
                } else if (alarm.name == 'linkClick') {
                  //click a link on the page, using a content script
                  chrome.tabs.sendMessage(result.tabId, {
                    text: 'click link',
                    blockStreams: result.blockStreams
                  }, async (response) => {
                    if (response == 'linkclick failed') {
                      // just open a new site instead
                      await open_new_site();
                    }
                  });

                  log('sent clicked_link');
                }

                // set the next alarm
                // randomize which type it should be
                // the '4' should be controlled in a setting, but use this for now

                // create alarm so link will be clicked
                chrome.storage.local.get('baseInterval', (result) => {
                  // mult x random 2x, so results skew closer to baseInterval
                  const interval = result.baseInterval + (Math.random() * Math.random() * result.baseInterval);

                  const rand = getRandomIntInclusive(0, 4);
                  log('rand alarm int: ', rand);
                  if (rand == 0) { // 1/4 of the time
                    chrome.alarms.create('newSite', { delayInMinutes: interval });
                  } else {
                    chrome.alarms.create('linkClick', { delayInMinutes: interval });
                  }
                  resolve();
                });
              }
            });
          });
        });

      } else {
        log('alarm disabled', alarm);
      }
      log('alarm completed');
      resolve2();
    });
  });
});

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  log('message', request.msg);
    
  if (request.msg == 'start') {
    // start visiting sites
        
    // first confirm that there are enabled sites
    const sites = await get_enabled_sites();     
    log('starting', sites);       
    if (sites && sites.length > 0) {
                
      //get current tab
      chrome.tabs.query({active: true, currentWindow: true}, async (arrayOfTabs) => {
        // since only one tab should be active and in the current window at once
        // the return variable should only have one entry
        
        if (arrayOfTabs.length) {
          const activeTab = arrayOfTabs[0];
          const activeTabId = activeTab.id; // or do whatever you need
          log('activeTab', activeTab);
          log('storing tab id: ', activeTabId);
          // store the tab id
          await new Promise((resolve) => {
            chrome.storage.local.set({ tabId: activeTabId }, () => {
              resolve();
            });
          });

        }
                    
        // open new site
        await open_new_site();
        sendResponse({ farewell: 'open_new_site called' });
      });
                
      // create first alarm - should always be a linkClick
                
      chrome.storage.local.get('baseInterval', (result) => {
        // mult x random 2x, so results skew lower
        const interval = result.baseInterval + (Math.random() * Math.random() * result.baseInterval);
        chrome.alarms.create('linkClick', { delayInMinutes: interval });
      });
      sendResponse({});
      return;
    } else { //no enabled sites
      // send a response; options page will show an alert
      log('no enabled sites');
      sendResponse({ farewell: 'no enabled sites' });
      return;
    }
        
  } else if (request.msg == 'track add site') {
    log('track add site', request);
  } else if (request.msg == 'track options open') {
    log('track options open', request);
  } else if (request.msg == 'track link click') {
    log('track link click', request);
  } else if (request.msg == 'reset') {
    log('reset', request);
    const preserve_preferences = false;
    // eslint-disable-next-line no-undef
    const results = await initialize_seriousfaux(preserve_preferences, presets);
    sendResponse(results);
    return;
  }
  // we're done
  sendResponse({});
});

/**
 * 
 * @param {boolean} preserve_preferences 
 * @param {{sites: Sites;enabled: string;blockStreams: boolean;baseInterval: number;userSitePreset: string;}} presets
 * @returns {Promise<void>}
 */
async function initialize_seriousfaux(preserve_preferences, presets) {
  log('initializing');
  log('presets', presets);
  log('preserve_preferences', preserve_preferences);
    
  // in dev mode, load links more quickly
  const base_interval = presets.baseInterval;
  const block_streams = presets.blockStreams;
  const user_site_preset = presets.userSitePreset;

  return new Promise((resolve) => {
    /**
 * 
 * @param {{enabled: 'Enabled'|'Disabled';blockStreams:boolean;userSitePreset:string;sites:{user: {url:string;checked:boolean;}[];default:{url:string,checked:boolean;}[]}}} param0
 */
    const handleLocalStorageLoad = ({ sites }) => {
      log(sites);

      // copy default from presets into local storage
      // have to do this, or else we wind up updating presets.sites via reference
      /** @type {{user: {url:string;checked:boolean;}[];default:{url:string,checked:boolean;}[]}} */
      const new_sites = JSON.parse(JSON.stringify(presets.sites));
      log('presets sites', new_sites);

      if (preserve_preferences)
        log('preserving preferences');

      // default sites first
      if (sites.default) {
        const stored_sites = sites.default;
        //cycle through
        for (let i = 0; i < stored_sites.length; i += 1) {
          for (let j = 0; j < sites.default.length; j += 1) {
            //this should be the other way around.  stored URLs may be longer.
            if (stored_sites[i].url.indexOf(new_sites.default[j].url) > -1) {
              //then update new_sites[j] with checked value from sites[i]
              new_sites.default[j].checked = stored_sites[i].checked;
            }
          }
        }
      }

      // user sites too
      if (sites.user) {
        // then just copy result.sites.user over to sites.user

        //          new_sites.user = result.sites.user;
        new_sites.user = JSON.parse(JSON.stringify(sites.user));
        log('copied user sites');
        log('sites', sites);
      }

      // now sites has current values
      // set values in local storage
      log('base_interval', base_interval);
      log('block_streams', block_streams);

      //now finally, set values.
      chrome.storage.local.set({
        enabled: 'Waiting',
        baseInterval: base_interval,
        blockStreams: block_streams,
        userSitePreset: user_site_preset,
        sites: new_sites
      }, () => {
        resolve();
      });
    };

    // load settings from local storage into a different variable
    chrome.storage.local.get({
      sites: 'stored_sites',
      blockStreams: [],
      userSitePreset: [],
    }, (results) => handleLocalStorageLoad(results),
    );
  });
}

// eslint-disable-next-line no-undef
initialize_seriousfaux(true, presets);
