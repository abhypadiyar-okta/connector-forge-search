
const FIELD_SECTION_INDEX_MAPPING = {
  'connectors': '',
  'events': 1,
  'actions': 2,
  'functions': 3
}



// ================================== CHROME EXTENSION DATA ===================================//
let currentConnector = "";
let connectors = [];

//  possible results for each options
let datastore = {};

// maintains last 10 searches.
const historyRecords = [];

//============================= UTILS =======================================//
const getMatchingResults = (results, searchText) => {
  const re = new RegExp(searchText, 'gi');
  const matchingResults =  results.filter(result => !!result.match(re));
  return matchingResults;
};

const getTimestamp = () => new Date().toISOString().slice(0,10);

const addHistoryRecord = (record) => {
  if (historyRecords.length >= 10) {
    historyRecords.pop();
  }
  historyRecords.unshift(record);
};

const getSectionFromIndex = (index) => {
  const entry = Object.entries().find(e => e.value == index);
  return entry.key || "";
}

// ============================= MODAL COMMONS ============================= //
const createModal = () => {
  const modal = document.createElement('section');
  modal.id="forge-search-modal";
  modal.className = "fs-search-modal";
  return modal;
};


const hideModal = () => {
  const forgeSearchModal = document.getElementById('forge-search-modal');
  forgeSearchModal && forgeSearchModal.remove();
  const reactIdModal = document.getElementById('react');
  if (reactIdModal) {
    reactIdModal.style = "";
  }
};

const showModal = (contentNode) => {
  const body = document.querySelector("body");
  const pageSection = body.querySelector("#react");
  pageSection.style="opacity: 0.5;";
  body.appendChild(contentNode);  
}

const isModalEnabled = () => 
  !!document.getElementById('forge-search-modal');




// ============================= SPOTLIGHT MODAL ============================= //
const showSpotlightModal = () => {
  document.addEventListener('keydown', (evt) => {
    const isEscape = (evt.key === "Escape" || evt.key === "Esc");
    isEscape && hideModal();
  });
  
  if (!isModalEnabled()) {
    const codeSearchModal = createCodeSearchModal();
    addForgeSearchModal(codeSearchModal);
    registerCodeSearchModalListeners();
    loadConnectors();
  }
};

const loadConnectors = () => {
  const value = window.localStorage.getItem("fs_connectors");
  const connectors = JSON.parse(value).connectors || [];
  if (!!connectors) {
    openConnectorSearch();
    connectors = getConnectors();
  }
};

const createSpotlightModal = () => {
  removeModal();
  const modal = createModal();
  const spotlightContent = `
    <div class="fs-code-search">
      <section class="fs-code-search__header" id="fs-code-search__header">
        <div>
          <h3>Forge Spotlight</h3>
        </div>
        <div class="fs-code-search__connector">
          <h3> 
            <i id="fs-connector-sync" class="icon fa fa-refresh"></i>
            <span>Connector: [ ${connector} ]</span>
          </h3>
          <p></p>
        </div>
      </section>
      <br />
      <section class='fs-code-search__filter' id="fs-code-search__filter" >
        <div>
          <select>
            <option value='events' selected>Events</option>
            <option value='actions'>Actions</option>
            <option value='events'>Functions</option>
            <option value='connectors'>Connectors</option>
          </select>
        </div>
        <div class="fs-code-search__field-input">
          <input 
            autofocus 
            type="text" 
            placeholder="Enter partial text, press enter to see matching results ..." 
            id="fs-filter-input" 
          />
          <i class="icon fa fa-search"></i>
        </div>
        <div>
          <button>
            <i class="icon fa fa-history"></i> 
            Recent
          </button>
        </div>
      </section>
      <section class="fs-code-search__list" id="fs-code-search__list">
        <ul />
      </section>
      <section class="fs-code-search__help" id="fs-code-search__help">
        <div>
          <i class="info fa fa-info-circle"></i>
          <span>Developer tips</span>
        </div>
        <div>
          <span>Use Ctrl + e | a | f | c (Select Events | Actions | Functions | Connectors )</span>
        </div>
        <div>
          <span>Press Escape to close the search</span>
        </div>
        <div>
          <span>Click refresh icon near connector to force refresh list of connectors</span>
        </div>
      </section>
    </div>`;
    modal.innerHTML = spotlightContent;
  return modal;
};

