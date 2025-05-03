// ==UserScript==
// @name         One Million Chessboards - WASD Controls (Your Pieces)
// @namespace    http://tampermonkey.net/
// @version      0.6
// @description  Adds WASD controls for single moves and Shift+WASD for multi-square moves (furthest valid) for YOUR assigned pieces on onemillionchessboards.com. Detects user color.
// @author       AGI
// @match        https://onemillionchessboards.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=onemillionchessboards.com
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    console.log("Initializing WASD Chess Controls (v0.6 - Auto Color Detect)...");

    let selectedPieceElement = null;
    let lastClickedUserPieceElement = null;
    let userColor = null; // Will be 'white' or 'black'
    let userPieceSelector = null; // Will be set after detecting color

    const PIECE_SIZE = 28; // Assuming 28px based on '--size' style
    const SELECT_KEY = 'q'; // Press 'Q' to select the last clicked piece for WASD control
    // const USER_PIECE_SELECTOR - Now dynamically set
    const TARGET_SQUARE_SELECTOR = 'button.sc-fLDLck'; // Selector for the highlighted valid move squares
    const POST_MOVE_DELAY_MS = 300; // Delay after move for re-click
    const MAX_MULTI_MOVE_DISTANCE = 8; // Max squares to check for multi-move
    const COLOR_CHECK_INTERVAL = 2000; // Check user color every 2 seconds

    // --- Color Detection ---
    function detectUserColor() {
        const colorElement = document.querySelector('.sc-gQJZgv.cTKlr span.sc-iXqmyu'); // Find the span indicating color
         const playingElement = document.querySelector('.sc-bCjwNj.fxGmLX span.sc-iXqmyu'); // Alternative check

        let detectedColor = null;
        if (colorElement && colorElement.textContent.toLowerCase().includes('white')) {
            detectedColor = 'white';
        } else if (colorElement && colorElement.textContent.toLowerCase().includes('black')) {
            detectedColor = 'black';
        } else if (playingElement && playingElement.textContent.toLowerCase().includes('white')) {
             detectedColor = 'white';
        } else if (playingElement && playingElement.textContent.toLowerCase().includes('black')) {
             detectedColor = 'black';
        }


        if (detectedColor && detectedColor !== userColor) {
            userColor = detectedColor;
            userPieceSelector = `button.sc-dVBluf img.chess-piece[src*="/${userColor}-processed/"]`;
            console.log(`Detected user color: ${userColor}. Selector set to: ${userPieceSelector}`);
            // Reset selection if color changes mid-game (unlikely but safe)
            if (selectedPieceElement) {
                 updateSelection(null);
            }
            lastClickedUserPieceElement = null;
        } else if (!detectedColor && userColor === null) {
            // console.log("Waiting to detect user color..."); // Reduce console noise
        }
    }

    // --- Utility Functions ---
    function getElementPosition(element) {
        if (!element || !element.style) {
             // console.warn("getElementPosition: Invalid element provided."); // Reduce noise
             return null;
        }
        const transform = element.style.transform;
        if (!transform || !transform.includes('translate')) {
            return null;
        }
        const match = transform.match(/translate\(\s*(-?\d+(\.\d+)?)px,\s*(-?\d+(\.\d+)?)px\s*\)/);
        if (match && match.length >= 4) {
            return { x: parseFloat(match[1]), y: parseFloat(match[3]) };
        } else {
            // console.error("Could not parse translate style:", transform); // Reduce noise
            return null;
        }
    }

     function findTargetSquareElement(targetX, targetY) {
        const targetSquares = document.querySelectorAll(TARGET_SQUARE_SELECTOR);
        for (const square of targetSquares) {
            try {
                const style = getComputedStyle(square);
                const xStr = style.getPropertyValue('--x').trim().replace('px', '');
                const yStr = style.getPropertyValue('--y').trim().replace('px', '');
                const sx = parseInt(xStr, 10);
                const sy = parseInt(yStr, 10);

                 if (!isNaN(sx) && !isNaN(sy) && Math.abs(sx - targetX) < 1 && Math.abs(sy - targetY) < 1) {
                    return square;
                }
            } catch (e) {
                // console.warn("Error parsing target square position", square, e); // Reduce noise
            }
        }
        return null;
    }

    function updateSelection(newSelectionElement) {
        if (selectedPieceElement && selectedPieceElement.style) { // Check style exists
            try { // Add try-catch for safety if element disappears unexpectedly
                selectedPieceElement.style.outline = 'none';
                selectedPieceElement.style.filter = '';
            } catch (e) { console.warn("Error removing style from old selection:", e)}
        }
        selectedPieceElement = newSelectionElement;
        if (selectedPieceElement) {
             if (!document.contains(selectedPieceElement)) {
                 console.warn("Attempted to select an element no longer in the DOM. Deselecting.");
                 selectedPieceElement = null;
                 lastClickedUserPieceElement = null; // Also clear this ref
                 return;
             }
             try { // Add try-catch for safety
                selectedPieceElement.style.outline = '3px solid limegreen';
                selectedPieceElement.style.outlineOffset = '2px';
                selectedPieceElement.style.filter = 'drop-shadow(0 0 5px limegreen)';
                console.log(`Selected piece ID: ${selectedPieceElement.dataset.id}`, selectedPieceElement);
                selectedPieceElement.click(); // Click to show available moves
             } catch(e) {
                 console.error("Error styling or clicking new selection:", e);
                 updateSelection(null); // Deselect if styling failed
             }
        } else {
            console.log("Piece deselected.");
        }
    }

    // --- Event Handler Functions ---

    function handleUserClick(event) {
        // Only proceed if color and selector are known
        if (!userColor || !userPieceSelector) {
            // console.log("User color not detected yet, ignoring click for selection purposes."); // Reduce noise
            return;
        }

        const target = event.target;
        // Check if the clicked element is one of the user's piece images
        if (target.matches(userPieceSelector)) {
            const buttonElement = target.closest('button.sc-dVBluf');
            if (buttonElement && !buttonElement.disabled) { // Ensure the button isn't disabled (captured)
                lastClickedUserPieceElement = buttonElement;
                console.log(`Click registered on user piece ID: ${buttonElement.dataset.id}. Press '${SELECT_KEY.toUpperCase()}' to control.`);
            } else if (buttonElement && buttonElement.disabled) {
                 console.log(`Clicked on a captured/disabled piece (ID: ${buttonElement.dataset.id}). Ignoring for selection.`);
            }
        }
        // If the user clicks the button edge, not the image:
        else if (target.matches('button.sc-dVBluf')) {
             const imgElement = target.querySelector(userPieceSelector);
             if (imgElement && !target.disabled) { // Check if it *contains* a user piece image
                 lastClickedUserPieceElement = target; // Target is the button itself
                 console.log(`Click registered on user piece button ID: ${target.dataset.id}. Press '${SELECT_KEY.toUpperCase()}' to control.`);
             } else if (target.disabled) {
                 console.log(`Clicked on a captured/disabled piece button (ID: ${target.dataset.id}). Ignoring for selection.`);
             }
        }
    }


    function handleKeyDown(event) {
         if (!userColor) {
             console.log("User color not yet determined. Key press ignored.");
             return;
         }

        const key = event.key.toLowerCase();
        const isShiftPressed = event.shiftKey;

        // --- Selection Logic ---
        if (key === SELECT_KEY) {
            event.preventDefault();
            if (lastClickedUserPieceElement) {
                 if (document.contains(lastClickedUserPieceElement) && !lastClickedUserPieceElement.disabled) {
                     updateSelection(lastClickedUserPieceElement);
                 } else {
                     console.log("The previously clicked piece is no longer available or is captured. Please click a valid piece again.");
                     lastClickedUserPieceElement = null;
                     updateSelection(null); // Ensure deselection visually
                 }
            } else {
                console.log("No user piece clicked recently to select.");
            }
            return;
        }

        // --- Movement Logic (WASD) ---
        if (['w', 'a', 's', 'd'].includes(key)) {
            if (!selectedPieceElement || !document.contains(selectedPieceElement)) {
                 if (selectedPieceElement) {
                      console.log("Selected piece element is no longer valid. Deselecting.");
                      updateSelection(null);
                 } else {
                    // Only show this if color IS detected but no piece is selected
                    if (userColor) console.log(`No piece selected. Click your ${userColor} piece, then press '${SELECT_KEY.toUpperCase()}'.`);
                 }
                return;
            }
             if (selectedPieceElement.disabled) {
                 console.log("Selected piece appears to be captured/disabled. Cannot move. Deselecting.");
                 updateSelection(null);
                 return;
             }


            event.preventDefault();

            const currentPos = getElementPosition(selectedPieceElement);
            if (!currentPos) {
                console.warn("Could not get current position of selected piece (maybe animating?). Move might fail.");
                return; // Exit if we don't know where the piece is
            }

            const sourceX = currentPos.x;
            const sourceY = currentPos.y;
            let targetSquare = null; // The element we will eventually click
            let targetX = sourceX;   // Coordinates of the target square
            let targetY = sourceY;

            // Determine direction vector
            let deltaX = 0;
            let deltaY = 0;
            switch (key) {
                case 'w': deltaY = -1; break; // UP
                case 'a': deltaX = -1; break; // LEFT
                case 's': deltaY = 1;  break; // DOWN
                case 'd': deltaX = 1;  break; // RIGHT
            }

            // --- Choose Target Based on Shift ---
            if (isShiftPressed) {
                // Multi-move: Find the furthest valid square in the chosen direction
                console.log(`Attempting MULTI-move via Shift+${key.toUpperCase()}: from (${sourceX}, ${sourceY}) in direction (${deltaX}, ${deltaY})`);
                let furthestFoundSquare = null;
                let furthestDistance = 0;

                for (let i = 1; i <= MAX_MULTI_MOVE_DISTANCE; i++) {
                    const checkX = sourceX + i * deltaX * PIECE_SIZE;
                    const checkY = sourceY + i * deltaY * PIECE_SIZE;
                    const potentialTarget = findTargetSquareElement(checkX, checkY);

                    if (potentialTarget) {
                        furthestFoundSquare = potentialTarget;
                        furthestDistance = i;
                        targetX = checkX;
                        targetY = checkY;
                        // console.log(`   Found valid target at dist ${i}: (${targetX}, ${targetY})`); // Debugging noise
                    } else {
                        // console.log(`   No valid target at dist ${i}: (${checkX}, ${checkY})`); // Debugging noise
                        // Stop searching in this direction if we hit an invalid square *after* finding a valid one
                        if (furthestFoundSquare) {
                             // console.log(" -> Stopping search, hit invalid square after valid ones.");
                             break;
                        }
                         // If we haven't found *any* valid squares yet, also stop. (e.g. blocked immediately)
                         if (i > 1 && !furthestFoundSquare) { // Check i > 1 to allow checking the first step
                             // console.log(" -> Stopping search, no valid square found beyond step 1.");
                              break;
                         }

                    }
                }

                if (furthestFoundSquare) {
                    console.log(` -> Found furthest target at distance ${furthestDistance}: (${targetX}, ${targetY})`);
                    targetSquare = furthestFoundSquare;
                } else {
                    console.log(" -> No valid multi-move target found in that direction.");
                }

            } else {
                // Single-move: Calculate target one step away
                targetX = sourceX + deltaX * PIECE_SIZE;
                targetY = sourceY + deltaY * PIECE_SIZE;
                console.log(`Attempting single move via ${key.toUpperCase()}: from (${sourceX}, ${sourceY}) to (${targetX}, ${targetY})`);
                targetSquare = findTargetSquareElement(targetX, targetY);
            }

            // --- Execute Move if Target Found ---
            if (targetSquare) {
                console.log("Found valid target square, clicking:", targetSquare);
                targetSquare.click();

                // Store reference BEFORE the move might invalidate it during animation/update
                const elementThatMoved = selectedPieceElement;
                const expectedTargetX = targetX;
                const expectedTargetY = targetY;
                // Assume the move takes the piece off the 'selected' state immediately
                 // Keep the visual selection until the next 'Q' press
                 // updateSelection(null); // Don't deselect visually yet

                // Re-click the *moved* piece's button after a delay to show new moves
                setTimeout(() => {
                     // Crucially, check if the element *still exists* in the DOM
                    if (elementThatMoved && document.contains(elementThatMoved) && !elementThatMoved.disabled) {
                         const newPos = getElementPosition(elementThatMoved);
                         if (newPos) {
                             // Check if it actually arrived near the target location
                             if (Math.abs(newPos.x - expectedTargetX) < 1 && Math.abs(newPos.y - expectedTargetY) < 1) {
                                 console.log("Piece position updated correctly. Re-clicking moved piece to show new targets.");
                                 elementThatMoved.click(); // Click the button again
                                 // Make this the 'last clicked' again so 'Q' isn't needed if you want to continue moving it
                                 lastClickedUserPieceElement = elementThatMoved;
                             } else {
                                 console.warn(`Position check mismatch after move: Expected (${expectedTargetX}, ${expectedTargetY}), Found (${newPos.x}, ${newPos.y}). Will attempt re-click anyway.`);
                                 elementThatMoved.click();
                                 lastClickedUserPieceElement = elementThatMoved; // Assume it moved okay enough
                             }
                         } else {
                             console.warn("Could not get position after move timeout (style missing/changed?). Attempting re-click anyway.");
                             elementThatMoved.click();
                             lastClickedUserPieceElement = elementThatMoved;
                         }
                    } else {
                         console.log("Moved piece element reference became invalid or piece captured after move timeout. Cannot re-click.");
                         // If the piece we were controlling is gone, deselect fully
                         if(selectedPieceElement === elementThatMoved) {
                              updateSelection(null);
                              lastClickedUserPieceElement = null;
                         }
                    }
                }, POST_MOVE_DELAY_MS);

            } else {
                 // Log failure only if it wasn't a multi-move search that simply found nothing
                 if (!isShiftPressed) {
                     console.log("No valid move target found at that position.");
                 }
            }
        }
    }

    // --- Add Event Listeners ---
    document.addEventListener('click', handleUserClick, true); // Use capture phase
    document.addEventListener('keydown', handleKeyDown);

    // --- Initial Color Check and Periodic Check ---
    detectUserColor(); // Initial check
    const colorCheckTimer = setInterval(detectUserColor, COLOR_CHECK_INTERVAL);

    // --- Cleanup Function ---
    window.stopWASDControls = function() {
        clearInterval(colorCheckTimer); // Stop periodic check
        document.removeEventListener('click', handleUserClick, true);
        document.removeEventListener('keydown', handleKeyDown);
        if (selectedPieceElement && selectedPieceElement.style) {
             try {
                selectedPieceElement.style.outline = 'none';
                selectedPieceElement.style.filter = '';
             } catch(e){}
        }
        selectedPieceElement = null;
        lastClickedUserPieceElement = null;
        userColor = null;
        userPieceSelector = null;
        console.log("WASD Chess Controls stopped.");
        try {
             delete window.stopWASDControls;
        } catch (e) {
             console.warn("Could not delete stopWASDControls function from window.");
        }
    };

    console.log(`WASD Controls Initialized (v0.6). Detecting your color...`);
    console.log(`Once color is detected: Click your piece, then press '${SELECT_KEY.toUpperCase()}' to select.`);
    console.log("Use WASD for single moves, SHIFT+WASD for multi-moves (Queen/Rook/Bishop).");
    console.log("Run stopWASDControls() in the console to disable.");

})();
