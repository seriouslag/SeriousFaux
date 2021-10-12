chrome.runtime.sendMessage({
  msg: 'track options open'
}, function(response) {
  log('response', response);
});


function status_alert(divId, message, time) {
  const status = document.getElementById(divId);
  status.textContent = message;
  setTimeout(function() {
    status.textContent = '';
  }, time);
}

// Saves options to chrome.storage
function save_options() {
    
  // get the default inputs
  const default_sites = document.getElementById('default_sites');
  const default_site_list = default_sites.getElementsByTagName('input');
  const sites_formatted = new Object();
  sites_formatted.default = [];
  log('default_site list', default_site_list);
    
  // loop through the displayed sites and make an array; then update what's saved
  for (let i = 0; i < default_site_list.length; i += 1) { 
    sites_formatted.default[i] = new Object();
    sites_formatted.default[i].url = default_site_list[i].value;
    sites_formatted.default[i].checked = default_site_list[i].checked;
  }
    
  // get the user inputs
  const user_sites = document.getElementById('user_sites');
  const user_site_list = user_sites.getElementsByTagName('input');
  sites_formatted.user = [];
  log('user_site list: ',user_site_list);
    
  // loop through the displayed sites and make an array; then update what's saved
  for (let i = 0; i < user_site_list.length; i += 1) { 
    sites_formatted.user[i] = new Object();
    sites_formatted.user[i].url = user_site_list[i].value;
    sites_formatted.user[i].checked = user_site_list[i].checked;
  }
    
  // also check other options
  const block_streams = document.getElementById('block_streams').checked;
  const explode_links = document.getElementById('explode_links').checked;
  const linkChangeInterval = document.getElementById('linkChangeInterval').value;
    
  chrome.storage.local.set({
    blockStreams: block_streams,
    explodeLinks: explode_links,
    sites: sites_formatted,
    baseInterval: linkChangeInterval,
  }, () => {
    chrome.runtime.sendMessage({ msg: 'updated_options' }, () => {});
  });
}


function disable_script() {
  log('disabling');
  chrome.storage.local.set({enabled: 'Waiting'}, () => {
    chrome.alarms.clearAll();
        
    log('disabled');
    document.getElementById('enabled_status').textContent = 'Stopped';
  });
}

function getDevMode() {
  const isDevMode = !('update_url' in chrome.runtime.getManifest());
  return isDevMode;
}

function log(...args) {
  if (getDevMode)
    console.log(...args);
}

function enable_script() {
  log('enabling');
  // send message to background
  //  chrome.runtime.sendMessage({msg: "enable"}, function(response) {
  chrome.runtime.sendMessage({msg: 'start'}, async (response) => {
    log('response23424424', response);
    if (!response) {
      log('no response');
    }
    if (response && response.farewell == 'no enabled sites') {
      // no enabled sites
      log('no enabled sites');
      // show an alert
      status_alert('alerts', 'You must enable at least one site.', 10000);
      // clean up, so alarms get cleared etc
      disable_script();
    } else {
      log('response2222', response);
      // it worked
      return await new Promise((resolve) => {
        chrome.storage.local.set({ enabled: 'Running' }, () => {
          log('running');
          document.getElementById('enabled_status').textContent = 'Running';
          resolve();
        });
      });
    }
  });
}

function enable_all_sites() {
  //get wrapper div
  const wrapper_div = this.parentNode.parentNode;
  //get & check checkboxes
  const inputs = wrapper_div.getElementsByTagName('input');
  for (let i = 1; i<inputs.length; i += 1) {
    if (inputs[i].getAttribute('type') == 'checkbox') {
      inputs[i].checked = true;
    }
  }
  // and save everything
  save_options();
}

function disable_all_sites() {
  //get wrapper div
  const wrapper_div = this.parentNode.parentNode;
  //get & check checkboxes
  const inputs = wrapper_div.getElementsByTagName('input');
  for (let i = 0; i<inputs.length; i += 1) {
    if (inputs[i].getAttribute('type') == 'checkbox') {
      inputs[i].checked = false;
    }
  }
  // and save everything
  save_options();
}


function add_user_site(event) {
  // don't submit the form
  event.preventDefault();
  log('adding site');
    
  //get value from HTML
  /** @type {string} */
  const new_site_value = document.getElementById('new_site').value;
  let new_site = new_site_value.trim();
  log('new_site', new_site);
    
  //check against blacklist
  const blacklist = new RegExp('(amazon.|ebay.)','i');
  if (blacklist.test(new_site)) {
    //alert & cancel
    status_alert('user_site_alerts','Sorry, that site cannot be added to SeriousFaux.',5000);
    //clear the entry
    document.getElementById('new_site').value = '';
            
    //bail out
    return false;
  }
    
  //check for real URL, & reject or modify if needed
  //test to see if it's a valid http/https URL
  if (/((https:\/\/)?[-a-z0-9]+(\.[-a-z0-9]{2,}){1,4}($|\s|\/.*))/i.test(new_site)) {
    // matches, so modify to remove http:// if it's there
    new_site = new_site_value.match(/((https:\/\/)?[-a-z0-9]+(\.[-a-z0-9]{2,}){1,2}($|\s|\/.*))/i)[1];
  } else {
    // send a message in the status div and return
    // don't clear the text field in case it was a typo
    status_alert('user_site_alerts', 'Invalid URL - please try again', 3000);
    return;
  }

    
  //add to storage
  log('adding to storage');
  //get current values
  chrome.storage.local.get({
    sites: [],
  }, (items) => {
    //add to items with new value
    const new_site_obj = {
      url: undefined,
      checked: 'checked',
    };
        
    items.sites.user.push(new_site_obj);
        
    log('items.sites: ', items.sites);
    log('items: ', items);
        
    chrome.storage.local.set({
      sites: items.sites
    }, () => {
      //track it
      chrome.runtime.sendMessage({
        msg: 'track add site',
        added: new_site
      }, (response) => {
        log('response', response);
      });
      write_sites_to_page(items);
    });
  });
    
  // empty the text box
  document.getElementById('new_site').value = '';
    
  return false;
}

