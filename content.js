
const FIELD_SECTION_INDEX_MAPPING = {
  'connectors': '',
  'events': 1,
  'actions': 2,
  'functions': 3
}



// ================================== CHROME EXTENSION DATA ===================================//
let currentConnector = "";

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
  const entry = Object.entries(FIELD_SECTION_INDEX_MAPPING).find(e => e[1] == index);
  return entry[0] || "";
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
    const codeSearchModal = createSpotlightModal();
    showModal(codeSearchModal);
    registerSpotlightModalListeners();
    loadConnectors();
    document.querySelector("#fs-code-search__filter input").focus();
  }
};

const loadConnectors = async () => {
  const value = window.localStorage.getItem("fs_connectors");
  let connectors = [];
  
  if (value) {
    connectors = JSON.parse(value).connectors || [];
    if (connectors && connectors.length > 0) {
      datastore['connectors'] = connectors;
      return;
    }
  }

  try {
    document.querySelector("#fs-connector-sync__message").innerHTML = "Loading connector info ...";
    document.querySelector("#fs-code-search__header i.fa-refresh").classList.add("fa-refesh--loading");
    await openConnectorSearch();
    connectors = await getConnectors();
    document.querySelector(".channel-list-item").click();
    datastore['connectors'] = connectors;
    window.localStorage.setItem("fs_connectors", JSON.stringify({"timestamp": getTimestamp(), "connectors": connectors}));
  } finally {
    document.querySelector("#fs-code-search__header i.fa-refresh").classList.remove("fa-refesh--loading");
    document.querySelector("#fs-connector-sync__message").innerHTML = "";
  }
};

