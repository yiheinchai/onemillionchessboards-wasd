// == UserScript ==
// @name         One Million Chessboards - WASD Controls (Strict Mode Fix + Delay Tweak)
// @namespace    http://tampermonkey.net/
// @version      0.4
// @description  Attempt to add basic WASD controls for selected black pieces on One Million Chessboards (Strict Mode compatible, increased delay)
// @match        https://chess.eieio.games/*
// @grant        none
// @author       Gemini 2.5 Pro (one-shot)
// ==/UserScript ==

(function() {
    'use strict';

    console.log("Initializing WASD Chess Controls for Black Pieces (v0.4)...");

    let selectedPieceElement = null;
    let lastClickedUserPieceElement = null;
    const PIECE_SIZE = 28; // Assuming 28px based on '--size' style
    const SELECT_KEY = 'q'; // Press 'Q' to select the last clicked piece for WASD control
    const USER_PIECE_SELECTOR = 'button.sc-dVBluf img.chess-piece[src*="/black-processed/"]';
    const TARGET_SQUARE_SELECTOR = 'button.sc-fLDLck'; // Selector for the highlighted valid move squares
    const POST_MOVE_DELAY_MS = 300; // Increased delay (milliseconds)

    // --- Utility Functions ---
    function getElementPosition(element) {
        if (!element || !element.style) {
             console.warn("getElementPosition: Invalid element provided.");
             return null;
        }
        const transform = element.style.transform;
        if (!transform || !transform.includes('translate')) {
            // Don't log error here, might be transient during updates
            // console.error("Could not find transform style for:", element);
            return null;
        }
        const match = transform.match(/translate\(\s*(-?\d+(\.\d+)?)px,\s*(-?\d+(\.\d+)?)px\s*\)/);
        if (match && match.length >= 4) {
            return { x: parseFloat(match[1]), y: parseFloat(match[3]) };
        } else {
            console.error("Could not parse translate style:", transform);
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
                // Use parseInt which is safer if the value isn't purely numeric for some reason
                const sx = parseInt(xStr, 10);
                const sy = parseInt(yStr, 10);

                // Check if parsing resulted in valid numbers
                 if (!isNaN(sx) && !isNaN(sy) && Math.abs(sx - targetX) < 1 && Math.abs(sy - targetY) < 1) {
                    return square;
                }
            } catch (e) {
                console.warn("Error parsing target square position", square, e);
            }
        }
        return null;
    }

    function updateSelection(newSelectionElement) {
        if (selectedPieceElement) {
            selectedPieceElement.style.outline = 'none';
            selectedPieceElement.style.filter = '';
        }
        selectedPieceElement = newSelectionElement;
        if (selectedPieceElement) {
            // Ensure element still exists before styling
             if (!document.contains(selectedPieceElement)) {
                 console.warn("Attempted to select an element no longer in the DOM. Deselecting.");
                 selectedPieceElement = null;
                 lastClickedUserPieceElement = null;
                 return;
             }
            selectedPieceElement.style.outline = '3px solid limegreen';
            selectedPieceElement.style.outlineOffset = '2px';
            selectedPieceElement.style.filter = 'drop-shadow(0 0 5px limegreen)';
            console.log(`Selected piece ID: ${selectedPieceElement.dataset.id}`, selectedPieceElement);
            // Click the selected piece to ensure its valid moves are shown
            selectedPieceElement.click();
        } else {
            console.log("Piece deselected.");
        }
    }

    // --- Event Handler Functions ---

    function handleUserClick(event) {
        const target = event.target;
        if (target.matches(USER_PIECE_SELECTOR)) {
            const buttonElement = target.closest('button.sc-dVBluf');
            if (buttonElement) {
                lastClickedUserPieceElement = buttonElement;
                console.log(`Last clicked user piece set to ID: ${buttonElement.dataset.id}`);
            }
        }
    }

    function handleKeyDown(event) {
        const key = event.key.toLowerCase();

        if (key === SELECT_KEY) {
            event.preventDefault();
            if (lastClickedUserPieceElement) {
                 // Ensure the last clicked element is still valid before selecting
                 if (document.contains(lastClickedUserPieceElement)) {
                     updateSelection(lastClickedUserPieceElement);
                 } else {
                     console.log("The previously clicked piece is no longer available. Please click it again.");
                     lastClickedUserPieceElement = null; // Clear invalid reference
                 }
            } else {
                console.log("No user piece clicked recently to select.");
            }
            return;
        }

        if (['w', 'a', 's', 'd'].includes(key)) {
            if (!selectedPieceElement || !document.contains(selectedPieceElement)) {
                 if (selectedPieceElement) { // If reference exists but element detached
                      console.log("Selected piece element is no longer valid. Deselecting.");
                      updateSelection(null); // Auto-deselect
                 } else {
                    console.log(`No piece selected. Press '${SELECT_KEY}' after clicking your piece.`);
                 }
                return;
            }

            event.preventDefault();

            const currentPos = getElementPosition(selectedPieceElement);
            if (!currentPos) {
                // It's possible the style is temporarily removed during animation. Don't treat as fatal error yet.
                console.warn("Could not get current position of selected piece (maybe animating?). Move might fail.");
                // Allow proceeding, the findTargetSquareElement might still work if based on older state? Risky.
                 // Alternative: return here to prevent likely failure
                 // return;
            }

            // Calculate target based on *last known* position OR default if unknown
            const sourceX = currentPos ? currentPos.x : 0;
            const sourceY = currentPos ? currentPos.y : 0;
            let targetX = sourceX;
            let targetY = sourceY;

            switch (key) {
                case 'w': targetY -= PIECE_SIZE; break; // Up
                case 'a': targetX -= PIECE_SIZE; break; // Left
                case 's': targetY += PIECE_SIZE; break; // Down
                case 'd': targetX += PIECE_SIZE; break; // Right
            }

             if (!currentPos) { // Log if we guessed position
                 console.warn(`Moving based on assumed 0,0 start or previous target due to missing position data. Target: (${targetX}, ${targetY})`)
             } else {
                console.log(`Attempting move via ${key.toUpperCase()}: from (${sourceX}, ${sourceY}) to (${targetX}, ${targetY})`);
             }


            const targetSquare = findTargetSquareElement(targetX, targetY);

            if (targetSquare) {
                console.log("Found valid target square, clicking:", targetSquare);
                targetSquare.click();
                // Keep the reference, assume the game updates the element in place or replaces it predictably
                lastClickedUserPieceElement = selectedPieceElement;

                // Re-click the *selected* piece after a delay to show new targets
                // Use a copy of the reference in case selectedPieceElement changes before timeout
                const elementToReclick = selectedPieceElement;
                const expectedTargetX = targetX; // Capture target coords for the check
                const expectedTargetY = targetY;

                setTimeout(() => {
                    // 1. Check if the element reference we stored is still valid and in the DOM
                    if (elementToReclick && elementToReclick.parentElement) {
                         // 2. Get its CURRENT position *now*
                         const newPos = getElementPosition(elementToReclick);
                         if (newPos) {
                             // 3. Check if it matches where we *intended* to move it
                             if (Math.abs(newPos.x - expectedTargetX) < 1 && Math.abs(newPos.y - expectedTargetY) < 1) {
                                 console.log("Piece position updated. Re-clicking moved piece to show new targets.");
                                 elementToReclick.click(); // Re-click to show new moves
                             } else {
                                 // Position hasn't updated in the DOM *yet*, or the element reference is stale.
                                 console.warn(`Position check mismatch after move: Expected (${expectedTargetX}, ${expectedTargetY}), Found (${newPos.x}, ${newPos.y}). Re-clicking anyway.`);
                                 // Try clicking - maybe it just updated? If not, harmless click on old spot.
                                 elementToReclick.click();
                             }
                         } else {
                              // Style might be temporarily missing after move/animation. Still try re-click.
                             console.warn("Could not get position after move timeout (style missing?). Attempting re-click anyway.");
                             elementToReclick.click();
                         }
                    } else {
                        console.log("Stored piece element reference became invalid after move timeout. Cannot re-click.");
                        // Don't deselect here automatically, user might have selected another piece already.
                    }
                }, POST_MOVE_DELAY_MS); // Use the defined delay

            } else {
                console.log("No valid move target found at that position.");
            }
        }
    }

    // --- Add Event Listeners ---
    document.addEventListener('click', handleUserClick, true);
    document.addEventListener('keydown', handleKeyDown);

    // --- Cleanup Function ---
    window.stopWASDControls = function() {
        document.removeEventListener('click', handleUserClick, true);
        document.removeEventListener('keydown', handleKeyDown);
        if (selectedPieceElement && selectedPieceElement.style) { // Check style exists before modifying
            selectedPieceElement.style.outline = 'none';
            selectedPieceElement.style.filter = '';
        }
        selectedPieceElement = null;
        lastClickedUserPieceElement = null;
        console.log("WASD Chess Controls stopped.");
        try { // Add try-catch for edge cases where window obj might be weird
             delete window.stopWASDControls;
        } catch (e) {
             console.warn("Could not delete stopWASDControls function from window.");
        }
    };

    console.log(`WASD Controls Initialized (v0.4). Delay: ${POST_MOVE_DELAY_MS}ms. Click your black piece, press '${SELECT_KEY.toUpperCase()}' to select.`);
    console.log("Use WASD to move selected piece. Run stopWASDControls() to disable.");

})();
