
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

// number of recent searches saved.
const N_SEARCHES_SAVED = 10;

//============================= UTILS =======================================//
const getMatchingResults = (results, searchText) => {
  const re = new RegExp(searchText, 'gi');
  const matchingResults =  results.filter(result => !!result.match(re));
  return matchingResults;
};

const getTimestamp = () => new Date().toISOString().slice(0,10);

/**
 * Local history of searches upto 
 * @param {*} record 
 */
const addHistoryRecord = (record) => {
  if (historyRecords.length >= N_SEARCHES_SAVED) {
    historyRecords.pop();
  }
  historyRecords.unshift(record);
};

/**
 * Basics _.invert of  FIELD_SECTION_INDEX_MAPPING.
 * @param {} index 
 */
const getSectionNameFromIndex = (index) => {
  const entry = Object.entries(FIELD_SECTION_INDEX_MAPPING).find(e => e[1] == index);
  return entry[0] || "";
}

//TODO: find way to access ace
const getEditorValue = () => {
  if (!window.ace) {
    return "";
  }
  const editor = window.ace.edit("brace-editor");
  if (!editor) {
    return "";
  }
  const code = window.ace.edit("brace-editor").getValue();
  return code;
}

const editorContainsText = (text) => {
  const stringValues = [];
  document.querySelectorAll("#brace-editor .ace_string").forEach(e => stringValues.push(e.innerHTML));
  console.log(stringValues);
  return stringValues.includes(`\"${text}\"`);
}

