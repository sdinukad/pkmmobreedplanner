// File: script.js
document.addEventListener('DOMContentLoaded', (event) => {
    // --- Constants ---
    const ivMap = ['HP', 'Atk', 'Def', 'SpA', 'SpD', 'Spe'];
    const natures = [ 'Adamant', 'Bashful', 'Bold', 'Brave', 'Calm', 'Careful', 'Docile', 'Gentle', 'Hardy', 'Hasty', 'Impish', 'Jolly', 'Lax', 'Lonely', 'Mild', 'Modest', 'Naive', 'Naughty', 'Quiet', 'Quirky', 'Rash', 'Relaxed', 'Sassy', 'Serious', 'Timid'];
    const braceMap = { HP: 'Power Weight', Atk: 'Power Bracer', Def: 'Power Band', SpA: 'Power Lens', SpD: 'Power Lens', Spe: 'Power Anklet' };
    const EVERSTONE_NAME = 'Everstone';
    const BRACE_COST = 10000;
    const DEFAULT_EVERSTONE_COST = 5000;
    const GENDER_COST = 5000; // Default gender fee
    const MIN_ZOOM = 0.2; const MAX_ZOOM = 3.0; const ZOOM_SENSITIVITY = 0.005;

    // --- DOM Elements ---
    const bodyElement = document.body;
    const generateButton = document.getElementById('generate-button');
    const treeViewport = document.getElementById('tree-viewport');
    const treeOutput = document.getElementById('tree-output');
    const breedingTreeSection = document.getElementById('breeding-plan-section');
    const errorOutput = document.getElementById('error-output');
    const totalCostValue = document.getElementById('total-cost-value');
    const ivCheckboxes = document.querySelectorAll('input[name="iv"]');
    const natureSelect = document.getElementById('nature-select');
    const everstoneCostInput = document.getElementById('everstone-cost');
    const genderCostDisplay = document.getElementById('gender-cost-display');
    const themeCheckbox = document.getElementById('theme-checkbox');
    const expandAllButton = document.getElementById('expand-all-button'); // Added
    const collapseAllButton = document.getElementById('collapse-all-button'); // Added
    // const treeControlsContainer = document.getElementById('tree-controls-container'); // Ref optional

    // --- State ---
    let breedingData = {}; let nodeIdCounter = 0; let rootNodeId = null;
    let currentEverstoneCost = DEFAULT_EVERSTONE_COST;
    let isPanning = false; let startX, startY; let currentX = 0, currentY = 0; let currentScale = 1.0;

    // --- Initialization ---
    function initialize() { populateNatureDropdown(); everstoneCostInput.value = DEFAULT_EVERSTONE_COST; genderCostDisplay.textContent = GENDER_COST.toLocaleString(); setupEventListeners(); applyInitialTheme(); }
    function populateNatureDropdown() { natures.sort().forEach(n=>{const o=document.createElement('option');o.value=n;o.textContent=n;natureSelect.appendChild(o);}); }
    function applyInitialTheme() { const sT=localStorage.getItem('theme')||'light';setTheme(sT);themeCheckbox.checked=(sT==='dark'); }
    function setTheme(theme) { bodyElement.setAttribute('data-theme',theme);localStorage.setItem('theme',theme); }

    function setupEventListeners() { // Added listeners for new buttons
        generateButton.addEventListener('click', handleGenerateTree);
        themeCheckbox.addEventListener('change', handleThemeChange);
        expandAllButton.addEventListener('click', handleExpandAll);
        collapseAllButton.addEventListener('click', handleCollapseAll);
        treeOutput.addEventListener('click', handleTreeInteraction);
        treeOutput.addEventListener('change', handleTreeDataChange);
        treeViewport.addEventListener('wheel', handleWheelZoom, { passive: false });
        treeViewport.addEventListener('mousedown', handlePanStart); treeViewport.addEventListener('mousemove', handlePanMove); treeViewport.addEventListener('mouseup', handlePanEnd); treeViewport.addEventListener('mouseleave', handlePanEnd);
        treeViewport.addEventListener('touchstart', handlePanStart, { passive: false }); treeViewport.addEventListener('touchmove', handlePanMove, { passive: false }); treeViewport.addEventListener('touchend', handlePanEnd); treeViewport.addEventListener('touchcancel', handlePanEnd);
    }

    // --- Theme Handling ---
    function handleThemeChange() { setTheme(themeCheckbox.checked ? 'dark' : 'light'); }

    // --- Zoom/Pan Handlers ---
    function getEventCoordinates(event) { if(event.touches){return{x:event.touches[0].clientX,y:event.touches[0].clientY};}return{x:event.clientX,y:event.clientY}; }
    function handleWheelZoom(event) { event.preventDefault();const r=treeViewport.getBoundingClientRect();const mX=event.clientX-r.left;const mY=event.clientY-r.top;const oX=(mX-currentX)/currentScale;const oY=(mY-currentY)/currentScale;let nS=currentScale*Math.exp(-event.deltaY*ZOOM_SENSITIVITY);nS=Math.min(Math.max(nS,MIN_ZOOM),MAX_ZOOM);currentX=mX-oX*nS;currentY=mY-oY*nS;currentScale=nS;updateTransform(); }
    function handlePanStart(event) { const tE=event.target;if(tE.closest('.node-name-input, .node-actions button, .gender-toggle, .collapse-toggle')){isPanning=false;return;}if(event.type==='mousedown'&&event.button!==0)return;event.preventDefault();isPanning=true;const c=getEventCoordinates(event);startX=c.x-currentX;startY=c.y-currentY;treeViewport.style.cursor='grabbing';treeViewport.style.userSelect='none'; }
    function handlePanMove(event) { if(!isPanning)return;event.preventDefault();const c=getEventCoordinates(event);currentX=c.x-startX;currentY=c.y-startY;updateTransform(); }
    function handlePanEnd(event) { if(!isPanning)return;isPanning=false;treeViewport.style.cursor='grab';treeViewport.style.removeProperty('user-select'); }
    function updateTransform() { treeOutput.style.transform = `translate(${currentX}px, ${currentY}px) scale(${currentScale})`; }
    function resetTransform() { currentX=0;currentY=0;currentScale=1.0;updateTransform(); }


    // --- Event Handlers & Core Logic ---

    function handleGenerateTree() {
        currentEverstoneCost = parseInt(everstoneCostInput.value, 10) || 0; if (currentEverstoneCost < 0) currentEverstoneCost = 0;
        const desiredIvs = Array.from(ivCheckboxes).filter(cb => cb.checked).map(cb => cb.value); const desiredNature = natureSelect.value; let targetAttributes = [...desiredIvs]; if (desiredNature) targetAttributes.push("Nature");
        breedingData = {}; nodeIdCounter = 0; rootNodeId = null; treeOutput.innerHTML = ''; errorOutput.textContent = ''; breedingTreeSection.style.display = 'none'; totalCostValue.textContent = '¥0'; resetTransform();
        if (targetAttributes.length < 1) { errorOutput.textContent = 'Select attributes.'; return; }
        try {
            targetAttributes.sort((a, b) => (a === "Nature" ? 1 : b === "Nature" ? -1 : ivMap.indexOf(a) - ivMap.indexOf(b)));
            const rootNode = generateBreedingDataNode(targetAttributes); // Nodes start collapsed
            rootNodeId = rootNode.id;
            if (breedingData[rootNodeId]) { breedingData[rootNodeId].isCollapsed = false; } // Expand root
            calculateAllCosts(rootNodeId);
            renderTree(); // Render the tree
            updateTotalDisplay();
            breedingTreeSection.style.display = 'block';
            // Use timeout to allow browser to render before calculating dimensions
            setTimeout(centerTreeInViewport, 0); // Center after initial render allows dimensions calculation
        } catch (e) { console.error(e); errorOutput.textContent = `Error: ${e.message}.`; }
    }

    // --- Expand/Collapse All Handlers (MODIFIED for centering) ---
    function handleExpandAll() {
        if (!rootNodeId) return;
        let changed = false;
        Object.values(breedingData).forEach(node => {
            if (node.isCollapsed) { node.isCollapsed = false; changed = true; }
        });
        if (changed) {
            renderTree(); // Re-render first
            // Use timeout to allow rendering before centering
             setTimeout(centerTreeInViewport, 0);
        }
    }
    function handleCollapseAll() {
        if (!rootNodeId) return;
        let changed = false;
        Object.values(breedingData).forEach(node => {
            if (!node.isBase && node.id !== rootNodeId && !node.isCollapsed) { node.isCollapsed = true; changed = true; }
            if (node.id === rootNodeId && node.isCollapsed) { node.isCollapsed = false; changed = true; } // Ensure root stays expanded
        });
         if (changed) {
            renderTree(); // Re-render first
            // Use timeout to allow rendering before centering
            setTimeout(centerTreeInViewport, 0);
         }
    }
    // -----------------------------------------


    // --- Delegated Event Handlers ---
    function handleTreeInteraction(event) {
         const target = event.target; const nodeLi = target.closest('li'); const wrapper = target.closest('.node-wrapper'); const nodeId = nodeLi?.dataset.nodeId || wrapper?.dataset.nodeId; if (!nodeId) return;
         if (target.classList.contains('set-cost-button')) handleSetCost(nodeId);
         else if (target.classList.contains('clear-override-button')) handleClearOverride(nodeId);
         else if (target.classList.contains('gender-toggle')) handleGenderChange(nodeId);
         else if (target.classList.contains('set-gender-cost-button')) handleSetGenderCost(nodeId);
         else if (target.classList.contains('clear-gender-cost-button')) handleClearGenderCost(nodeId);
         else if (target.classList.contains('collapse-toggle')) handleCollapseToggle(nodeId);
    }
    function handleTreeDataChange(event) { const t=event.target;const w=t.closest('.node-wrapper');const nId=w?.dataset.nodeId;if(!nId)return;if(t.classList.contains('node-name-input'))handleNameChange(nId, t.value); }

    // --- Individual Action Handlers ---
    function handleCollapseToggle(nodeId) { const n=breedingData[nodeId];if(!n||n.isBase)return;n.isCollapsed=!n.isCollapsed;renderSingleNode(nodeId);}
    function handleSetCost(nodeId) { const n=breedingData[nodeId];if(!n)return;const c=n.overrideCost>0?n.overrideCost:(n.calculatedCost||0);const i=prompt(`Set acquisition cost for: ${n.name}`,c);if(i!==null){const cost=parseInt(i,10);if(!isNaN(cost)&&cost>=0)n.overrideCost=cost;else if(i!=="")alert("Invalid cost.");else n.overrideCost=0;updateAndRecalculate();} }
    function handleClearOverride(nodeId) { const n=breedingData[nodeId];if(!n)return;n.overrideCost=0;updateAndRecalculate();}
    function handleNameChange(nodeId, newName) { const n=breedingData[nodeId];if(!n)return;n.name=newName.trim()||generateDefaultName(n);n.isNameCustom=true;const uIds=propagateNameToOffspring(nodeId);renderSingleNode(nodeId);if(uIds&&uIds.length>0)uIds.forEach(id=>renderSingleNode(id)); }
    function handleGenderChange(nodeId) { const n=breedingData[nodeId];if(!n)return;n.gender=(n.gender==='M')?'F':'M'; if(!n.isNameCustom)n.name=generateDefaultName(n);let sId=null; for(const cId in breedingData){const c=breedingData[cId];let curSId=null;if(c.parent1Id===nodeId)curSId=c.parent2Id;else if(c.parent2Id===nodeId)curSId=c.parent1Id;if(curSId){sId=curSId;adjustSiblingGender(sId,n.gender);break;}} propagateNameToOffspring(nodeId); renderTree(); updateTotalDisplay(); }
    function handleSetGenderCost(nodeId) { const n=breedingData[nodeId];if(!n||n.isBase)return;const c=(n.customGenderCost!==null&&n.customGenderCost>=0)?n.customGenderCost:GENDER_COST;const i=prompt(`Set custom gender fee for step creating ${n.name} (Default: ¥${GENDER_COST.toLocaleString()}). Blank/0 for default.`,c);if(i!==null){const cost=parseInt(i,10);if(!isNaN(cost)&&cost>=0)n.customGenderCost=cost;else if(i.trim()==="")n.customGenderCost=null;else{alert("Invalid cost.");return;}updateAndRecalculate();} }
    function handleClearGenderCost(nodeId) { const n=breedingData[nodeId];if(!n||n.isBase)return;n.customGenderCost=null;updateAndRecalculate();}


    // --- Data Modifying Helpers ---
    function adjustSiblingGender(siblingId, changedParentGender) { const s=breedingData[siblingId];if(!s)return null;const reqG=(changedParentGender==='M')?'F':'M';let dUFS=null;if(s.gender!==reqG){s.gender=reqG;if(!s.isNameCustom)s.name=generateDefaultName(s);dUFS=propagateNameToOffspring(siblingId);}return dUFS;}
    function propagateNameToOffspring(parentId) { const pN=breedingData[parentId];if(!pN||pN.gender!=='F')return[];let uNIB=[];for(const cId in breedingData){const cN=breedingData[cId];let iFP=false;if(cN.parent1Id===parentId&&pN.gender==='F')iFP=true;else if(cN.parent2Id===parentId&&pN.gender==='F')iFP=true;if(iFP&&!cN.isNameCustom){if(cN.name!==pN.name){cN.name=pN.name;uNIB.push(cId);const fU=propagateNameToOffspring(cId);if(fU.length>0)uNIB=uNIB.concat(fU);}break;}if(cN.parent1Id===parentId||cN.parent2Id===parentId)break;}return uNIB;}
    function updateAndRecalculate() { if(rootNodeId){calculateAllCosts(rootNodeId);renderTree();updateTotalDisplay();} }

    // --- Helper Functions ---
    function findChildNodeId(parentId) { for(const nId in breedingData){const n=breedingData[nId];if(n.parent1Id===parentId||n.parent2Id===parentId)return nId;}return null;}
    function getItemForParentInNextStep(parentId) { const cId=findChildNodeId(parentId);if(!cId)return null;const cN=breedingData[cId];if(cN.parent1Id===parentId)return cN.item1;if(cN.parent2Id===parentId)return cN.item2;return null;}
    function getItemColorClass(itemName) { if(!itemName)return"";if(itemName===EVERSTONE_NAME)return"item-everstone";const cN=itemName.replace(/\s+/g,'.');return`item-${cN}`;}
    function getStatColorClass(statName) { if(!statName)return"";const cS=statName.toLowerCase().replace('.','');return`stat-${cS}`;}
    function generateDefaultName(node) { const i=node.targetAttributes.filter(a=>a!=="Nature");const h=node.targetAttributes.includes("Nature");let n="";if(i.length>0)n+=`${i.length}x31`;if(h)n+=(n?"+":"")+"Nature";n+=` ${node.gender||'?'}`;return n||"Base";}

    // --- Data Generation ---
    function generateBreedingDataNode(targetAttributes) { // Default isCollapsed: true
        const id=`node-${nodeIdCounter++}`;const iB=targetAttributes.length===1;const dG=iB?'F':'?';let i1=null,i2=null,sIC=0;if(!iB){const nA=targetAttributes.length;const a1=targetAttributes[nA-1];const a2=targetAttributes[nA-2];i1=(a1==="Nature")?EVERSTONE_NAME:braceMap[a1];i2=(a2==="Nature")?EVERSTONE_NAME:braceMap[a2];sIC+=(i1===EVERSTONE_NAME?currentEverstoneCost:BRACE_COST);sIC+=(i2===EVERSTONE_NAME?currentEverstoneCost:BRACE_COST);}
        const node={id:id,targetAttributes:targetAttributes,isBase:iB,parent1Id:null,parent2Id:null,item1:i1,item2:i2,itemCost:sIC,customGenderCost:null,overrideCost:0,calculatedCost:0,displayCost:0,gender:dG,name:"",isNameCustom:false,isCollapsed:true};breedingData[id]=node;if(iB){node.name=generateDefaultName(node);return node;}const nA=targetAttributes.length;const a1=targetAttributes[nA-1];const a2=targetAttributes[nA-2];const sA=targetAttributes.filter(a=>a!==a1&&a!==a2);const p1A=[...sA,a1].sort((a,b)=>targetAttributes.indexOf(a)-targetAttributes.indexOf(b));const p2A=[...sA,a2].sort((a,b)=>targetAttributes.indexOf(a)-targetAttributes.indexOf(b));const p1N=generateBreedingDataNode(p1A);const p2N=generateBreedingDataNode(p2A);node.parent1Id=p1N.id;node.parent2Id=p2N.id;if(breedingData[node.parent1Id]&&breedingData[node.parent2Id]){breedingData[node.parent1Id].gender='F';breedingData[node.parent2Id].gender='M';if(!breedingData[node.parent1Id].isNameCustom)breedingData[node.parent1Id].name=generateDefaultName(breedingData[node.parent1Id]);if(!breedingData[node.parent2Id].isNameCustom)breedingData[node.parent2Id].name=generateDefaultName(breedingData[node.parent2Id]);}node.gender='F';node.name=generateDefaultName(node);return node;}

    // --- Cost Calculation ---
    function calculateAllCosts(nodeId) { const n=breedingData[nodeId];if(!n)return 0;if(n.isBase){n.calculatedCost=0;n.displayCost=n.overrideCost>0?n.overrideCost:0;return n.displayCost;}const c1=calculateAllCosts(n.parent1Id);const c2=calculateAllCosts(n.parent2Id);const eGC=(n.customGenderCost!==null&&n.customGenderCost>=0)?n.customGenderCost:GENDER_COST;n.calculatedCost=c1+c2+n.itemCost+eGC;n.displayCost=(n.overrideCost>0)?n.overrideCost:n.calculatedCost;return n.displayCost;}

    // --- HTML Rendering ---
    function renderTree() { if (rootNodeId) treeOutput.innerHTML = `<ul>${renderNodeHtml(rootNodeId)}</ul>`; else treeOutput.innerHTML = ''; }
    function renderSingleNode(nodeId) { // Used for name changes and collapse toggle
        const node = breedingData[nodeId]; if(!node) return;
        const liElement = document.querySelector(`li[data-node-id="${nodeId}"]`); // Target the LI
        const wrapperElement = liElement?.querySelector(`.node-wrapper[data-node-id="${nodeId}"]`); // Find wrapper inside LI
        if(liElement && wrapperElement){
            const a=document.activeElement; const f=wrapperElement.contains(a)||liElement.contains(a); let sS,sE; if(f&&a.tagName==='INPUT'&&a.classList.contains('node-name-input')){sS=a.selectionStart;sE=a.selectionEnd;}
            wrapperElement.innerHTML=generateNodeInnerHtml(node); // Update wrapper content
            liElement.className=node.isCollapsed?'collapsed':''; // Update LI class for collapse state
            if(f){const i=wrapperElement.querySelector('.node-name-input');if(i&&typeof sS!=='undefined'){i.focus();try{i.setSelectionRange(sS,sE);}catch(e){}}else if(a?.focus){try{a.focus();}catch(e){}}}
        } else { renderTree(); } // Fallback if elements not found
    }
    // Generates the inner HTML content for the .node-wrapper div
    function generateNodeInnerHtml(node) { const ivs = node.targetAttributes.filter(a => a !== "Nature"); const hN = node.targetAttributes.includes("Nature"); let tDH = ""; ivs.forEach((iv, idx) => { tDH += `<span class="${getStatColorClass(iv)}">${iv}</span>` + (idx < ivs.length - 1 ? ', ' : ''); }); if (hN) tDH += (ivs.length > 0 ? " + " : "") + `<span class="${getStatColorClass('Nature')}">Nature</span>`; if (!tDH) tDH = "Base"; const nI = getItemForParentInNextStep(node.id); let nSH = ''; if (nI) { const iCC = getItemColorClass(nI); nSH = `<span class="node-next-step">Hold <span class="${iCC}">${nI}</span></span>`; } let cDH = ''; let pCBH = ''; if (node.overrideCost > 0) { cDH = `<span class="override-label">Pokémon Value:</span> <span class="cost-value">¥${node.overrideCost.toLocaleString()}</span>`; pCBH = `<button class="clear-override-button" data-node-id="${node.id}">Clear Value</button>`; } else { cDH = `Calculated Total Cost: <span class="cost-value">¥${node.calculatedCost.toLocaleString()}</span>`; pCBH = `<button class="set-cost-button" data-node-id="${node.id}">Set Value</button>`; } let gCBH = ''; if (!node.isBase) { if (node.customGenderCost !== null && node.customGenderCost >= 0) { gCBH = `<button class="clear-gender-cost-button" data-node-id="${node.id}">Clear Gender Cost (Set: ¥${node.customGenderCost.toLocaleString()})</button>`; } else { gCBH = `<button class="set-gender-cost-button" data-node-id="${node.id}">Set Gender Cost</button>`; } } const gS = node.gender === 'M' ? '♂' : '♀'; const gC = node.gender === 'M' ? 'male' : 'female'; const sN = node.name; let cTH = ''; if (!node.isBase) { const tS = node.isCollapsed ? '➕' : '➖'; cTH = `<span class="collapse-toggle" title="Toggle Children" data-node-id="${node.id}">${tS}</span>`; } return `<div class="node-content"><div class="node-info"><div class="node-header">${cTH}<input type="text" class="node-name-input" value="${sN}" placeholder="Enter Name" data-node-id="${node.id}"><span class="gender-toggle ${gC}" title="Toggle Gender" data-node-id="${node.id}">${gS}</span></div><span class="node-target">${tDH}</span>${nSH}<span class="node-cost-display">${cDH}</span></div><div class="node-actions">${pCBH}${gCBH}</div></div>`;}
    // Generates the LI wrapper, node wrapper, calls innerHTML gen, and adds children UL
    function renderNodeHtml(nodeId) { const n=breedingData[nodeId];if(!n)return '';let cH='';if(!n.isBase){const p1H=renderNodeHtml(n.parent1Id);const p2H=renderNodeHtml(n.parent2Id);cH=`<ul>${p1H}${p2H}</ul>`;}const cC=n.isCollapsed?'collapsed':'';return`<li data-node-id="${nodeId}" class="${cC}"><div class="node-wrapper" data-node-id="${n.id}">${generateNodeInnerHtml(n)}</div>${cH}</li>`;}

    function updateTotalDisplay() { if(rootNodeId&&breedingData[rootNodeId])totalCostValue.textContent=`¥${breedingData[rootNodeId].displayCost.toLocaleString()}`;else totalCostValue.textContent=`¥0`; }

    // --- NEW Center Tree Function ---
    function centerTreeInViewport() {
        if (!rootNodeId || !treeOutput.firstChild) return; // No tree to center

        const viewportWidth = treeViewport.clientWidth;
        const viewportHeight = treeViewport.clientHeight;

        // Use offsetWidth/offsetHeight as getBoundingClientRect() includes transforms
        const treeContentWidth = treeOutput.offsetWidth;
        const treeContentHeight = treeOutput.offsetHeight;

        // Calculate the scaled dimensions
        const scaledTreeWidth = treeContentWidth * currentScale;
        const scaledTreeHeight = treeContentHeight * currentScale;

        // Calculate desired top-left corner (currentX, currentY) to center the content
        let targetX = (viewportWidth - scaledTreeWidth) / 2;
        let targetY = (viewportHeight - scaledTreeHeight) / 2;

        // Optional: Clamp targetX/Y to prevent excessive whitespace if tree is smaller than viewport
        // Ensure left edge isn't shifted right past viewport edge when zoomed out
        targetX = Math.min(targetX, 0);
        // Ensure top edge isn't shifted down past viewport edge when zoomed out
        targetY = Math.min(targetY, 0);
        // Prevent right edge from moving left of viewport edge if tree is wider
        targetX = Math.max(targetX, viewportWidth - scaledTreeWidth);
        // Prevent bottom edge from moving above viewport edge if tree is taller
        targetY = Math.max(targetY, viewportHeight - scaledTreeHeight);


        // Apply directly for now (consider smooth transition later if desired)
        currentX = targetX;
        currentY = targetY;
        updateTransform();
    }

    // --- Run Initialization ---
    initialize();

}); // End DOMContentLoaded
