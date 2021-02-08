let connector = "";

//  possible results for each options
let resultsDataStore = {};

// maintains last 10 searches.
const recentSearches = [];

chrome.runtime.onMessage.addListener(function(message, callback) {
  if (message.type == "getLocalStorageResult") {
    const value = JSON.parse(message.value);
    resultsDataStore[4] = value.connectors;
  }
});

const showSearchModal = () => {
  document.addEventListener('keydown', (evt) => {
    const isEscape = (evt.key === "Escape" || evt.key === "Esc");
    isEscape && removeForgeSearchModal();
  });
  
  if (!isForgeSearchEnabled()) {
    const codeSearchModal = createCodeSearchModal();
    addForgeSearchModal(codeSearchModal);
    registerCodeSearchModalListeners();
  }
};

const createCodeSearchModal = () => {
  removeForgeSearchModal();
  const forgeSearchModal = createFogeSearchModal();
  const searchModalContent = `
    <div class="fs-code-search">
      <div class="fs-code-search__header" >
        <div>
          <h3>Search</h3>
        </div>
        <div style="position: absolute; right: 15px;">
          <h3> 
            <i id="fs-connector-search" class="icon fa fa-refresh"></i>
            <span>Connector: ${connector}</span>
          </h3>
        </div>
      </div>
      <br />
      <div class='fs-code-search__filter' id="fs-filter" >
        <select id="fs-filter-action">
          <option value=1 selected>Events</option>
          <option value=2>Actions</option>
          <option value=3>Functions</option>
          <option value=4>Connectors</option>
        </select>
        <input 
          autofocus 
          type="text" 
          placeholder="Enter partial text, press enter to see matching results ..." 
          id="fs-filter-input" 
        />
        <button id="fs-filter-recent">
          <i class="icon fa fa-history"></i> 
          Recent
        </button>
      </div>
      <div>
        <ul class="fs-code-search__list" id="fs-elems" />
      </div>
      <div>
        <div>
          <i class="info fa fa-info-circle"></i>
          <span>Developer tips</span>
        </div>
        <div>
          <span>Use Ctrl + e | a | f | c (Select Events | Actions | Functions | Connectors)</span>
        </div>
        <div>
          <span>Press Escape to close the search</span>
        </div>
        <div>
          <span>List of connectors synced everyday, click refresh icon near connector to force refresh</span>
        </div>
      </div>
    </div>`;
    forgeSearchModal.innerHTML = searchModalContent;
  return forgeSearchModal;
};

const createFogeSearchModal = () => {
  const modal = document.createElement('section');
  modal.id="forge-search-modal";
  modal.className = "fs-search-modal";
  return modal;
};

const createConnectInfoProgressModal = () => {
  removeForgeSearchModal();
  const forgeSearchModal = createFogeSearchModal();
  const loadMessageContent = `
      <div>
        <div style="text-align: center">
          <i class="icon fa fa-spinner" style="font-size: 30px"></i>
        </div>
        <h4> Collecting connector info .... </h4>
      </div>
    `;
  forgeSearchModal.innerHTML = loadMessageContent;
  return forgeSearchModal;
};

