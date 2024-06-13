// ==UserScript==
// @name         Batch Processor for BANCV
// @namespace    KrzysztofKruk-BANC
// @version      0.1
// @description  Batch processing segments in BANC
// @author       Krzysztof Kruk
// @match        https://spelunker.cave-explorer.org/*
// @grant        GM_xmlhttpRequest
// @updateURL    https://raw.githubusercontent.com/ChrisRaven/BANC-Batch-Processor/main/Batch-processor.user.js
// @downloadURL  https://raw.githubusercontent.com/ChrisRaven/BANC-Batch-Processor/main/Batch-processor.user.js
// @homepageURL  https://github.com/ChrisRaven/BANC-Batch-Processor
// ==/UserScript==

if (!document.getElementById('dock-script')) {
  let script = document.createElement('script')
  script.id = 'dock-script'
  script.src = typeof DEV !== 'undefined' ? 'http://127.0.0.1:5501/BANC-Dock/Dock.js' : 'https://chrisraven.github.io/BANC-Dock/Dock.js'
  document.head.appendChild(script)
}

let wait = setInterval(() => {
  if (unsafeWindow.dockIsReady) {
    clearInterval(wait)
    main()
  }
}, 100)


const batchProcessorOptions = [
  ['optgroup', 'Change color for'],
  ['visible', 'change-color-visible'],
  ['hidden', 'change-color-hidden'],
  ['all', 'change-color-all'],

  ['optgroup', 'Open in new tab'],
  ['visible', 'open-visible-in-new-tab'],
  ['hidden', 'open-hidden-in-new-tab'],

  ['optgroup', 'Remove'],
  ['visible', 'remove-visible'],
  ['hidden', 'remove-hidden'],

  ['optgroup', 'Copy'],
  ['visible', 'copy-visible'],
  ['hidden', 'copy-hidden']
]

function addActionsMenu() {
  const id = 'kk-utilities-action-menu'
  if (document.getElementById(id)) return

  const menu = document.createElement('select')
  menu.id = id
  menu.style.margin = '5px 10px 0'

  const defaultOption = new Option('-- actions --', ' ')
  defaultOption.selected = true
  defaultOption.disabled = true
  defaultOption.hidden = true
  menu.add(defaultOption)

  //const batchProcessorOptionsFromLS = Dock.ls.get('batch-processor-options')?.split(',')

  let optgroup
  let optionsCounter = -1
  batchProcessorOptions.forEach((option, i) => {
    if (option[0] === 'optgroup') {
      if (!optionsCounter) { // if all options from a group were hidden
        menu.lastElementChild.remove()
      }
      optgroup = document.createElement('optgroup')
      optgroup.label = option[1]
      menu.add(optgroup)
      optionsCounter = 0
    }
    else {
      optgroup.appendChild(new Option(option[0], option[1]))
      optionsCounter++
    }
  })

  const topBar = document.getElementsByClassName('neuroglancer-viewer-top-row')[0]
  const undoButton = document.getElementById('neuroglancer-undo-button')
  topBar.insertBefore(menu, undoButton)

  addActionsEvents()
}


function addActionsEvents() {
  const menu = document.getElementById('kk-utilities-action-menu')
  if (!menu) return

  menu.addEventListener('mousedown', e => {
    if (!e.ctrlKey) return

    e.preventDefault()

    Dock.dialog({
      id: 'batch-processor-option-selection',
      html: addActionsEvents.getHtml(),
      css: addActionsEvents.getCss(),
      okCallback: addActionsEvents.okCallback,
      okLabel: 'Save',
      cancelCallback: () => {},
      cancelLabel: 'Close'
    }).show()
  })

  menu.addEventListener('change', e => {
    actionsHandler(e)
    menu.selectedIndex = 0
  })
}

addActionsEvents.getHtml = function () {
  let html = '<table id="batch-processor-options-table">'
  const batchProcessorOptionsFromLS = Dock.ls.get('batch-processor-options')?.split(',')

  batchProcessorOptions.forEach(option => {
    if (option[0] === 'optgroup') {
      html += `<tr><td class="batch-processor-options-header">${option[1]}</td></tr>`
    }
    else {
      const checked = !batchProcessorOptionsFromLS || batchProcessorOptionsFromLS.includes(option[1])

      html += `<tr><td class="batch-processor-options-option" data-option="${option[1]}"><label><input type="checkbox" ${checked ? 'checked' : ''}>${option[0]}</label></td></tr>`
    }
  })

  html += '</table>'

  return html
}

