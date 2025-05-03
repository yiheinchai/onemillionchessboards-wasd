// ==UserScript==
// @name         OneMillionChessboards HD Minimap Navigator
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Adds a button to show a high-definition, interactive minimap with pan, zoom, and click-to-navigate functionality for onemillionchessboards.com
// @author       AGI
// @match        https://onemillionchessboards.com/
// @icon         https://www.google.com/s2/favicons?sz=64&domain=onemillionchessboards.com
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    console.log("OMC HD Minimap Userscript Loading...");

    // --- Configuration ---
    const API_URL = "/api/minimap"; // Relative URL is fine
    const MODAL_Z_INDEX = 10001;
    const BUTTON_Z_INDEX = 10000;
    const MIN_ZOOM = 0.1;
    const MAX_ZOOM = 50;
    const ZOOM_SENSITIVITY = 0.0015;
    const MAX_DATA_VALUE = 11; // Based on observed API data
    const MAX_GAME_COORD = 7997; // Max coordinate value (inclusive)
    const MIN_TARGET_COORD = 2;    // Target Min coordinate for visual corners
    const MAX_TARGET_COORD = 7997; // Target Max coordinate for visual corners

    // --- State Variables ---
    let modalScale = 1;
    let modalOffsetX = 0;
    let modalOffsetY = 0;
    let modalIsPanning = false;
    let modalStartX = 0;
    let modalStartY = 0;
    let modalCanvas = null;
    let modalCtx = null;
    let modalContainer = null;
    let originalAggregations = [];
    let gridSize = 0;
    let isDragging = false;

    // --- Helper Functions ---

    function getColorForValue(value) { // Using Grayscale
        let lightness;
        if (value === 0) { lightness = 35; }
        else if (value <= 6) { lightness = 5 + Math.floor(((value - 1) / 5) * 25); }
        else { lightness = 50 + Math.floor(((value - 7) / 4) * 40); }
        lightness = Math.max(0, Math.min(100, lightness));
        return `hsl(0, 0%, ${lightness}%)`;
    }

    function handleMinimapClick(event) {
        if (isDragging || !modalCanvas || !gridSize) return;

        event.preventDefault(); event.stopPropagation();
        const rect = modalCanvas.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const clickY = event.clientY - rect.top;

        // Log basic click info - reduce verbosity for userscript
        // console.log(`handleMinimapClick triggered (Target Coord Mapping):`);
        // console.log(`  Click Relative to Canvas Element: clickX=${clickX.toFixed(2)}, clickY=${clickY.toFixed(2)}`);

        const relativeX = clickX / rect.width;
        const relativeY = clickY / rect.height;
        const clampedRelativeX = Math.max(0, Math.min(1, relativeX));
        const clampedRelativeY = Math.max(0, Math.min(1, relativeY));

        // console.log(`  Clamped Relative Coords: cRelX=${clampedRelativeX.toFixed(3)}, cRelY=${clampedRelativeY.toFixed(3)}`);

        // Linearly interpolate relative position [0, 1] to target game range [MIN_TARGET_COORD, MAX_TARGET_COORD]
        const targetRange = MAX_TARGET_COORD - MIN_TARGET_COORD;
        const targetGameX = MIN_TARGET_COORD + (clampedRelativeX * targetRange);
        const targetGameY = MIN_TARGET_COORD + (clampedRelativeY * targetRange);

        const finalGameX = Math.round(targetGameX);
        const finalGameY = Math.round(targetGameY);
        const clampedFinalGameX = Math.max(0, Math.min(MAX_GAME_COORD, finalGameX));
        const clampedFinalGameY = Math.max(0, Math.min(MAX_GAME_COORD, finalGameY));

        console.log(`OMC HD Minimap: Navigating -> Game(${clampedFinalGameX}, ${clampedFinalGameY})`);

        const newHash = `#${clampedFinalGameX},${clampedFinalGameY}`;
        closeModal();
        window.location.hash = newHash;
    }


    function renderMinimapData(aggregations) {
        if (!modalCanvas || !modalCtx || !aggregations || aggregations.length === 0) return;
        originalAggregations = aggregations;
        const potentialGridSize = Math.sqrt(aggregations.length);
        if (potentialGridSize !== Math.floor(potentialGridSize)) {
             console.error("OMC HD Minimap Error: Aggregation data length not a perfect square."); if (modalContainer) modalContainer.textContent = 'Error: Bad grid size.'; return;
        }
        gridSize = potentialGridSize; // console.log(`OMC HD Minimap: Deduced grid size: ${gridSize}x${gridSize}`);
        modalCanvas.width = gridSize; modalCanvas.height = gridSize;
        const maxDim = Math.min(window.innerWidth, window.innerHeight) * 0.8;
        modalCanvas.style.width = `${maxDim}px`; modalCanvas.style.height = `${maxDim}px`;
        modalCanvas.style.imageRendering = 'pixelated'; modalCanvas.style.msInterpolationMode = 'nearest-neighbor';
        modalCanvas.style.cursor = 'pointer'; modalCtx.imageSmoothingEnabled = false;
        // console.log(`OMC HD Minimap: Rendering ${aggregations.length} points...`);
        modalCtx.clearRect(0, 0, gridSize, gridSize);
        for (let i = 0; i < aggregations.length; i++) {
            const value = aggregations[i]; const x = i % gridSize; const y = Math.floor(i / gridSize);
            modalCtx.fillStyle = getColorForValue(value); modalCtx.fillRect(x, y, 1, 1);
        }
        // console.log("OMC HD Minimap: Rendering complete.");
        modalScale = 1; modalOffsetX = 0; modalOffsetY = 0; centerAndFitCanvas();
    }

    function centerAndFitCanvas() {
        if (!modalCanvas || !modalContainer) return;
        const containerW = modalContainer.clientWidth; const containerH = modalContainer.clientHeight;
        const canvasW = modalCanvas.width; const canvasH = modalCanvas.height;
        const scaleX = containerW / canvasW; const scaleY = containerH / canvasH;
        modalScale = Math.min(scaleX, scaleY) * 0.9;
        const scaledW = canvasW * modalScale; const scaledH = canvasH * modalScale;
        modalOffsetX = (containerW - scaledW) / 2; modalOffsetY = (containerH - scaledH) / 2;
        updateModalTransform();
    }

    function updateModalTransform() {
        if (!modalCanvas) return;
        modalCanvas.style.transform = `translate(${modalOffsetX}px, ${modalOffsetY}px) scale(${modalScale})`;
    }

    function handleModalMouseDown(event) {
        if (event.button !== 0 || !modalContainer) return;
        event.preventDefault(); event.stopPropagation();
        modalIsPanning = true; isDragging = false;
        modalStartX = event.clientX - modalOffsetX; modalStartY = event.clientY - modalOffsetY;
        modalContainer.style.cursor = 'grabbing';
        window.addEventListener('mousemove', handleModalMouseMove, { passive: true }); // Can use passive: true for move
        window.addEventListener('mouseup', handleModalMouseUp);
    }

    function handleModalMouseMove(event) {
        if (!modalIsPanning || !modalContainer) return;
        // No need for preventDefault if passive:true
        isDragging = true;
        modalOffsetX = event.clientX - modalStartX; modalOffsetY = event.clientY - modalStartY;
        updateModalTransform();
    }

    function handleModalMouseUp(event) {
        if (!modalIsPanning || event.button !== 0 || !modalContainer) return;
        event.preventDefault(); event.stopPropagation(); // Keep for potential interference
        modalIsPanning = false; modalContainer.style.cursor = 'grab';
        window.removeEventListener('mousemove', handleModalMouseMove);
        window.removeEventListener('mouseup', handleModalMouseUp);
    }

    function handleModalWheel(event) {
        if (!modalCanvas || !modalContainer) return;
        event.preventDefault(); event.stopPropagation(); // Keep preventDefault to stop page scroll
        const containerRect = modalContainer.getBoundingClientRect();
        const mouseX = event.clientX - containerRect.left;
        const mouseY = event.clientY - containerRect.top;
        const delta = -event.deltaY * ZOOM_SENSITIVITY;
        const zoomFactor = Math.exp(delta);
        const newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, modalScale * zoomFactor));
        const pointX = (mouseX - modalOffsetX) / modalScale;
        const pointY = (mouseY - modalOffsetY) / modalScale;
        modalOffsetX = mouseX - pointX * newScale;
        modalOffsetY = mouseY - pointY * newScale;
        modalScale = newScale;
        updateModalTransform();
    }

    function createModal() {
        if (document.getElementById('omc-hd-minimap-modal')) return; // Use prefixed ID
        modalContainer = document.createElement('div'); modalContainer.id = 'omc-hd-minimap-modal';
        Object.assign(modalContainer.style, {
            position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.85)', zIndex: MODAL_Z_INDEX, display: 'flex',
            justifyContent: 'center', alignItems: 'center', cursor: 'grab', overflow: 'hidden', flexDirection: 'column'
        });
        const loadingText = document.createElement('p'); loadingText.id = 'omc-minimap-loading-text'; loadingText.textContent = 'Loading Minimap Data...';
        Object.assign(loadingText.style, { color: 'white', fontSize: '20px', fontFamily: 'sans-serif' });
        modalContainer.appendChild(loadingText);
        modalCanvas = document.createElement('canvas'); modalCanvas.id = 'omc-hd-minimap-canvas'; modalCtx = modalCanvas.getContext('2d');
        Object.assign(modalCanvas.style, {
            maxWidth: '95%', maxHeight: '95%', width: 'auto', height: 'auto', transformOrigin: '0 0', willChange: 'transform',
            transition: 'none', boxShadow: '0 0 15px rgba(150, 150, 150, 0.4)', display: 'none', cursor: 'pointer'
        });
        modalContainer.appendChild(modalCanvas);
        modalCanvas.addEventListener('click', handleMinimapClick);
        const closeButton = document.createElement('button'); closeButton.textContent = '❌ Close';
        Object.assign(closeButton.style, { position: 'absolute', top: '15px', right: '15px', padding: '8px 15px', cursor: 'pointer', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '4px', fontSize: '14px', zIndex: MODAL_Z_INDEX + 1 });
        closeButton.onclick = closeModal; modalContainer.appendChild(closeButton);
        const recenterButton = document.createElement('button'); recenterButton.textContent = '🔄 Recenter';
        Object.assign(recenterButton.style, { position: 'absolute', top: '15px', right: '110px', padding: '8px 15px', cursor: 'pointer', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', fontSize: '14px', zIndex: MODAL_Z_INDEX + 1 });
        recenterButton.onclick = centerAndFitCanvas; modalContainer.appendChild(recenterButton);
        document.body.appendChild(modalContainer);
        modalContainer.addEventListener('mousedown', handleModalMouseDown);
        modalContainer.addEventListener('wheel', handleModalWheel, { passive: false }); // Needs false for preventDefault
        fetchMinimapData();
    }

     function closeModal() {
        if (modalContainer) {
            window.removeEventListener('mousemove', handleModalMouseMove);
            window.removeEventListener('mouseup', handleModalMouseUp);
            modalContainer.remove(); // Removes container and all children+listeners
        }
        // Reset state
        modalContainer = null; modalCanvas = null; modalCtx = null; modalIsPanning = false; originalAggregations = []; gridSize = 0; isDragging = false;
    }

    function fetchMinimapData() {
        // console.log("OMC HD Minimap: Fetching minimap data...");
        const fetchHeaders = { "accept": "*/*", "priority": "u=1, i", "sec-fetch-dest": "empty", "sec-fetch-mode": "cors", "sec-fetch-site": "same-origin" };
        fetch(API_URL, { method: "GET", headers: fetchHeaders, referrerPolicy: "strict-origin-when-cross-origin", mode: "cors", credentials: "omit", cache: "no-cache" })
            .then(response => {
                 if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                 return response.json();
            })
            .then(data => {
                // console.log("OMC HD Minimap: Data received.");
                const loadingText = document.getElementById('omc-minimap-loading-text');
                 if (loadingText) loadingText.style.display = 'none';
                 if (modalCanvas) modalCanvas.style.display = 'block';
                 if (data && data.type === "minimapUpdate" && data.aggregations) { renderMinimapData(data.aggregations); }
                 else { throw new Error("Invalid data format."); }
            })
            .catch(error => {
                console.error("OMC HD Minimap Error fetching/processing data:", error);
                 const loadingText = document.getElementById('omc-minimap-loading-text');
                 if (loadingText) { loadingText.textContent = `Error loading minimap: ${error.message}`; loadingText.style.color = 'red'; loadingText.style.display = 'block'; }
                 if(modalCanvas) modalCanvas.style.display = 'none';
            });
    }

    // --- Initialization ---
    function init() {
        console.log("OMC HD Minimap Userscript Initializing Button...");
        // Check if button already exists (e.g., script reload)
        if (document.getElementById('omc-hd-minimap-toggle-btn')) {
            console.log("OMC HD Minimap: Button already exists.");
            return;
        }

        const toggleButton = document.createElement('button');
        toggleButton.id = 'omc-hd-minimap-toggle-btn'; // Prefixed ID
        toggleButton.textContent = '🗺️ HD Map (Nav)';
        Object.assign(toggleButton.style, {
            position: 'fixed', bottom: '15px', right: '15px', padding: '10px 15px',
            cursor: 'pointer', backgroundColor: '#6c757d', color: 'white',
            border: 'none', borderRadius: '5px', fontSize: '16px',
            zIndex: BUTTON_Z_INDEX, boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
        });
        toggleButton.onclick = () => {
             if (document.getElementById('omc-hd-minimap-modal')) {
                 closeModal();
             } else {
                 createModal();
             }
        };
        document.body.appendChild(toggleButton);
        console.log("OMC HD Minimap: Button Injected.");
    }

    // --- Run ---
    // Ensure body exists before adding button
    if (document.body) {
        init();
    } else {
        // Fallback if run-at document-end isn't respected perfectly
        window.addEventListener('DOMContentLoaded', init);
    }

})();