const debounce = (f, wait) => {
  let timeout;
  return function executeFuncion(...args) {
    const later = () => {
      clearTimeout(timeout);
      f(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// registering code search modal listeners
const registerCodeSearchModalListeners = () => {
  const action = document.getElementById("fs-filter-action");
  action.addEventListener('change', e => {
    document.getElementById("fs-filter-input").value = "";
    document.getElementById("fs-elems").innerHTML = "";
  });

  //TODO: add handle change debounce
  const input = document.getElementById("fs-filter-input");
  input.addEventListener('keydown', e => {
    if (e.keyCode == 13) {
      const searchText = input.value;
      const sectionIdx = document.getElementById("fs-filter-action").value;
      const matchingResults = getCodeSearchModalMatchingResults(sectionIdx, searchText);
      const infos = matchingResults.map(result => {
        return {method: result, section: sectionIdx};
      });
      updateCodeSearchModalWithResults(infos, async (info) => {
        saveRecentSearch(info);
        await openSection(info.section);
        await activateMethod(info.section, info.method);
        removeForgeSearchModal();
      });
    }
  });

  // update results with recent searches.
  const recent = document.getElementById("fs-filter-recent");
  recent.addEventListener('click', async (e) => {
    updateCodeSearchModalWithResults(recentSearches, async (info) => {
      await openSection(info.section);
      await activateMethod(info.section, info.method);
      removeForgeSearchModal();
    });
  });

  const connectorSearch = document.getElementById("fs-connector-search");
  connectorSearch.addEventListener('click', async (e) => {
    await openConnectorSearch();
    const channelNameElems = document.querySelectorAll(".channel-list-item .channel-name");
    const connectors = [];
    channelNameElems.forEach((channelNameElem) => {
      connectors.push(channelNameElem.innerHTML);
    })
    document.querySelector(".channel-list-item").click();
    resultsDataStore[4] = connectors;
    const value = JSON.stringify({"timestamp": getTimestamp(), "connectors": connectors});
    window.localStorage.setItem("fs_connectors", value);
  })
};

const getTimestamp = () => new Date().toISOString().slice(0,10);

const saveRecentSearch = (info) => {
  if (recentSearches.length >=10) {
    recentSearches.pop();
  }
  recentSearches.unshift(info);
};

// create result elems in code search modal.
const updateCodeSearchModalWithResults = (results, resultItemListener) => {
  const resultElems = document.getElementById("fs-elems");
  resultElems.innerHTML = "";

  results.forEach(result => {
    const liItem = document.createElement("li");
    liItem.innerHTML= `<div>${result.method}</div>`;
    liItem.setAttribute('data-section', result.section);
    resultElems.appendChild(liItem);
  });

  const resultHtmlElems = document.querySelectorAll("#fs-elems li");
  resultHtmlElems.forEach((elem) => elem.addEventListener("click", (e) => {
    const target = e.target;
    const info = {"section": parseInt(target.parentNode.getAttribute('data-section')), "method": target.innerHTML};
    resultItemListener(info);
  }));
};

const getCodeSearchModalMatchingResults = (sectionIdx, searchText) => {
  let filteredResults = resultsDataStore[sectionIdx] || [];
  const re = new RegExp(searchText, 'gi');
  filteredResults =  filteredResults.filter(result => !!result.match(re));
  return filteredResults;
};

const removeForgeSearchModal = () => {
  const forgeSearchModal = document.getElementById('forge-search-modal');
  forgeSearchModal && forgeSearchModal.remove();
  const reactIdModal = document.getElementById('react');
  if (reactIdModal) {
    reactIdModal.style = "";
  }
};

//activate method in section.
const activateMethod = async (section , method) => {
  let sections =  document.querySelectorAll(".left-nav .left-nav-category");
  const selectedSection = sections[section];

  const methods = selectedSection.parentNode.children[1].querySelectorAll(".method-name");
  for(let methodIdx =0; methodIdx < methods.length; methodIdx++) {
    if(methods[methodIdx].innerHTML == method) {
      methods[methodIdx].click();
      break;
    }
  }
};

const addForgeSearchModal = (contentNode) => {
  const body = document.querySelector("body");
  
  const pageSection = body.querySelector("#react");
  pageSection.style="opacity: 0.5;";

  body.appendChild(contentNode);  
}

const isForgeSearchEnabled = () => 
  !!document.getElementById('forge-search-modal');


const collectConnectorInfo = async () => {
 let sections =  document.querySelectorAll(".left-nav .left-nav-category");
 if (sections && sections.length > 0) {
  for (let sectionIdx = 1; sectionIdx < sections.length-2; sectionIdx++) {
    await openSection(sectionIdx);

    let sections =  document.querySelectorAll(".left-nav .left-nav-category");
    const selectedSection = sections[sectionIdx];
    if (!resultsDataStore[sectionIdx]) {
      resultsDataStore[sectionIdx] = [];
    }
    const methods = getMethodsInSection(selectedSection);
    resultsDataStore[sectionIdx] = methods;
  }
 }
};

const getMethodsInSection = (section) => {
  const parent = section.parentNode;
  const result = [];
  if (parent) {
    const sectionMethods =  parent.children[1].querySelectorAll(".method-name");
    sectionMethods.forEach(sectionMethd => {
      result.push(sectionMethd.innerHTML);
    });
  }
  return result;
}

const openSection = async (sectionIdx) => {
  return new Promise((resolve, reject) => {
    let sections =  document.querySelectorAll(".left-nav .left-nav-category");
    const selectedSection = sections[sectionIdx];
    let openSectionInterval = setInterval(() => {
      const hasSectionOpened =  selectedSection.querySelectorAll(".fa-plus-circle") && 
                                selectedSection.querySelectorAll(".fa-plus-circle").length > 0;
      if (hasSectionOpened) {
        clearInterval(openSectionInterval);
        openSectionInterval = undefined;
        resolve();
        return;
      } else {
        selectedSection.click();
      }
    },1000);
  });
};

const openConnectorSearch = async () => {
  return new Promise((resolve, reject) => {
    let selectorBtn =  document.querySelector(".channel-selector-button");
    let openSearchBtnInterval = setInterval(() => {
      const isChannelListLoaded = document.querySelectorAll(".channel-list-item") && 
                                  document.querySelectorAll(".channel-list-item").length > 0;
      if (isChannelListLoaded) {
        clearInterval(openSearchBtnInterval);
        openSearchBtnInterval = undefined;
        // close the filter section
        resolve();
        return;
      } else {
        selectorBtn.click();
      }
    },1000);
  });
};

// entry point
const channelDropdown =  document.querySelectorAll(".channel-dropdown")[0];
if (channelDropdown) {
  channelDropdown.addEventListener('click', async (e) => {
    let channelListItems = [];

    //it should have valid text.
    if (e.target.innerHTML.length === 0) {
      return;
    }
    console.log(e.target.innerHTML);
    channelListItems = document.querySelectorAll(".channel-list-item");
    if (channelListItems && channelListItems.length > 0 && !e.target.innerHTML.includes("New Connector")) {
      setTimeout(async () => {
        const progressModal = createConnectInfoProgressModal();
        addForgeSearchModal(progressModal);
        await collectConnectorInfo();
        connector = document.querySelector(".channel-selector-button h2").innerHTML;
        removeForgeSearchModal();
      }, 0);
    }
  })
}

// show the search modal
document.addEventListener('keydown', (e) => {
  if (e.metaKey) {
    showSearchModal();
  }
  console.log(e.keyCode);
  if (e.ctrlKey && e.keyCode == 65) {
    const action = document.getElementById("fs-filter-action");
    if (action) {
      action.selectedIndex = 1;
    }
  }
  else if (e.ctrlKey && e.keyCode == 69) {
    const action = document.getElementById("fs-filter-action");
    if (action) {
      action.selectedIndex = 0;
    }
  }
  else if (e.ctrlKey && e.keyCode == 70) {
    const action = document.getElementById("fs-filter-action");
    if (action) {
      action.selectedIndex = 2;
    }
  }
  else if (e.ctrlKey && e.keyCode == 67) {
    const action = document.getElementById("fs-filter-action");
    if (action) {
      action.selectedIndex = 3;
    }
  }
});