addActionsEvents.getCss = function () {
  return /*css*/`
    #batch-processor-options-table {
      font-size: 12px;
    }

    .batch-processor-options-header {
      font-weight: bold;
      color: #aaa;
    }

    .batch-processor-options-option {
      padding-left: 10px;
    }

    #batch-processor-option-selection div.content {
      height: 85vh;
      overflow-y: auto;
    }
  `
}

addActionsEvents.okCallback = function () {
  const optionsSelector = '#batch-processor-options-table .batch-processor-options-option'

  const selectedOptions = []
  document.querySelectorAll(optionsSelector).forEach(option => {
    if (option.firstChild.firstChild.checked) {
      selectedOptions.push(option.dataset.option)
    }
  })

  Dock.ls.set('batch-processor-options', selectedOptions)
}


function actionsHandler(e) {
  const segments = document.getElementsByClassName('segment-div')
  /*
    .lightbulb.complete - completed and identified
    .lightbulb.unlabeled - completed, but not identified
    .lightbulb - normal
    .lightbulb.error.outdated - outdated
    .lightbulb.error - unknown
  */

  const all = []
  const identified = []
  const completed = []
  const normal = []
  const outdated = []
  const unknown = []
  const visible = []
  const hidden = []

  segments.forEach(segment => {
    all.push(segment)

    const lightbulb = segment.getElementsByClassName('nge-segment-changelog-button')[0]
    const checkbox = segment.getElementsByClassName('segment-checkbox')[0]

    if (!lightbulb) return

    if (lightbulb.classList.contains('unlabeled')) {
      completed.push(segment)
    }
    else if (lightbulb.classList.contains('complete')) {
      identified.push(segment)
    }
    else if (lightbulb.classList.contains('outdated')) {
      outdated.push(segment)
    }
    else if (lightbulb.classList.contains('error')) {
      unknown.push(segment)
    }
    else {
      normal.push(segment)
    }

    if (checkbox.checked) {
      visible.push(segment)
    }
    else {
      hidden.push(segment)
    }
  })


  switch (e.target.value) {
    case 'change-color-visible':
      changeColor(visible)
      break
    case 'change-color-all':
      changeColor(all)
      break

    case 'find-common-partners-visible':
      findCommon(visible)
      break

    case 'find-partners-visible': // DEV only
      findCommon(visible, true)
      break

    case 'show-neuropils-coverage-visible':
      showNeuropilsCoverage(visible)
      break
    case 'show-neuropils-coverage-all':
      showNeuropilsCoverage(all)
      break
    
    case 'show-statuses-and-labels-visible':
      showStatusesAndLabels(visible)
      break
    case 'show-statuses-and-labels-all':
      showStatusesAndLabels(all)
      break
    
    case 'get-synaptic-partners':
      getSynapticPartners(visible)
      break

    case 'show-identified-only':
      show(identified, segments)
      break
    case 'show-completed-only':
      show(completed, segments)
      break
    case 'show-incompleted-only':
      show(normal, segments)
      break
    case 'Show outdated-only':
      show(outdated, segments)
      break

    case 'hide-identified':
      hide(identified)
      break
    case 'hide-completed':
      hide(completed)
      break
    case 'hide-incompleted':
      hide(normal)
      break
    case 'hide-outdated':
      hide(outdated)
      break

    case 'open-identified-in-new-tab':
      openInNewTab(identified)
      break
    case 'open-completed-in-new-tab':
      openInNewTab(completed)
      break
    case 'open-incompleted-in-new-tab':
      openInNewTab(normal)
      break
    case 'open-outdated-in-new-tab':
      openInNewTab(outdated)
      break
    case 'open-visible-in-new-tab':
      openInNewTab(visible)
      break
    case 'open-hidden-in-new-tab':
      openInNewTab(hidden)
      break

    case 'remove-identified':
      remove(identified)
      break
    case 'remove-completed':
      remove(completed)
      break
    case 'remove-incompleted':
      remove(normal)
      break
    case 'remove-outdated':
      remove(outdated)
      break
    case 'remove-visible':
      remove(visible)
      break
    case 'remove-hidden':
      remove(hidden)
      break
    
    case 'copy-identified':
      copy(identified)
      break
    case 'copy-completed':
      copy(completed)
      break
    case 'copy-incompleted':
      copy(normal)
      break
    case 'copy-outdated':
      copy(outdated)
      break
    case 'copy-visible':
      copy(visible)
      break
    case 'copy-hidden':
      copy(hidden)
      break
  }
}

