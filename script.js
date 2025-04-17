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

    // --- State ---
    let breedingData = {}; let nodeIdCounter = 0; let rootNodeId = null;
    let currentEverstoneCost = DEFAULT_EVERSTONE_COST;
    let isPanning = false; let startX, startY; let currentX = 0, currentY = 0; let currentScale = 1.0;

    // --- Initialization ---
    function initialize() { /* (Same as before) */ populateNatureDropdown(); everstoneCostInput.value = DEFAULT_EVERSTONE_COST; genderCostDisplay.textContent = GENDER_COST.toLocaleString(); setupEventListeners(); applyInitialTheme(); }
    function populateNatureDropdown() { /* (Same) */ natures.sort().forEach(n=>{const o=document.createElement('option');o.value=n;o.textContent=n;natureSelect.appendChild(o);}); }
    function applyInitialTheme() { /* (Same) */ const sT=localStorage.getItem('theme')||'light';setTheme(sT);themeCheckbox.checked=(sT==='dark'); }
    function setTheme(theme) { /* (Same) */ bodyElement.setAttribute('data-theme',theme);localStorage.setItem('theme',theme); }

    function setupEventListeners() {
        generateButton.addEventListener('click', handleGenerateTree);
        themeCheckbox.addEventListener('change', handleThemeChange);
        treeOutput.addEventListener('click', handleTreeInteraction); // Delegated click
        treeOutput.addEventListener('change', handleTreeDataChange); // Delegated change
        treeViewport.addEventListener('wheel', handleWheelZoom, { passive: false });
        treeViewport.addEventListener('mousedown', handlePanStart); treeViewport.addEventListener('mousemove', handlePanMove); treeViewport.addEventListener('mouseup', handlePanEnd); treeViewport.addEventListener('mouseleave', handlePanEnd);
        treeViewport.addEventListener('touchstart', handlePanStart, { passive: false }); treeViewport.addEventListener('touchmove', handlePanMove, { passive: false }); treeViewport.addEventListener('touchend', handlePanEnd); treeViewport.addEventListener('touchcancel', handlePanEnd);
    }

    // --- Theme Handling --- (Same as before)
    function handleThemeChange() { setTheme(themeCheckbox.checked ? 'dark' : 'light'); }

    // --- Zoom/Pan Handlers --- (Same as before)
    function getEventCoordinates(event) { if(event.touches){return{x:event.touches[0].clientX,y:event.touches[0].clientY};}return{x:event.clientX,y:event.clientY}; }
    function handleWheelZoom(event) { event.preventDefault();const r=treeViewport.getBoundingClientRect();const mX=event.clientX-r.left;const mY=event.clientY-r.top;const oX=(mX-currentX)/currentScale;const oY=(mY-currentY)/currentScale;let nS=currentScale*Math.exp(-event.deltaY*ZOOM_SENSITIVITY);nS=Math.min(Math.max(nS,MIN_ZOOM),MAX_ZOOM);currentX=mX-oX*nS;currentY=mY-oY*nS;currentScale=nS;updateTransform(); }
    function handlePanStart(event) { const tE=event.target;if(tE.closest('.node-name-input, .node-actions button, .gender-toggle')){isPanning=false;return;}if(event.type==='mousedown'&&event.button!==0)return;event.preventDefault();isPanning=true;const c=getEventCoordinates(event);startX=c.x-currentX;startY=c.y-currentY;treeViewport.style.cursor='grabbing';treeViewport.style.userSelect='none'; }
    function handlePanMove(event) { if(!isPanning)return;event.preventDefault();const c=getEventCoordinates(event);currentX=c.x-startX;currentY=c.y-startY;updateTransform(); }
    function handlePanEnd(event) { if(!isPanning)return;isPanning=false;treeViewport.style.cursor='grab';treeViewport.style.removeProperty('user-select'); }
    function updateTransform() { treeOutput.style.transform = `translate(${currentX}px, ${currentY}px) scale(${currentScale})`; }
    function resetTransform() { currentX=0;currentY=0;currentScale=1.0;updateTransform(); }


    // --- Event Handlers & Core Logic ---

    function handleGenerateTree() { /* (Reads currentEverstoneCost) */
        currentEverstoneCost = parseInt(everstoneCostInput.value, 10) || 0; if (currentEverstoneCost < 0) currentEverstoneCost = 0;
        const desiredIvs = Array.from(ivCheckboxes).filter(cb => cb.checked).map(cb => cb.value); const desiredNature = natureSelect.value; let targetAttributes = [...desiredIvs]; if (desiredNature) targetAttributes.push("Nature");
        breedingData = {}; nodeIdCounter = 0; rootNodeId = null; treeOutput.innerHTML = ''; errorOutput.textContent = ''; breedingTreeSection.style.display = 'none'; totalCostValue.textContent = '¥0'; resetTransform();
        if (targetAttributes.length < 1) { errorOutput.textContent = 'Select attributes.'; return; }
        try { targetAttributes.sort((a, b) => (a === "Nature" ? 1 : b === "Nature" ? -1 : ivMap.indexOf(a) - ivMap.indexOf(b))); const rootNode = generateBreedingDataNode(targetAttributes); rootNodeId = rootNode.id; calculateAllCosts(rootNodeId); renderTree(); updateTotalDisplay(); breedingTreeSection.style.display = 'block'; }
        catch (e) { console.error(e); errorOutput.textContent = `Error: ${e.message}.`; }
    }

    // Delegated handlers
    function handleTreeInteraction(event) {
         const target = event.target; const nodeLi = target.closest('li'); const wrapper = target.closest('.node-wrapper'); const nodeId = nodeLi?.dataset.nodeId || wrapper?.dataset.nodeId; if (!nodeId) return;
         if (target.classList.contains('set-cost-button')) handleSetCost(nodeId);
         else if (target.classList.contains('clear-override-button')) handleClearOverride(nodeId);
         else if (target.classList.contains('gender-toggle')) handleGenderChange(nodeId);
         // --- NEW Gender Cost Button Handlers ---
         else if (target.classList.contains('set-gender-cost-button')) handleSetGenderCost(nodeId);
         else if (target.classList.contains('clear-gender-cost-button')) handleClearGenderCost(nodeId);
    }
    function handleTreeDataChange(event) { /* (Same) */ const t=event.target;const w=t.closest('.node-wrapper');const nId=w?.dataset.nodeId;if(!nId)return;if(t.classList.contains('node-name-input'))handleNameChange(nId, t.value); }


    function handleSetCost(nodeId) { /* (Same) */ const n=breedingData[nodeId];if(!n)return;const c=n.overrideCost>0?n.overrideCost:(n.calculatedCost||0);const i=prompt(`Set acquisition cost for: ${n.name}`,c);if(i!==null){const cost=parseInt(i,10);if(!isNaN(cost)&&cost>=0)n.overrideCost=cost;else if(i!=="")alert("Invalid cost.");else n.overrideCost=0;updateAndRecalculate();} }
    function handleClearOverride(nodeId) { /* (Same) */ const n=breedingData[nodeId];if(!n)return;n.overrideCost=0;updateAndRecalculate();}
    // UPDATED: Handles name changes and triggers targeted re-renders including propagated names
    function handleNameChange(nodeId, newName) {
        const node = breedingData[nodeId];
        if (!node) return;
        // console.log(`Name change start for ${nodeId}: "${newName}"`); // Debug

        node.name = newName.trim() || generateDefaultName(node); // Update data model
        node.isNameCustom = true;

        // Propagate the name down and get IDs of all descendants updated
        const updatedDescendantIds = propagateNameToOffspring(nodeId);
        // console.log(`Propagation from ${nodeId} updated descendants:`, updatedDescendantIds); // Debug

        // Render the node that was directly edited
        renderSingleNode(nodeId);

        // Render any descendants whose names changed due to propagation
        if (updatedDescendantIds && updatedDescendantIds.length > 0) {
            updatedDescendantIds.forEach(id => renderSingleNode(id));
        }
         // console.log(`Name change end for ${nodeId}`); // Debug
    }
    function handleGenderChange(nodeId) { /* (Same - Calls renderTree) */ const n=breedingData[nodeId];if(!n)return;n.gender=(n.gender==='M')?'F':'M'; if(!n.isNameCustom)n.name=generateDefaultName(n);let sId=null; for(const cId in breedingData){const c=breedingData[cId];let curSId=null;if(c.parent1Id===nodeId)curSId=c.parent2Id;else if(c.parent2Id===nodeId)curSId=c.parent1Id;if(curSId){sId=curSId;adjustSiblingGender(sId,n.gender);break;}} propagateNameToOffspring(nodeId); renderTree(); updateTotalDisplay(); }

    // --- NEW Gender Cost Handlers ---
    function handleSetGenderCost(nodeId) {
        const node = breedingData[nodeId];
        if (!node || node.isBase) return; // Should not happen if button isn't rendered

        const currentCost = (node.customGenderCost !== null && node.customGenderCost >= 0)
                           ? node.customGenderCost
                           : GENDER_COST; // Default to show in prompt

        const inputCost = prompt(`Set custom gender fee for this breeding step (creating ${node.name}). Default is ¥${GENDER_COST.toLocaleString()}. Enter 0 or leave blank to use default.`, currentCost);

        if (inputCost !== null) { // Handle cancel
            const cost = parseInt(inputCost, 10);
            if (!isNaN(cost) && cost >= 0) {
                node.customGenderCost = cost; // Store the custom value
            } else if (inputCost.trim() === "") { // Treat blank as clearing custom cost
                node.customGenderCost = null;
            }
             else {
                alert("Invalid cost. Please enter a non-negative number.");
                 return; // Don't proceed if invalid
            }
            updateAndRecalculate(); // Recalculate costs and re-render
        }
    }

    function handleClearGenderCost(nodeId) {
        const node = breedingData[nodeId];
        if (!node || node.isBase) return;
        node.customGenderCost = null; // Clear the custom cost
        updateAndRecalculate();
    }
    // -----------------------------


    // --- Data Modifying Helpers --- (Same as before)
    // UPDATED: Captures and returns array of nodes updated by propagation from sibling
    function adjustSiblingGender(siblingId, changedParentGender) {
        const sibling = breedingData[siblingId];
        if (!sibling) return null; // Return null if sibling not found

        const requiredSiblingGender = (changedParentGender === 'M') ? 'F' : 'M';
        let descendantUpdatesFromSibling = null; // Initialize as null

        if (sibling.gender !== requiredSiblingGender) {
            sibling.gender = requiredSiblingGender; // Update sibling gender
            if (!sibling.isNameCustom) { // Update sibling's default name if needed
                sibling.name = generateDefaultName(sibling);
            }
            // Check if the *sibling's* name should now propagate (if it became Female)
            // Capture the array returned by the recursive call
            descendantUpdatesFromSibling = propagateNameToOffspring(siblingId);
        }
        // Return the array of IDs updated down the sibling's line (or null if no gender change/no propagation)
        return descendantUpdatesFromSibling;
    }
    // UPDATED: Recursive propagation, returns array of updated descendant IDs
    function propagateNameToOffspring(parentId) {
        const parentNode = breedingData[parentId];
        // Only propagate from female parents
        if (!parentNode || parentNode.gender !== 'F') {
            return []; // Return empty array if no propagation condition met
        }

        let updatedNodesInBranch = []; // Collect IDs updated in this branch

        for (const childId in breedingData) {
            const childNode = breedingData[childId];
            let isFemaleParent = false;

            // Check if parentId is the female parent of childNode
            if (childNode.parent1Id === parentId && parentNode.gender === 'F') isFemaleParent = true;
            else if (childNode.parent2Id === parentId && parentNode.gender === 'F') isFemaleParent = true;

            // Only propagate if CHILD's name is NOT custom
            if (isFemaleParent && !childNode.isNameCustom) {
                // Check if names are actually different to avoid unnecessary updates/recursion loops
                if (childNode.name !== parentNode.name) {
                   childNode.name = parentNode.name; // Inherit parent's current name
                   // console.log(`Propagated name '${parentNode.name}' from ${parentId} to ${childId}`); // Debug
                   updatedNodesInBranch.push(childId); // Add this child to the list

                   // --- RECURSIVE CALL ---
                   // Propagate further down from this child and add any nodes updated below it
                   const furtherUpdates = propagateNameToOffspring(childId);
                   if (furtherUpdates.length > 0) {
                       updatedNodesInBranch = updatedNodesInBranch.concat(furtherUpdates);
                   }
                   // ----------------------

                }
                // Whether name was updated or not, we found the child for this parent, stop inner loop
                break;
            }
             // Optimization: If we found the child relationship but didn't propagate (child was custom), stop searching.
             if (childNode.parent1Id === parentId || childNode.parent2Id === parentId) {
                break;
             }
        }
        // Return the array of all IDs updated in this branch (could be empty)
        return updatedNodesInBranch;
    }
    function updateAndRecalculate() { /* (Same) */ if(rootNodeId){calculateAllCosts(rootNodeId);renderTree();updateTotalDisplay();} }

    // --- Helper Functions --- (Same as before)
    function findChildNodeId(parentId) { for(const nId in breedingData){const n=breedingData[nId];if(n.parent1Id===parentId||n.parent2Id===parentId)return nId;}return null;}
    function getItemForParentInNextStep(parentId) { const cId=findChildNodeId(parentId);if(!cId)return null;const cN=breedingData[cId];if(cN.parent1Id===parentId)return cN.item1;if(cN.parent2Id===parentId)return cN.item2;return null;}
    function getItemColorClass(itemName) { if(!itemName)return"";if(itemName===EVERSTONE_NAME)return"item-everstone";const cN=itemName.replace(/\s+/g,'.');return`item-${cN}`;}
    function getStatColorClass(statName) { if(!statName)return"";const cS=statName.toLowerCase().replace('.','');return`stat-${cS}`;}
    function generateDefaultName(node) { const i=node.targetAttributes.filter(a=>a!=="Nature");const h=node.targetAttributes.includes("Nature");let n="";if(i.length>0)n+=`${i.length}x31`;if(h)n+=(n?"+":"")+"Nature";n+=` ${node.gender||'?'}`;return n||"Base";}

    // --- Data Generation (MODIFIED) ---
    function generateBreedingDataNode(targetAttributes) {
        const id = `node-${nodeIdCounter++}`;
        const isBase = targetAttributes.length === 1;
        const defaultGender = isBase ? 'F' : '?';

        let item1 = null, item2 = null, stepItemCost = 0;
        if (!isBase) {
            const numAttrs = targetAttributes.length;
            const attr1 = targetAttributes[numAttrs - 1];
            const attr2 = targetAttributes[numAttrs - 2];
            item1 = (attr1 === "Nature") ? EVERSTONE_NAME : braceMap[attr1];
            item2 = (attr2 === "Nature") ? EVERSTONE_NAME : braceMap[attr2];
            // Calculate combined item cost for this step
            stepItemCost += (item1 === EVERSTONE_NAME ? currentEverstoneCost : BRACE_COST);
            stepItemCost += (item2 === EVERSTONE_NAME ? currentEverstoneCost : BRACE_COST);
        }

        const node = {
            id: id, targetAttributes: targetAttributes, isBase: isBase,
            parent1Id: null, parent2Id: null, item1: item1, item2: item2,
            itemCost: stepItemCost,      // Store calculated item cost for the step
            customGenderCost: null,     // NEW: Initialize custom gender cost override
            breedCost: 0, // OBSOLETE: Fixed step cost removed, calculated in calculateAllCosts
            overrideCost: 0, calculatedCost: 0, displayCost: 0,
            gender: defaultGender, name: "", isNameCustom: false
        };
        breedingData[id] = node;

        if (isBase) { node.name = generateDefaultName(node); return node; }

        // Recursive calls (same logic)
        const numAttrs = targetAttributes.length; const attr1 = targetAttributes[numAttrs-1]; const attr2 = targetAttributes[numAttrs-2];
        const sharedAttrs = targetAttributes.filter(attr => attr !== attr1 && attr !== attr2);
        const p1Attrs = [...sharedAttrs, attr1].sort((a,b)=>targetAttributes.indexOf(a)-targetAttributes.indexOf(b));
        const p2Attrs = [...sharedAttrs, attr2].sort((a,b)=>targetAttributes.indexOf(a)-targetAttributes.indexOf(b));
        const p1Node = generateBreedingDataNode(p1Attrs); const p2Node = generateBreedingDataNode(p2Attrs);
        node.parent1Id = p1Node.id; node.parent2Id = p2Node.id;
        // Items set above

        // Assign parent genders & names (same logic)
        if (breedingData[node.parent1Id] && breedingData[node.parent2Id]) {
             breedingData[node.parent1Id].gender = 'F'; breedingData[node.parent2Id].gender = 'M';
             if (!breedingData[node.parent1Id].isNameCustom) breedingData[node.parent1Id].name = generateDefaultName(breedingData[node.parent1Id]);
             if (!breedingData[node.parent2Id].isNameCustom) breedingData[node.parent2Id].name = generateDefaultName(breedingData[node.parent2Id]);
         }
        node.gender = 'F'; node.name = generateDefaultName(node);

        return node;
    }

    // --- Cost Calculation (MODIFIED) ---
    function calculateAllCosts(nodeId) {
        const node = breedingData[nodeId];
        if (!node) return 0;
        if (node.isBase) {
            node.calculatedCost = 0; // Base mons cost nothing to 'make' via breeding
            node.displayCost = node.overrideCost > 0 ? node.overrideCost : 0;
            return node.displayCost;
        }

        // Recursively get display cost from parents
        const costParent1 = calculateAllCosts(node.parent1Id);
        const costParent2 = calculateAllCosts(node.parent2Id);

        // Determine the gender cost for THIS specific breeding step
        const effectiveGenderCost = (node.customGenderCost !== null && node.customGenderCost >= 0)
                                     ? node.customGenderCost
                                     : GENDER_COST; // Use default if no valid custom cost set

        // Calculate the cumulative cost up to this point
        // Cost = Parent1 Display Cost + Parent2 Display Cost + This Step's Item Cost + This Step's Effective Gender Cost
        node.calculatedCost = costParent1 + costParent2 + node.itemCost + effectiveGenderCost;

        // Final display cost uses Pokemon value override if set, otherwise the calculated cumulative cost
        node.displayCost = (node.overrideCost > 0) ? node.overrideCost : node.calculatedCost;
        return node.displayCost;
    }


    // --- HTML Rendering ---
    function renderTree() { /* (Same) */ if (rootNodeId) treeOutput.innerHTML = `<ul>${renderNodeHtml(rootNodeId)}</ul>`; else treeOutput.innerHTML = ''; }
    function renderSingleNode(nodeId) { /* (Same) */ const n=breedingData[nodeId];if(!n)return;const w=document.querySelector(`.node-wrapper[data-node-id="${nodeId}"]`);if(w){const a=document.activeElement;const f=w.contains(a);let sS,sE;if(f&&a.tagName==='INPUT'&&a.classList.contains('node-name-input')){sS=a.selectionStart;sE=a.selectionEnd;}w.innerHTML=generateNodeInnerHtml(n);if(f){const i=w.querySelector('.node-name-input');if(i&&typeof sS!=='undefined'){i.focus();try{i.setSelectionRange(sS,sE);}catch(e){}}else if(a?.focus){try{a.focus();}catch(e){}}}} }

    // Generates the inner HTML content for the .node-wrapper div (MODIFIED)
    function generateNodeInnerHtml(node) {
        // Target Attributes Display (Same)
        const ivs = node.targetAttributes.filter(a => a !== "Nature"); const hasNature = node.targetAttributes.includes("Nature"); let targetDisplayHtml = "";
        ivs.forEach((iv, index) => { targetDisplayHtml += `<span class="${getStatColorClass(iv)}">${iv}</span>` + (index < ivs.length - 1 ? ', ' : ''); });
        if (hasNature) targetDisplayHtml += (ivs.length > 0 ? " + " : "") + `<span class="${getStatColorClass('Nature')}">Nature</span>`; if (!targetDisplayHtml) targetDisplayHtml = "Base";

        // Item Display (Same)
        const nextItem = getItemForParentInNextStep(node.id); let nextStepHtml = ''; if (nextItem) { const itemColorClass = getItemColorClass(nextItem); nextStepHtml = `<span class="node-next-step">Hold <span class="${itemColorClass}">${nextItem}</span></span>`; }

        // Cost Display & Buttons (Pokemon Override - Same)
        let costDisplayHtml = ''; let pokemonCostButtonHtml = '';
        if (node.overrideCost > 0) { costDisplayHtml = `<span class="override-label">Pokémon Value:</span> <span class="cost-value">¥${node.overrideCost.toLocaleString()}</span>`; pokemonCostButtonHtml = `<button class="clear-override-button" data-node-id="${node.id}">Clear Value</button>`; }
        else { costDisplayHtml = `Calculated Total Cost: <span class="cost-value">¥${node.calculatedCost.toLocaleString()}</span>`; pokemonCostButtonHtml = `<button class="set-cost-button" data-node-id="${node.id}">Set Value</button>`; }

        // --- NEW Gender Cost Button ---
        let genderCostButtonHtml = '';
        if (!node.isBase) { // Only show for non-base nodes
             if (node.customGenderCost !== null && node.customGenderCost >= 0) {
                 genderCostButtonHtml = `<button class="clear-gender-cost-button" data-node-id="${node.id}">Clear Gender Cost (Set: ¥${node.customGenderCost.toLocaleString()})</button>`;
             } else {
                 genderCostButtonHtml = `<button class="set-gender-cost-button" data-node-id="${node.id}">Set Gender Cost</button>`;
             }
        }
        // -----------------------------

        // Gender Display (Same)
        const genderSymbol = node.gender === 'M' ? '♂' : '♀'; const genderClass = node.gender === 'M' ? 'male' : 'female'; const safeName = node.name;

        // Assemble Node Content
        return `
            <div class="node-content">
                <div class="node-info">
                    <div class="node-header">
                         <input type="text" class="node-name-input" value="${safeName}" placeholder="Enter Name" data-node-id="${node.id}">
                        <span class="gender-toggle ${genderClass}" title="Toggle Gender" data-node-id="${node.id}">${genderSymbol}</span>
                    </div>
                    <span class="node-target">${targetDisplayHtml}</span>
                    ${nextStepHtml}
                    <span class="node-cost-display">${costDisplayHtml}</span>
                </div>
                <div class="node-actions">
                    ${pokemonCostButtonHtml}
                    ${genderCostButtonHtml} 
                </div>
            </div>
        `;
    }

    // Generates the LI wrapper, node wrapper, calls innerHTML gen, and adds children UL (Same)
    function renderNodeHtml(nodeId) { const node = breedingData[nodeId]; if (!node) return ''; let childrenHtml = ''; if (!node.isBase) { const p1Html = renderNodeHtml(node.parent1Id); const p2Html = renderNodeHtml(node.parent2Id); childrenHtml = `<ul>${p1Html}${p2Html}</ul>`; } return `<li data-node-id="${node.id}"><div class="node-wrapper" data-node-id="${node.id}">${generateNodeInnerHtml(node)}</div>${childrenHtml}</li>`; }

    function updateTotalDisplay() { /* (Same) */ if(rootNodeId&&breedingData[rootNodeId])totalCostValue.textContent=`¥${breedingData[rootNodeId].displayCost.toLocaleString()}`;else totalCostValue.textContent=`¥0`; }

    // --- Run Initialization ---
    initialize();

}); // End DOMContentLoaded