function remove_site() {
    
  // get url to remove
  const url_to_remove = this.parentNode.getAttribute('data-val');
    
  //remove from page
  //  log("this",this);
  this.parentNode.parentNode.removeChild(this.parentNode);
    
  // get current values
  chrome.storage.local.get({
    sites: 'sites'
  }, (items) => {
        
    //    log("sites: ",items.sites);
    // find site to remove - must be in sites.user (for now)
        
    // remove
    for (let i = 0; i < items.sites.user.length; i += 1) {
      if (items.sites.user[i].url == url_to_remove) {
        items.sites.user.splice(i,1);
        i = items.sites.user.length+1;
      }
    }
        
    log('items: ', items);
        
    chrome.storage.local.set({
      sites: items.sites
    }, () => {
    });
  });    
}

// writes a site to the site list on the page
function write_site_to_div(site, div, i, delete_button) {
  const thisid = 's' + i;
  const thisurl = site.url;
  const thischecked = site.checked;
    
  const thiswrapper = document.createElement('div');
  thiswrapper.setAttribute('class','site_wrapper');
  thiswrapper.setAttribute('data-val',thisurl);
  thiswrapper.setAttribute('data-id',thisid);
    
  const thisinput = document.createElement('input');
  thisinput.setAttribute('id', thisid);
  thisinput.setAttribute('type', 'checkbox');
  thisinput.setAttribute('class', 'site');
  if (thischecked) {
    thisinput.setAttribute('checked', 'checked');
  }
    
  thisinput.setAttribute('value', thisurl);
    
  const thislabel = document.createElement('label');
  thislabel.setAttribute('for', thisid);
  thislabel.textContent = thisurl + ' ';
  thiswrapper.appendChild(thisinput);
  thiswrapper.appendChild(thislabel);
    
  if (delete_button) {
    const thisdelete = document.createElement('a');
    thisdelete.textContent = 'remove';
    thisdelete.setAttribute('href','#');
    thisdelete.setAttribute('class','remove_site_link');
    thisdelete.addEventListener('click', remove_site);
    thiswrapper.appendChild(thisdelete);
  }

  thiswrapper.appendChild(document.createElement('br'));
  div.appendChild(thiswrapper);
    
  return;
}

/** @typedef {{user: SiteEntry[];default: SiteEntry[];}} Sites */


/**
 * 
 * @param {Sites} sites
 * @returns {void}
 */
function write_sites_to_page(sites) {
    
  // default sites first
  const default_sites = document.getElementById('default_sites');
  default_sites.innerHTML = '';
  log('items.sites.default', sites.default);
  for (let i = 0; i < sites.default.length; i += 1) { 
    write_site_to_div(sites.default[i], default_sites, i, false);
  }
    
  // now user sites; start #ing at default+1
  log('user_sites div:',document.getElementById('user_sites'));
  const user_sites = document.getElementById('user_sites');
  user_sites.innerHTML = '';
  log('erased');
    
  const offset = sites.default.length;
  log('items.sites.user',sites.user);
  for (let i = 0; i < sites.user.length; i += 1) { 
    log('writing site', i);
    write_site_to_div(sites.user[i], user_sites, i+offset, true);
  }
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function restore_options() {
    
  log('restoring options from saved - options:');
    
  chrome.storage.local.get({
    enabled: 'Ready',
    blockStreams: [],
    userSitePreset: [],
    baseInterval: 1,
    sites: [],
  }, (items) => {
        
    write_sites_to_page(items.sites);
        
    //reset other options, too
    log('items.blockStreams',items.blockStreams);
    document.getElementById('block_streams').checked = items.blockStreams;
    document.getElementById('enabled_status').textContent = items.enabled;
    document.getElementById('new_site').value = items.userSitePreset;
    console.log('setting base', items.baseInterval);
    document.getElementById('linkChangeInterval').value = items.baseInterval;
  });
}

function reset_options() {  
  //  log("reset_options");
  chrome.runtime.sendMessage({msg: 'reset'}, (response) => {
    log('reset_options sendMessage \'reset\' callback response:', response);
    restore_options();
  });
}


document.addEventListener('DOMContentLoaded', () => {
  const links = document.getElementsByTagName('a');
  for (const link of links) {
    const location = link.href;
    link.onclick = () => {
      chrome.tabs.create({ active: true, url: location });
    };
  }
});

document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('sites_wrapper').addEventListener('click', save_options);
document.getElementById('disable').addEventListener('click', disable_script);
document.getElementById('enable').addEventListener('click', enable_script);
document.getElementById('start_link').addEventListener('click', enable_script);
document.getElementById('add_site_form').addEventListener('submit', add_user_site);
document.getElementById('disable_all_default_sites').addEventListener('click', disable_all_sites);
document.getElementById('enable_all_default_sites').addEventListener('click', enable_all_sites);
document.getElementById('disable_all_user_sites').addEventListener('click', disable_all_sites);
document.getElementById('enable_all_user_sites').addEventListener('click', enable_all_sites);
document.getElementById('block_streams').addEventListener('click', save_options);
document.getElementById('reset_button').addEventListener('click', reset_options);
document.getElementById('explode_links').addEventListener('click', save_options);
document.getElementById('linkChangeInterval').addEventListener('change', save_options);