// ============================= MODAL COMMONS ============================= //
const createModalNode = () => {
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


// ============================= REFERENCE MODAL ============================= //
const createReferenceModalNode = () => {
  hideModal();
  const modal = createModalNode();
  const referenceContent = `
    <div class="fs-code-search" id="fs-reference">
      <section class="fs-code-search__header" id="fs-code-search__header">
        <div>
          <h3>Forge Spotlight</h3>
        </div>
        <div class="fs-code-search__connector">
          <h3> 
            <i id="fs-connector-sync" class="icon fa fa-refresh"></i>
            <span>Connector: [ ${currentConnector || "-"} ]</span>
          </h3>
          <span id="fs-connector-sync__message"></p>
        </div>
      </section>
      <br />
      <section class='fs-code-search__filter' id="fs-code-search__filter" >
        <div class="fs-code-search__field-input">
          <input 
            autofocus 
            type="text" 
            placeholder="Enter name of function" 
            id="fs-filter-input" 
            style="width:98%; min-width: 500px"
          />
          <i class="icon fa fa-search"></i>
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
          <span>Press escape to close  spotlight</span>
        </div>
      </section>
    </div>`;
    modal.innerHTML = referenceContent;
  return modal;
};

const showReferenceModal = () => {
  document.addEventListener('keydown', (evt) => {
    const isEscape = (evt.key === "Escape" || evt.key === "Esc");
    isEscape && hideModal();
  });
  
  if (!isModalEnabled()) {
    const referenceModal = createReferenceModalNode();
    showModal(referenceModal);
    registerReferenceListeners();
    document.querySelector("#fs-code-search__filter input").focus();
  }
};

const registerReferenceListeners = async () => {
  const fieldInput = document.querySelector("#fs-code-search__filter input");
  fieldInput.addEventListener('keydown', async e => {
    if (e.keyCode == 13) {
      const funcName = document.querySelector("#fs-code-search__filter input").value;

      if (!currentConnector) {
        modalInfoMessage("It works when you in context of conenctor, please Esc & Ctrl+1 to select connector", "error");
        return;
      }

      modalInfoMessage("Finding references ....", "info");
      const references = await getReferences(funcName);
      console.log(references);

      // if (!references || references.length  == 0) {
      //   modalInfoMessage("No matching results found meeting your request", "error");
      //   return;
      // }

      // const ul = document.querySelector("#fs-code-search__filter ul");
      // references.forEach(reference => {
      //   const li = createSpotlightResultListItem(reference, {connector: currentConnector, method: reference.method, field: reference.field});
      //   ul.appendChild(li);
      // });
    }
  });  
};


const getReferences = async (searchText) => {
  // case : search events, actions, functions
  const result = [];
  for(let sectionIdx = 1; sectionIdx < 4; sectionIdx++) {
    const section = getSectionNameFromIndex(sectionIdx);
    await openSection(section);
    const methods = getMethodsInSection(section);
    for (let methodIdx = 0; methodIdx < methods.length; methodIdx++) {
      const method = methods[methodIdx];
      console.log("==== method === " + method);
      await openMethod(section, method);
      if (editorContainsText(searchText)) {
        console.log("HAS METHOD ====!!!!");
        result.push({method: method, section})
      }
    }
  }
  return result;
};

// ============================= SPOTLIGHT MODAL ============================= //
const showSpotlightModal = () => {
  document.addEventListener('keydown', (evt) => {
    const isEscape = (evt.key === "Escape" || evt.key === "Esc");
    isEscape && hideModal();
  });
  
  if (!isModalEnabled()) {
    const codeSearchModal = createSpotlightModalNode();
    showModal(codeSearchModal);
    registerSpotlightModalListeners();
    loadConnectors();
    document.querySelector("#fs-code-search__filter input").focus();
  }
};

/**
 * Loads connector names.
 * Checks local storage if has them.
 * When not found, opens the filter in left nav and iterates through list 
 * and saves them in local storage and datastore.
 */
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

const createSpotlightModalNode = () => {
  hideModal();
  const modal = createModalNode();
  const spotlightContent = `
    <div class="fs-code-search">
      <section class="fs-code-search__header" id="fs-code-search__header">
        <div>
          <h3>Forge Spotlight</h3>
        </div>
        <div class="fs-code-search__connector">
          <h3> 
            <i id="fs-connector-sync" class="icon fa fa-refresh"></i>
            <span>Connector: [ ${currentConnector || "-"} ]</span>
          </h3>
          <span id="fs-connector-sync__message"></p>
        </div>
      </section>
      <br />
      <section class='fs-code-search__filter' id="fs-code-search__filter" >
        <div>
          <select>
            <option value='connectors'>Connectors</option>
            <option value='events'>Events</option>
            <option value='actions'>Actions</option>
            <option value='functions'>Functions</option>
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
        modalInfoMessage("Please select a connector by Ctrl+c to set connector option, enter a value in input box and press enter to see results", "error");
        return;
      }
      const searchText = fieldInput.value;
      const results = datastore[field] || [];
      const matchingResults = getMatchingResults(results, searchText);

      if (!matchingResults || matchingResults.length === 0) {
        modalInfoMessage("No matching results found meeting your request", "error");
        return;
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
            await openConnector(connector);
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

            await openSection(field);
            await openMethod(field, method);

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
      modalInfoMessage("Cannot find recent searches for events, actions, fucntions", "error");
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
        await openConnector(connector);
        await openSection(field);
        await openMethod(field, method);
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
  const modal = createModalNode();
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

const modalInfoMessage = (message, type) => {
  const ul = document.querySelector("#fs-code-search__list ul");
  ul.innerHTML = "";

  if (type == "error") {
    ul.innerHTML = `<li style="color: red; font-size:bold; text-align:center">${message}</li>`;
  }
  else if (type === "info") {
    ul.innerHTML = `<li style="color: #388e3c; font-size:bold; text-align:center;">${message}</li>`;
  } else {
    ul.innerHTML = `<li style="font-size:bold; text-align:center;">${message}</li>`;
  }
}




//========================== NAV HELPERS ==========================================//
/**
 * Opens a section
 * @param {*} section (events | functions | actions) 
 */
const openSection = async (section) => {
  return new Promise((resolve, reject) => {
    let sections =  document.querySelectorAll(".left-nav .left-nav-category");
    const selectedSection = sections[FIELD_SECTION_INDEX_MAPPING[section]];
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

/**
 * opens a section & loads a method.
 * @param {*} section  (events| actions| function)
 * @param {*} method 
 */
const openMethod = async (section , method) => {
  return new Promise((resolve, reject) => {
    let sections =  document.querySelectorAll(".left-nav .left-nav-category");
    const selectedSection = sections.item([FIELD_SECTION_INDEX_MAPPING[section]]);

    const methods = selectedSection.parentNode.children[1].querySelectorAll(".method-name");
    for(let methodIdx =0; methodIdx < methods.length; methodIdx++) {
      if(methods[methodIdx].innerHTML == method) {
        methods[methodIdx].click();
        break;
      }
    }

    // checks if editor section is loaded & has name of method.
    let count = 5;
    let codeLoadedInterval = null;
    const isCodeLoaded = () => {
      if (count <=0) {
        console.log("=== reached count exit ===");
        clearTimeout(codeLoadedInterval);
        codeLoadedInterval = undefined;
        resolve();
        return;
      }
      if (editorContainsText(method)) {
        console.log("=== reached clean resolve ===");
        clearTimeout(codeLoadedInterval);
        codeLoadedInterval = undefined;
        resolve();
      } else {
        console.log("=== reached wait ===");
        count--;
        codeLoadedInterval = setTimeout(isCodeLoaded, 200);
      }
    };
    codeLoadedInterval = setTimeout(isCodeLoaded, 200);
  });
};

/**
 * Iterates through list of channels and return names.
 * @param {*} connector 
 */
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

/**
 * Opens each section in left nav
 * Reads name of each function
 * Saves the method names in datastore.
 */
const recordConnectorInfo = async () => {
  let sections =  document.querySelectorAll(".left-nav .left-nav-category");
  if (sections && sections.length > 0) {
   for (let sectionIdx = 1; sectionIdx < sections.length-2; sectionIdx++) {
    const section  = getSectionNameFromIndex(sectionIdx);
     await openSection(section);
     const methods = getMethodsInSection(section);
     datastore[section] = methods;
   }
  }
 };
 
 /**
  * get methods in a section
  * @param {*} section (events | actions | functions)
  */
 const getMethodsInSection = (section) => {
  let sections =  document.querySelectorAll(".left-nav .left-nav-category");
  const sectionHtmlElem = sections.item(FIELD_SECTION_INDEX_MAPPING[section]);
   const parent = sectionHtmlElem.parentNode;
   const result = [];
   if (parent) {
     const sectionMethods =  parent.children[1].querySelectorAll(".method-name");
     sectionMethods.forEach(sectionMethd => {
       result.push(sectionMethd.innerHTML);
     });
   }
   return result;
 }
 
 /**
  * Clicks the opens filter section on the left nave and clicks the list item
  * @param {} connector (name of connector eg. marketo2_29)
  */
 const openConnector = (connector) => {
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
    let loadingModalClosedInterval = null;
    let isModalClosed = () => {
      const modalEnabled = isModalEnabled();
      if (!modalEnabled) {
        clearInterval(loadingModalClosedInterval);
        loadingModalClosedInterval = undefined;
        setTimeout(() => {
          resolve();
        }, 200);
      } else {
        clearInterval(loadingModalClosedInterval);
        loadingModalClosedInterval = setInterval(isModalClosed, 200);
      }
    };
    loadingModalClosedInterval = setInterval(isModalClosed, 200);
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

/**
 * Registers listeners for DOM  key events.
 */
document.addEventListener('keydown', (e) => {
  // ctrl + 1,
  if (e.ctrlKey && e.keyCode== 49) {
    showSpotlightModal();
  }

  console.log(e.keyCode);
   // ctrl + 
  if (e.ctrlKey && e.keyCode== 50) {
    console.log("==== reach here ===");
    showReferenceModal();
  }
  
  const selectField = (selectedOptionIdx) => {
    const field = document.querySelector("#fs-code-search__filter select");
    if (field) {
      field.selectedIndex = selectedOptionIdx;
    }
  };

  // ctrl + a, set action
  if (e.ctrlKey && e.keyCode == 65) {
    selectField(2);
  }

  // ctrl + e, set events
  else if (e.ctrlKey && e.keyCode == 69) {
    selectField(1);
  }
  // ctrl + f, set functions
  else if (e.ctrlKey && e.keyCode == 70) {
    selectField(3);
  }
  // ctrl + c, set connectors
  else if (e.ctrlKey && e.keyCode == 67) {
    selectField(0);
  }
});