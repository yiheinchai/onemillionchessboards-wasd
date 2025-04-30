// == UserScript ==
// @name         One Million Chessboards - WASD Controls (Shift Multi-Move)
// @namespace    http://tampermonkey.net/
// @version      0.5
// @description  WASD for single moves, Shift+WASD for multi-square moves (furthest valid) for black pieces.
// @match        https://chess.eieio.games/*
// @grant        none
// @author       Your AI Assistant
// ==/UserScript ==

(function() {
    'use strict';

    console.log("Initializing WASD Chess Controls for Black Pieces (v0.5 - Shift Multi-Move)...");

    let selectedPieceElement = null;
    let lastClickedUserPieceElement = null;
    const PIECE_SIZE = 28; // Assuming 28px based on '--size' style
    const SELECT_KEY = 'q'; // Press 'Q' to select the last clicked piece for WASD control
    const USER_PIECE_SELECTOR = 'button.sc-dVBluf img.chess-piece[src*="/black-processed/"]';
    const TARGET_SQUARE_SELECTOR = 'button.sc-fLDLck'; // Selector for the highlighted valid move squares
    const POST_MOVE_DELAY_MS = 300; // Delay after move for re-click
    const MAX_MULTI_MOVE_DISTANCE = 8; // Max squares to check for multi-move

    // --- Utility Functions ---
    function getElementPosition(element) {
        // ... (keep the previous getElementPosition function)
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
        // ... (keep the previous findTargetSquareElement function)
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
        // ... (keep the previous updateSelection function)
        if (selectedPieceElement) {
            selectedPieceElement.style.outline = 'none';
            selectedPieceElement.style.filter = '';
        }
        selectedPieceElement = newSelectionElement;
        if (selectedPieceElement) {
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
            selectedPieceElement.click();
        } else {
            console.log("Piece deselected.");
        }
    }

    // --- Event Handler Functions ---

    function handleUserClick(event) {
        // ... (keep the previous handleUserClick function)
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
        const isShiftPressed = event.shiftKey;

        // --- Selection Logic ---
        if (key === SELECT_KEY) {
            event.preventDefault();
            if (lastClickedUserPieceElement) {
                 if (document.contains(lastClickedUserPieceElement)) {
                     updateSelection(lastClickedUserPieceElement);
                 } else {
                     console.log("The previously clicked piece is no longer available. Please click it again.");
                     lastClickedUserPieceElement = null;
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
                    console.log(`No piece selected. Press '${SELECT_KEY}' after clicking your piece.`);
                 }
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
                case 'w': deltaY = -1; break;
                case 'a': deltaX = -1; break;
                case 's': deltaY = 1;  break;
                case 'd': deltaX = 1;  break;
            }

            // --- Choose Target Based on Shift ---
            if (isShiftPressed) {
                // Multi-move: Find the furthest valid square in the chosen direction
                console.log(`Attempting MULTI-move via Shift+${key.toUpperCase()}: from (${sourceX}, ${sourceY})`);
                let furthestFoundSquare = null;
                let furthestDistance = 0;

                for (let i = 1; i <= MAX_MULTI_MOVE_DISTANCE; i++) {
                    const checkX = sourceX + i * deltaX * PIECE_SIZE;
                    const checkY = sourceY + i * deltaY * PIECE_SIZE;
                    const potentialTarget = findTargetSquareElement(checkX, checkY);

                    if (potentialTarget) {
                        // Found a valid square at this distance
                        furthestFoundSquare = potentialTarget;
                        furthestDistance = i; // Store distance if needed for logging/debugging
                        targetX = checkX;     // Update target coordinates
                        targetY = checkY;
                        // Continue checking further squares in the loop
                    } else {
                        // If we find an invalid square after finding a valid one,
                        // it means we hit the end of the line (or an obstacle the game didn't highlight past).
                        // Stop checking further in this direction.
                        if (furthestFoundSquare) break;
                    }
                }

                if (furthestFoundSquare) {
                    console.log(` -> Found furthest target at distance ${furthestDistance} (${targetX}, ${targetY})`);
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
                lastClickedUserPieceElement = selectedPieceElement; // Keep track

                // Re-click the *selected* piece after a delay
                const elementToReclick = selectedPieceElement;
                const expectedTargetX = targetX; // Use the final target coords
                const expectedTargetY = targetY;

                setTimeout(() => {
                    if (elementToReclick && elementToReclick.parentElement) {
                         const newPos = getElementPosition(elementToReclick);
                         if (newPos) {
                             if (Math.abs(newPos.x - expectedTargetX) < 1 && Math.abs(newPos.y - expectedTargetY) < 1) {
                                 console.log("Piece position updated. Re-clicking moved piece to show new targets.");
                                 elementToReclick.click();
                             } else {
                                 console.warn(`Position check mismatch after move: Expected (${expectedTargetX}, ${expectedTargetY}), Found (${newPos.x}, ${newPos.y}). Re-clicking anyway.`);
                                 elementToReclick.click();
                             }
                         } else {
                             console.warn("Could not get position after move timeout (style missing?). Attempting re-click anyway.");
                             elementToReclick.click();
                         }
                    } else {
                        console.log("Stored piece element reference became invalid after move timeout. Cannot re-click.");
                    }
                }, POST_MOVE_DELAY_MS);

            } else {
                 // Only log if we expected a target (i.e., not just a failed multi-move search)
                 if (!isShiftPressed) {
                     console.log("No valid move target found at that position.");
                 }
                 // No need to log failure again if multi-move already logged it
            }
        }
    }

    // --- Add Event Listeners ---
    document.addEventListener('click', handleUserClick, true);
    document.addEventListener('keydown', handleKeyDown);

    // --- Cleanup Function ---
    window.stopWASDControls = function() {
        // ... (keep the previous stopWASDControls function)
        document.removeEventListener('click', handleUserClick, true);
        document.removeEventListener('keydown', handleKeyDown);
        if (selectedPieceElement && selectedPieceElement.style) {
            selectedPieceElement.style.outline = 'none';
            selectedPieceElement.style.filter = '';
        }
        selectedPieceElement = null;
        lastClickedUserPieceElement = null;
        console.log("WASD Chess Controls stopped.");
        try {
             delete window.stopWASDControls;
        } catch (e) {
             console.warn("Could not delete stopWASDControls function from window.");
        }
    };

    console.log(`WASD Controls Initialized (v0.5). Delay: ${POST_MOVE_DELAY_MS}ms.`);
    console.log(`Click your black piece, press '${SELECT_KEY.toUpperCase()}' to select.`);
    console.log("Use WASD for single moves, SHIFT+WASD for multi-moves (Queen/Rook/Bishop).");
    console.log("Run stopWASDControls() to disable.");

})();
