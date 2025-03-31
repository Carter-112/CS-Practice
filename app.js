document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration ---
    // Map set IDs to their data files and cache keys
    const SET_CONFIG = {
        'ca4': {
            dataUrl: 'flashcards_ca4.json',
            cacheKey: 'flashcardProgress_ca4_v1',
            name: 'CA4 (MIPS)' // For potential future use
        },
        'ca5': {
            dataUrl: 'flashcards_ca5.json',
            cacheKey: 'flashcardProgress_ca5_v1',
            name: 'CA5 (Performance)'
        }
    };
    const DEFAULT_SET_ID = 'ca4'; // Set the default set to load
    const DEFAULT_WEIGHT = 1.0;
    const WEIGHTS = {
        understand: 0.5,
        'little-bit': 1.5,
        'no-idea': 3.0,
    };

    // --- State ---
    let flashcards = [];
    let currentCardIndex = 0;
    let currentSetId = DEFAULT_SET_ID; // Track the current set
    let answerRevealed = false;

    // --- DOM Elements Cache ---
    const loadingIndicator = document.getElementById('loadingIndicator');
    const appContent = document.getElementById('appContent');
    const setSelector = document.getElementById('setSelector'); // Get the new selector
    const cardSelector = document.getElementById('cardSelector');
    const randomCardBtn = document.getElementById('randomCardBtn');
    const cardNumberEl = document.getElementById('cardNumber');
    const questionTextEl = document.getElementById('questionText');
    const answerTextEl = document.getElementById('answerText');
    const revealBtn = document.getElementById('revealBtn');
    const feedbackControlsEl = document.getElementById('feedbackControls');
    const understandBtn = document.getElementById('understandBtn');
    const littleBitBtn = document.getElementById('littleBitBtn');
    const noIdeaBtn = document.getElementById('noIdeaBtn');
    const statsDisplayEl = document.getElementById('statsDisplay');

    // --- Initialization ---
    async function init() {
        // Setup the main event listeners once
        setupEventListeners();
        // Load the initial default set
        await loadSet(DEFAULT_SET_ID);
    }

    // --- Load a Specific Card Set ---
    async function loadSet(setId) {
        console.log(`Loading set: ${setId}`);
        showLoading(true);
        appContent.style.display = 'none'; // Hide content during load
        currentSetId = setId; // Update current set ID

        // Get config for the selected set
        const config = SET_CONFIG[setId];
        if (!config) {
            showError(`Configuration for set "${setId}" not found.`);
            showLoading(false);
            return;
        }

        try {
            const rawData = await fetchData(config.dataUrl);
            const savedProgress = loadProgress(config.cacheKey); // Use set-specific cache key
            flashcards = processData(rawData, savedProgress);

            if (flashcards.length === 0) {
                showError(`No flashcards loaded for ${config.name}. Check the data file.`);
                 showLoading(false);
                return;
            }

            // Reset UI for the new set
            populateCardSelector();
            displayCard(0); // Display first card of the new set
            updateStats();
            showLoading(false);
            appContent.style.display = 'block'; // Show content again

        } catch (error) {
            console.error(`Failed to load set ${setId}:`, error);
            showError(`Error loading ${config.name}: ${error.message}`);
            showLoading(false);
            flashcards = []; // Clear flashcards on error
            populateCardSelector(); // Clear dropdown
            updateStats(); // Update stats to show error/empty state
        }
    }


    // --- Data Handling ---
    async function fetchData(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} for ${url}`);
        }
        try {
            return await response.json();
        } catch (jsonError) {
             throw new Error(`Invalid JSON received from ${url}: ${jsonError.message}`);
        }
    }

    function processData(rawData, savedProgress) {
        if (!Array.isArray(rawData)) {
            console.error("Fetched data is not an array:", rawData);
            throw new Error("Invalid data format received.");
        }
        return rawData.map(card => {
             // Ensure card has an id
             if (card.id === undefined || card.id === null) {
                 console.warn("Card missing ID:", card);
                 // Skip card or assign temporary ID? Skipping is safer.
                 return null; // Will be filtered out later
             }
            const progress = savedProgress[card.id] || {};
            return {
                ...card,
                weight: progress.weight !== undefined ? progress.weight : DEFAULT_WEIGHT,
                category: progress.category || null,
            };
        }).filter(card => card !== null); // Remove any cards skipped due to missing ID
    }

    // --- Caching (localStorage) ---
    // Now accepts cacheKey argument
    function loadProgress(cacheKey) {
        try {
            const saved = localStorage.getItem(cacheKey);
            return saved ? JSON.parse(saved) : {};
        } catch (error) {
            console.error(`Error loading progress from localStorage (key: ${cacheKey}):`, error);
            return {};
        }
    }

    // Now uses the current set's cacheKey
    function saveProgress() {
        const cacheKey = SET_CONFIG[currentSetId]?.cacheKey;
        if (!cacheKey) {
            console.error("Cannot save progress: Unknown cache key for current set.");
            return;
        }

        try {
            const progressToSave = {};
            flashcards.forEach(card => {
                if (card.weight !== DEFAULT_WEIGHT || card.category !== null) {
                    // Ensure card.id exists before saving
                    if (card.id !== undefined && card.id !== null) {
                        progressToSave[card.id] = {
                            weight: card.weight,
                            category: card.category
                        };
                    } else {
                        console.warn("Attempted to save progress for card without ID:", card);
                    }
                }
            });

            if (Object.keys(progressToSave).length > 0) {
                 localStorage.setItem(cacheKey, JSON.stringify(progressToSave));
                 // console.log(`Progress saved for ${currentSetId} under key ${cacheKey}`);
            } else {
                 localStorage.removeItem(cacheKey); // Clean up if no progress for this set
                 // console.log(`Progress cache cleared for ${currentSetId}`);
            }
        } catch (error) {
            console.error(`Error saving progress to localStorage (key: ${cacheKey}):`, error);
        }
    }


    // --- UI Updates ---
    function showLoading(isLoading) {
        loadingIndicator.textContent = 'Loading cards...'; // Reset message
        loadingIndicator.style.color = ''; // Reset color
        loadingIndicator.style.display = isLoading ? 'block' : 'none';
        // appContent visibility handled in loadSet now
    }

    function showError(message) {
        loadingIndicator.textContent = message;
        loadingIndicator.style.color = 'red';
        loadingIndicator.style.display = 'block';
        appContent.style.display = 'none';
    }


    function populateCardSelector() {
        cardSelector.innerHTML = ''; // Clear existing options
        if (flashcards.length > 0) {
            flashcards.forEach((card, index) => {
                const option = document.createElement('option');
                option.value = index;
                option.textContent = `Card ${card.id}`; // Use card.id for display
                cardSelector.appendChild(option);
            });
            cardSelector.disabled = false;
            randomCardBtn.disabled = false;

        } else {
             // Handle empty set case
             const option = document.createElement('option');
             option.textContent = "No cards available";
             option.disabled = true;
             cardSelector.appendChild(option);
             cardSelector.disabled = true;
             randomCardBtn.disabled = true;
        }

    }

    function displayCard(index) {
         // Check if flashcards array is populated and index is valid
         if (!flashcards || flashcards.length === 0) {
             questionTextEl.textContent = "No cards loaded for this set.";
             answerTextEl.textContent = "";
             cardNumberEl.textContent = "Card 0 of 0";
              // Hide controls that don't make sense without cards
             revealBtn.style.display = 'none';
             feedbackControlsEl.style.display = 'none';
             return; // Exit early
         }

        if (index < 0 || index >= flashcards.length) {
            console.warn(`Invalid card index requested: ${index}. Resetting to 0.`);
            index = 0; // Reset to first card if index is invalid
             if (flashcards.length === 0) return; // Still check after reset attempt
        }

        currentCardIndex = index;
        const card = flashcards[currentCardIndex];

         // Check if the card object is valid
         if (!card) {
             console.error(`Card at index ${index} is undefined.`);
             questionTextEl.textContent = "Error displaying card.";
             answerTextEl.textContent = "";
             return; // Exit if card is somehow invalid
         }


        cardNumberEl.textContent = `Card ${card.id} of ${flashcards.length}`;
        questionTextEl.textContent = card.question || "[No Question]"; // Fallback text
        answerTextEl.textContent = card.answer || "[No Answer]"; // Fallback text

        // Reset view
        answerTextEl.classList.remove('visible');
        answerTextEl.style.display = 'none';
        revealBtn.style.display = 'block'; // Show reveal button again
        feedbackControlsEl.classList.remove('visible');
        feedbackControlsEl.style.display = 'none';
        answerRevealed = false;

        // Update dropdown selector to match current card
        cardSelector.value = index;
    }

    function updateStats() {
        if (!flashcards || flashcards.length === 0) {
             statsDisplayEl.textContent = "No statistics available.";
             return;
        }
        const total = flashcards.length;
        const understood = flashcards.filter(card => card?.category === 'understand').length;
        const littleBit = flashcards.filter(card => card?.category === 'little-bit').length;
        const noIdea = flashcards.filter(card => card?.category === 'no-idea').length;
        const unrated = total - understood - littleBit - noIdea;

        statsDisplayEl.innerHTML = `
            Progress (${SET_CONFIG[currentSetId]?.name || 'Current Set'}):
            <span style="color: var(--primary-color);">${understood} understood</span> |
            <span style="color: var(--warning-color);">${littleBit} need review</span> |
            <span style="color: var(--danger-color);">${noIdea} not known</span> |
            <span style="color: var(--medium-text);">${unrated} unrated</span>
            (${total} total)
        `;
    }

    // --- Event Handling ---
    function setupEventListeners() {
        // Listener for set selection
        setSelector.addEventListener('change', (event) => {
             const selectedSetId = event.target.value;
             loadSet(selectedSetId); // Load the newly selected set
        });

        // Other listeners
        randomCardBtn.addEventListener('click', selectWeightedRandomCard);
        revealBtn.addEventListener('click', handleReveal);
        understandBtn.addEventListener('click', () => handleFeedback('understand'));
        littleBitBtn.addEventListener('click', () => handleFeedback('little-bit'));
        noIdeaBtn.addEventListener('click', () => handleFeedback('no-idea'));
        cardSelector.addEventListener('change', handleGoToCard);
    }

    // Function remains the same, uses current flashcards array length
    function handleGoToCard() {
        const selectedIndex = parseInt(cardSelector.value, 10);
        if (!isNaN(selectedIndex) && selectedIndex >= 0 && selectedIndex < flashcards.length) {
            displayCard(selectedIndex);
        } else if (!isNaN(selectedIndex)) {
             console.warn(`Attempted to navigate to invalid index: ${selectedIndex}`);
             cardSelector.value = currentCardIndex; // Reset selector to current card
        }
    }


     function handleReveal() {
         if (!flashcards || flashcards.length === 0) return; // Don't reveal if no cards

        answerTextEl.style.display = 'block';
        setTimeout(() => {
            answerTextEl.classList.add('visible');
        }, 10);

        revealBtn.style.display = 'none';
        feedbackControlsEl.style.display = 'flex';
        setTimeout(() => {
            feedbackControlsEl.classList.add('visible');
        }, 10);

        answerRevealed = true;
    }

    function handleFeedback(category) {
        if (!answerRevealed || !flashcards || flashcards.length === 0) return;

        // Ensure currentCardIndex is valid
        if (currentCardIndex < 0 || currentCardIndex >= flashcards.length) {
             console.error("Invalid currentCardIndex during feedback:", currentCardIndex);
             return;
        }

        const card = flashcards[currentCardIndex];
         // Check if card exists
         if (!card) {
             console.error(`Card at index ${currentCardIndex} is undefined during feedback.`);
             return;
         }

        card.category = category;
        card.weight = WEIGHTS[category] || DEFAULT_WEIGHT;

        saveProgress(); // Save progress for the current set
        updateStats();

         if (flashcards.length > 1) {
            selectWeightedRandomCard();
        } else if (flashcards.length === 1) {
            // If only one card, just reset its view
            displayCard(currentCardIndex);
        }
         // If flashcards.length is 0, do nothing more
    }

    // --- Card Selection Logic ---
    // Function remains mostly the same, operates on the current flashcards array
    function selectWeightedRandomCard() {
        if (!flashcards || flashcards.length === 0) {
             console.log("No cards available for random selection.");
             displayCard(-1); // Show empty state
             return;
        }
        if (flashcards.length === 1) {
            displayCard(0);
            return;
        }

        flashcards.forEach(card => {
            if (!card) return; // Skip undefined cards
             // Ensure weight is valid, assign default if not
            if (typeof card.weight !== 'number' || card.weight <= 0 || isNaN(card.weight)) {
                 card.weight = DEFAULT_WEIGHT;
            }
        });

        const availableCards = flashcards.filter(card => card && typeof card.weight === 'number' && card.weight > 0);

        if (availableCards.length === 0) {
             console.warn("No cards with positive weight available, selecting completely randomly.");
             displayCard(Math.floor(Math.random() * flashcards.length)); // Pick any card
             return;
        }

         // --- Weighted selection logic using only availableCards ---
         // Try to exclude the current card if possible
         let possibleIndices = availableCards.map((_, i) => i);
         let currentCardInAvailableIndex = availableCards.findIndex((card, idx) => flashcards.indexOf(card) === currentCardIndex); // Find index within availableCards

         let adjustedTotalWeight = availableCards.reduce((sum, card) => sum + card.weight, 0);
         let randomValue = Math.random() * adjustedTotalWeight;
         let cumulativeWeight = 0;
         let nextAvailableIndex = -1;


         // Simple weighted selection from available cards
         for (let i = 0; i < availableCards.length; i++) {
            cumulativeWeight += availableCards[i].weight;
            if (randomValue <= cumulativeWeight) {
                 // Basic attempt to avoid immediate repeat
                if (i === currentCardInAvailableIndex && availableCards.length > 1) {
                    // If it picked the current card, try the next one in weighted list (simple heuristic)
                    continue;
                }
                nextAvailableIndex = i;
                break;
            }
        }
        // If loop finishes (e.g., only current card was valid, or picked last card), handle fallback
        if (nextAvailableIndex === -1) {
             if (availableCards.length > 0) {
                // Pick a random card from the available ones as fallback
                nextAvailableIndex = Math.floor(Math.random() * availableCards.length);
             } else {
                 // Absolute fallback if availableCards is empty (shouldn't happen with checks above)
                  console.error("Fallback failed: No available cards.");
                  return;
             }
         }


        // Get the original index from the main flashcards array
        const nextOriginalIndex = flashcards.indexOf(availableCards[nextAvailableIndex]);

        if (nextOriginalIndex === -1) {
             console.error("Failed to find original index for selected card.");
             // Fallback: pick truly random from original list
             displayCard(Math.floor(Math.random() * flashcards.length));
        } else {
            displayCard(nextOriginalIndex);
        }
    }

    // --- Start the App ---
    init();

}); // End DOMContentLoaded listener