const createSpotlightModal = () => {
  hideModal();
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
            <span>Connector: [ ${currentConnector} ]</span>
          </h3>
          <span id="fs-connector-sync__message"></p>
        </div>
      </section>
      <br />
      <section class='fs-code-search__filter' id="fs-code-search__filter" >
        <div>
          <select>
            <option value='events'>Events</option>
            <option value='actions'>Actions</option>
            <option value='functions'>Functions</option>
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
          <span>Keyboard shortcuts</span>
        </div>
        <div>
          <span>Use Ctrl + e | a | f | c to select Events | Actions | Functions | Connectors  in select field next to input</span>
        </div>
        <div>
          <span>Press escape to close  spotlight</span>
        </div>
        <div>
          <span>Click refresh icon next to connector, to reload list of connectors.</span>
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
      const field = document.querySelector("#fs-code-search__filter select").value;
      if (currentConnector.length == 0 && field !== "connectors") {
        spotlightResultInfoMessage("Please select a connector by Ctrl+c to set connector option, enter a value in input box & press enter to see results");
        return;
      }
      const searchText = fieldInput.value;
      const results = datastore[field];
      const matchingResults = getMatchingResults(results, searchText);

      if (!matchingResults || matchingResults.length === 0) {
        spotlightResultInfoMessage("Can't find a match meeting your request");
      }

      if (field === "connectors") {
        document.querySelector("#fs-code-search__list ul").innerHTML = "";
        const ul = document.querySelector("#fs-code-search__list ul");
        matchingResults.forEach(matchingResult => {
          const li = createSpotlightResultListItem(matchingResult, {connector: matchingResult});
          ul.appendChild(li);
        });

        const lis = document.querySelectorAll("#fs-code-search__list ul li");
        lis.forEach((li) => {
          li.addEventListener('click', async (e) => {
            const connector = e.target.getAttribute('data-connector');
            await openConnectorSearch();
            await selectConnector(connector);
            currentConnector = connector;
          });
        });
      }

      if (field === "actions" || field == "events" || field == "functions") {
        document.querySelector("#fs-code-search__list ul").innerHTML = "";
        const ul = document.querySelector("#fs-code-search__list ul");
        matchingResults.forEach(matchingResult => {
          const li = createSpotlightResultListItem(matchingResult, {connector: currentConnector, field, method: matchingResult});
          ul.appendChild(li);
        });

        const lis = document.querySelectorAll("#fs-code-search__list ul li");
        lis.forEach((li) => {
          li.addEventListener('click', async (e) => {
            const connector = e.target.getAttribute("data-connector");
            const method = e.target.getAttribute("data-method");
            const field = e.target.getAttribute("data-field");

            addHistoryRecord({connector, field, method});

            await openSection(FIELD_SECTION_INDEX_MAPPING[field]);
            selectMethod(FIELD_SECTION_INDEX_MAPPING[field], method);

            hideModal();
          });
        });
      }
    }
  });

  // case: handle recent button click.
  const recentButton = document.querySelector("#fs-code-search__filter button");
  recentButton.addEventListener('click', async (e) => {
    document.querySelector("#fs-code-search__list ul").innerHTML = "";
    const ul = document.querySelector("#fs-code-search__list ul");

    if (historyRecords.length === 0) {
      spotlightResultInfoMessage("Can't find any recent searches for events, actions, fucntions");
      return;
    }

    historyRecords.forEach(historyRecord => {
      const li = createSpotlightResultListItem(`[${historyRecord.connector}] ${historyRecord.method}`, {connector: historyRecord.connector, field: historyRecord.field, method: historyRecord.method});
      ul.appendChild(li);
    });

    const lis = document.querySelectorAll("#fs-code-search__list ul li");
    document.querySelectorAll("#fs-code-search__list ul").innerHTML = "";
    lis.forEach((li) => {
      li.addEventListener('click', async (e) => {
        const connector = e.target.getAttribute('data-connector');
        const method = e.target.getAttribute("data-method");
        const field = e.target.getAttribute("data-field");

        await openConnectorSearch();
        await selectConnector(connector);
        await openSection(FIELD_SECTION_INDEX_MAPPING[field]);
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
  li.innerHTML = value;

  const ul = document.querySelector("#fs-code-search__list ul");
  Object.keys(attrs).forEach((attr) => {
    const attributeName = `data-${attr}`;
    const attributeValue = attrs[attr];

    li.setAttribute(attributeName, attributeValue);
  });
  return li;
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
        <h4> Collecting connector info for spotlight.... </h4>
      </div>
    `;
  modal.innerHTML = loadMessageContent;
  return modal;
};

const spotlightResultInfoMessage = (message) => {
  const ul = document.querySelector("#fs-code-search__list ul");
  ul.innerHTML = "";
  ul.innerHTML = `<li style="color: red; font-size-bold; text-align-center;">${message}</li>`;
}


//========================== NAV HELPERS ==========================================//
const openSection = async (sectionIdx) => {
  return new Promise((resolve, reject) => {
    let sections =  document.querySelectorAll(".left-nav .left-nav-category");
    const selectedSection = sections[sectionIdx];
    let openSectionInterval = setInterval(() => {
      // section is opened when plus icon appears on right side of section.
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
      // connector search is opened, when there are some channels listed.
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
     const methods = getMethodsInSection(sections[sectionIdx]);
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
   return new Promise((resolve, reject) => {
    const channelNames = document.querySelectorAll(".channel-list-item .channel-name");
    for( let channelNameIdx = 0; channelNameIdx < channelNames.length; channelNameIdx++) {
      if (channelNames.item(channelNameIdx).innerHTML.includes(connector)) {
        channelNames.item(channelNameIdx).click();
        break;
      }
    }

    // when connector is selected, 
    // default click handler of extn is triggered it opens a loading modal, it's closure means connector is selected.
    let waitForModalClosedInterval = null;
    let isModalClosed = () => {
      const modalEnabled = isModalEnabled();
      if (!modalEnabled) {
        clearInterval(waitForModalClosedInterval);
        waitForModalClosedInterval = undefined;
        setTimeout(() => {
          resolve();
        }, 200);
      } else {
        clearInterval(waitForModalClosedInterval);
        waitForModalClosedInterval = setInterval(isModalClosed, 200);
      }
    };
    waitForModalClosedInterval = setInterval(isModalClosed, 200);
   });
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
    channelListItems = document.querySelectorAll(".channel-list-item");
    if (channelListItems && channelListItems.length > 0 && !e.target.innerHTML.includes("New Connector")) {
      setTimeout(async () => {
        const progressModal = createConnectorInfoModal();
        showModal(progressModal);

        await recordConnectorInfo();
        
        currentConnector = document.querySelector(".channel-selector-button h2").innerHTML;
        hideModal();
      }, 0);
    }
  })
}

// show the search modal
document.addEventListener('keydown', (e) => {
  if (e.metaKey) {
    showSpotlightModal();
  }
  
  const selectField = (selectedOptionIdx) => {
    const field = document.querySelector("#fs-code-search__filter select");
    if (field) {
      field.selectedIndex = selectedOptionIdx;
    }
  };

  if (e.ctrlKey && e.keyCode == 65) {
    selectField(1);
  }
  else if (e.ctrlKey && e.keyCode == 69) {
    selectField(0);
  }
  else if (e.ctrlKey && e.keyCode == 70) {
    selectField(2);
  }
  else if (e.ctrlKey && e.keyCode == 67) {
    selectField(3);
  }
});