function hide(type) {
  type.forEach(segment => {
    const checkbox = segment.getElementsByClassName('segment-checkbox')[0]
    if (checkbox.checked) {
      checkbox.click()
    }
  })
}

function show(type, allSegments) {
  hideAll(allSegments)
  type.forEach(segment => {
    const checkbox = segment.getElementsByClassName('segment-checkbox')[0]
    if (!checkbox.checked) {
      checkbox.click()
    }
  })
}


function hideAll(segments) {
  segments.forEach(segment => {
    const checkbox = segment.getElementsByClassName('segment-checkbox')[0]
    if (checkbox.checked) {
      checkbox.click()
    }
  })
}

function openInNewTab(type) {
  const ids = type.map(segment => segment.getElementsByClassName('segment-button')[0].dataset.segId)

  if (!ids) return

  openSegmentsInNewTab(ids)
}


function openSegmentsInNewTab(ids) {

  function prepareState(ids) {
    const state = viewer.saver.pull()

    state.state.layers.forEach(layer => {
      if (layer.type !== 'segmentation_with_graph') return

      layer.segments = ids
      layer.hiddenSegments = []
    })

    return state
  }

  function addToLS(state) {
    const stateId = Dock.getRandomHexString()
    const stateKey = 'neuroglancerSaveState_v2'
    const lsName = stateKey + '-' + stateId
    
    // Source: neuroglancer/save_state/savet_state.ts -> SaveState -> robustSet()
    while (true) {
      try {
        localStorage.setItem(lsName, JSON.stringify(state))
        let stateManager = localStorage.getItem(stateKey)
        if (stateManager) {
          stateManager = JSON.parse(stateManager)
          stateManager.push(stateId)
          localStorage.setItem(stateKey, JSON.stringify(stateManager))
        }
        break
      }
      catch (e) {
        const manager = JSON.parse(localStorage.getItem(stateKey))
        if (!manager.length) throw e

        const targets = manager.splice(0, 1);
        const serializedManager = JSON.stringify(manager)
        localStorage.setItem(stateKey, serializedManager)
        targets.forEach(key => localStorage.removeItem(`${stateKey}-${key}`))
      }
    }

    return stateId
  }

  function openInNewTab(stateId) {
    const url = new URL(unsafeWindow.location.href)

    unsafeWindow.open(url.origin + '/?local_id=' + stateId, '_blank')
  }

  const newState = prepareState(ids)
  const stateId = addToLS(newState)
  openInNewTab(stateId)
}

function remove(type) {
  type.forEach(segment => segment.getElementsByClassName('segment-button')[0].click())
}

function copy(type) {
  const ids = type.map(segment => segment.getElementsByClassName('segment-button')[0].dataset.segId)

  navigator.clipboard.writeText(ids.join('\r\n'))
}

function changeColor(type) {
  const colorSelectors = type.map(segment => segment.getElementsByClassName('segment-color-selector')[0])
  const previousColors = colorSelectors.map(selector => selector.value)
  let pickr

  Dock.dialog({
    id: 'kk-change-color-dialog',
    html: '<input id="kk-change-color-selector" />',
    okCallback: okCallback,
    okLabel: 'Change',
    cancelCallback: () => {},
    cancelLabel: 'Cancel',
    afterCreateCallback: afterCreateCallback,
    width: 228,
    destroyAfterClosing: true
  }).show()

  function okCallback() {
    const newColorArray = pickr.getColor().toRGBA()
    let newColor = '#'
    
    for (let i = 0; i <= 2; i++) {
      let colorComponent = Math.round(newColorArray[i]).toString(16)
      if (colorComponent.length < 2) {
        colorComponent = '0' + colorComponent
      }
      newColor += colorComponent
    }

    colorSelectors.forEach(selector => {
      selector.value = newColor
      const event = new Event('change')
      selector.dispatchEvent(event)
    })

    viewer.layerManager.layersChanged.dispatch()
  }

  function afterCreateCallback() {
    pickr = Pickr.create({
      el: '#kk-change-color-selector',
      theme: 'nano',
      showAlways: true,
      inline: true,
      default: previousColors[0],
      defaultRepresentation: 'HEX',
      position: 'top-middle',
      components: {
        palette: false,
        preview: true,
        hue: true,
        interaction: {
          input: true
        }
      }
    })
    document.getElementsByClassName('pickr')[0].style.display = 'none'
  }
}



function main() {
  //addPickr()
  addActionsMenu()
  Dock.getPartnersOfCommon = getPartnersOfCommon
}
