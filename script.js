// == UserScript ==
// @name         One Million Chessboards - WASD Controls (Strict Mode Fix)
// @namespace    http://tampermonkey.net/
// @version      0.3
// @description  Attempt to add basic WASD controls for selected black pieces on One Million Chessboards (Strict Mode compatible)
// @match        https://chess.eieio.games/*
// @grant        none
// @author       Your AI Assistant
// ==/UserScript ==

(function() {
    'use strict';

    console.log("Initializing WASD Chess Controls for Black Pieces...");

    let selectedPieceElement = null;
    let lastClickedUserPieceElement = null;
    const PIECE_SIZE = 28; // Assuming 28px based on '--size' style
    const SELECT_KEY = 'q'; // Press 'Q' to select the last clicked piece for WASD control
    const USER_PIECE_SELECTOR = 'button.sc-dVBluf img.chess-piece[src*="/black-processed/"]';
    const TARGET_SQUARE_SELECTOR = 'button.sc-fLDLck'; // Selector for the highlighted valid move squares

    // --- Utility Functions ---
    function getElementPosition(element) {
        const transform = element.style.transform;
        if (!transform || !transform.includes('translate')) {
            console.error("Could not find transform style for:", element);
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
                // Get computed style as --x and --y are CSS variables
                const style = getComputedStyle(square);
                const xStr = style.getPropertyValue('--x').trim().replace('px', '');
                const yStr = style.getPropertyValue('--y').trim().replace('px', '');
                const sx = parseInt(xStr, 10);
                const sy = parseInt(yStr, 10);

                 if (Math.abs(sx - targetX) < 1 && Math.abs(sy - targetY) < 1) {
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

    // --- Event Handler Functions (Defined with Names) ---

    function handleUserClick(event) {
        const target = event.target;
        if (target.matches(USER_PIECE_SELECTOR)) {
            const buttonElement = target.closest('button.sc-dVBluf');
            if (buttonElement) {
                lastClickedUserPieceElement = buttonElement;
                console.log(`Last clicked user piece set to ID: ${buttonElement.dataset.id}`);
            }
        }
        // No deselection logic here for simplicity, rely on 'Q' to select
    }

    function handleKeyDown(event) {
        const key = event.key.toLowerCase();

        if (key === SELECT_KEY) {
            event.preventDefault();
            if (lastClickedUserPieceElement) {
                updateSelection(lastClickedUserPieceElement);
            } else {
                console.log("No user piece clicked recently to select.");
            }
            return;
        }

        if (['w', 'a', 's', 'd'].includes(key)) {
            if (!selectedPieceElement) {
                console.log(`No piece selected. Press '${SELECT_KEY}' after clicking your piece.`);
                return;
            }

            event.preventDefault();

            const currentPos = getElementPosition(selectedPieceElement);
            if (!currentPos) {
                console.error("Cannot move: Could not get position of selected piece.");
                return;
            }

            let targetX = currentPos.x;
            let targetY = currentPos.y;

            switch (key) {
                case 'w': targetY -= PIECE_SIZE; break; // Up
                case 'a': targetX -= PIECE_SIZE; break; // Left
                case 's': targetY += PIECE_SIZE; break; // Down
                case 'd': targetX += PIECE_SIZE; break; // Right
            }

            console.log(`Attempting move via ${key.toUpperCase()}: from (${currentPos.x}, ${currentPos.y}) to (${targetX}, ${targetY})`);

            const targetSquare = findTargetSquareElement(targetX, targetY);

            if (targetSquare) {
                console.log("Found valid target square, clicking:", targetSquare);
                targetSquare.click();
                lastClickedUserPieceElement = selectedPieceElement; // Update reference for potential re-selection

                // Re-click the *moved* piece after a short delay to show new targets
                setTimeout(() => {
                    if (selectedPieceElement && selectedPieceElement.parentElement) {
                         // Re-verify position in case the element reference is stale
                         const newPos = getElementPosition(selectedPieceElement);
                         if (newPos && (Math.abs(newPos.x - targetX) < 1 && Math.abs(newPos.y - targetY) < 1)) {
                             console.log("Re-clicking moved piece to show new targets.");
                             selectedPieceElement.click(); // Re-click to show new moves
                         } else {
                             console.warn("Selected piece position didn't update as expected or element changed. May need re-selection ('Q').");
                              // If position is wrong, don't re-click, force user re-select
                             // updateSelection(null); // Optional: auto-deselect if move seems glitchy
                         }
                    } else {
                        console.log("Selected piece seems to have been removed/replaced after move. Deselecting.");
                        updateSelection(null);
                    }
                }, 150);

            } else {
                console.log("No valid move target found at that position.");
            }
        }
    }

    // --- Add Event Listeners ---
    document.addEventListener('click', handleUserClick, true); // Use named function
    document.addEventListener('keydown', handleKeyDown);     // Use named function


    // --- Cleanup Function ---
    window.stopWASDControls = function() {
        // Use the SAME named functions here for removal
        document.removeEventListener('click', handleUserClick, true);
        document.removeEventListener('keydown', handleKeyDown);
        if (selectedPieceElement) {
            selectedPieceElement.style.outline = 'none';
            selectedPieceElement.style.filter = '';
        }
        selectedPieceElement = null; // Clear selection state
        lastClickedUserPieceElement = null;
        console.log("WASD Chess Controls stopped.");
        // Clean up the cleanup function itself to prevent memory leaks if the script is run multiple times
        delete window.stopWASDControls;
    };

    console.log(`WASD Controls Initialized. Click one of your black pieces, then press '${SELECT_KEY.toUpperCase()}' to select it for WASD movement.`);
    console.log("Use WASD to move the selected piece to a highlighted square.");
    console.log("Run stopWASDControls() in the console to disable.");

})();