// registering spotlight search modal listeners
const registerSpotlightModalListeners = () => {
  // case: change search field, clear results and input field.
  const field = document.querySelector("#fs-code-search__filter select");
  field.addEventListener('change', e => {
    document.querySelector("#fs-code-search__filter input").value = "";
    document.querySelector("#fs-code-search__list ul").innerHTML = "";
  });

  // case: on enter in input field, update results, register listeners for results.
  const fieldInput = document.querySelector("#fs-code-search__filter input");
  fieldInput.addEventListener('keydown', e => {
    if (e.keyCode == 13) {
      const searchText = fieldInput.value;
      const field = document.querySelector("#fs-code-search__filter select").value;

      const results = datastore[field];
      const matchingResults = getMatchingResults(results, searchText);

      const ul = document.querySelector("#fs-code-search__list ul");
      if (field === "connectors") {
        matchingResults.forEach(matchingResult => {
          const li = createSpotlightResultListItem(matchingResult, {connector: matchingResult});
          ul.appendChild(li);
        });

        const lis = document.querySelectorAll("#fs-code-search__list ul li");
        lis.forEach((li) => {
          document.addEventListener('click', (e) => {
            const connector = e.getAttribute('data-connector');
            openConnectorSearch();
            selectConnector(connector);
          });
        });
      }

      if (field === "actions" || field == "events" || field == "functions") {
        matchingResults.forEach(matchingResult => {
          const li = createSpotlightResultListItem(matchingResult, {connector: currentConnector, field, method: matchingResult});
          ul.appendChild(li);
        });

        const lis = document.querySelectorAll("#fs-code-search__list ul li");
        lis.forEach((li) => {
          document.addEventListener('click', (e) => {
            const connector = e.getAttribute("data-connector");
            const method = e.getAttribute("data-method");
            const field = e.getAttribute("data-field");

            openSection(FIELD_SECTION_INDEX_MAPPING[field]);
            selectMethod(FIELD_SECTION_INDEX_MAPPING[field], method);
          });
        });
      }
    }
  });

  // case: handle recent button click.
  const recentButton = document.querySelector("#fs-code-search__filter button");
  recentButton.addEventListener('click', async (e) => {
    const ul = document.querySelector("#fs-code-search__list ul");

    historyRecords.forEach(historyRecord => {
      const li = createSpotlightResultListItem(matchingResult, {connector: historyRecord.connnector, field: historyRecord.field, method: historyRecord.method});
      ul.appendChild(li);
    });

    const lis = document.querySelectorAll("#fs-code-search__list ul li");
    lis.forEach((li) => {
      document.addEventListener('click', (e) => {
        const connector = e.getAttribute('data-connector');
        const method = e.getAttribute("data-method");
        const field = e.getAttribute("data-field");

        openConnectorSearch();
        selectConnector(connector);
        openSection(FIELD_SECTION_INDEX_MAPPING[field]);
        selectMethod(FIELD_SECTION_INDEX_MAPPING[field], method);
      });
    });
  });

  const connectorSyncIcon = document.getElementById("fs-connector-sync");
  connectorSyncIcon.addEventListener('click', async (e) => {
    try {
      connectorSyncIcon.classList.add("fa-refresh--running");

      await openConnectorSearch();
      const connectors = await getConnectors();

      // done to close the filter section.
      document.querySelector(".channel-list-item").click();

      datastore['connectors'] = connectors;

      // save to local storage.
      const value = JSON.stringify({"timestamp": getTimestamp(), "connectors": connectors});
      window.localStorage.setItem("fs_connectors", value);
    } finally {
      connectorSyncIcon.classList.remove("fa-refresh--running");
    }
  })
};


const createSpotlightResultListItem = (value, attrs) => {
  const li = document.createElement('li');
  li.innerHTML = label;

  const ul = document.querySelector("#fs-code-search__list ul");
  attrs.forEach((attr) => {
    const attributeName = `$data-${attr.key}`;
    li.setAttribute(attributeName, attr.value);
  });
}



// ============================= INFO MESSSAGE MODAL ============================= //
const createConnectorInfoModal = () => {
  hideModal();
  const modal = createModal();
  const loadMessageContent = `
      <div>
        <div style="text-align: center">
          <i class="icon fa fa-spinner" style="font-size: 30px"></i>
        </div>
        <h4> Collecting connector info .... </h4>
      </div>
    `;
  modal.innerHTML = loadMessageContent;
  return modal;
};



//========================== NAV HELPERS ==========================================//
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
    },200);
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
    },200);
  });
};

const selectMethod = async (section , method) => {
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

const getConnectors = async (connector) => {
  return new Promise((resolve, reject) => {
    const channelNameElems = document.querySelectorAll(".channel-list-item .channel-name");
    const connectors = [];
    channelNameElems.forEach((channelNameElem) => {
      connectors.push(channelNameElem.innerHTML);
    });
    resolve(connectors);
  });
};

const recordConnectorInfo = async () => {
  let sections =  document.querySelectorAll(".left-nav .left-nav-category");
  if (sections && sections.length > 0) {
   for (let sectionIdx = 1; sectionIdx < sections.length-2; sectionIdx++) {
     await openSection(sectionIdx);
 
     const section  = getSectionFromIndex(sectionIdx);
     if (!datastore[section]) {
       datastore[section] = [];
     }
     const methods = getMethodsInSection(selectedSection);
     datastore[section] = methods;
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
 
 const selectConnector = (connector) => {
   const channelNames = document.querySelectorAll(".channel-list-item .channel-name");
   for( let channelNameIdx = 0; channelNameIdx < channelNames.length; channelNameIdx++) {
     if (channelNames.item(channelNameIdx).innerHTML === connector) {
       channelNames.item(channelNameIdx).click();
       break;
     }
   }
 };




//============================ EXTENSION ENTRY POINT =====================================//
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
        const progressModal = createP();
        addForgeSearchModal(progressModal);

        await recordConnectorInfo();
        
        connector = document.querySelector(".channel-selector-button h2").innerHTML;
        hideModal();
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


